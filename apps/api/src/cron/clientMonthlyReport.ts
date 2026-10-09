import { prisma, runWithSystemContext } from '@workflo/db'
import {
  applyEmailOverride,
  getActiveFrom,
  getMailer,
  renderClientMonthlyReportEmail,
} from '@workflo/notifications'
import {
  ChromiumUnavailableError,
  htmlToPdf,
  renderClientMonthlyReportHtml,
} from '@workflo/templates'
import type { FastifyBaseLogger } from 'fastify'
import { nextDocumentNumber } from '../services/documentNumber.js'
import { computeClientMonthlyNumbers, moneyLabel } from '../services/clientMonthlyReport.js'
import { makeCron } from './makeCron.js'

/**
 * Cron C-client_monthly_report (19-Г, раз на добу): агенціям з увімкненим
 * clientMonthlyReportEnabled — для кожної КОМПАНІЇ з активністю за попередній
 * UTC-місяць створюється Document(monthly_report, orderId=null) + лист клієнту з
 * PDF-вкладенням. Отримувачі: Company.documentEmail (+cc, 06-Г) або, як fallback,
 * власники компанії. Одна розсилка на місяць — clientMonthlyReportLastSentAt.
 * Без Chromium PDF деградує до HTML-вкладення (той самий патерн, що PDF-роут).
 *
 * Ідемпотентність (05.10): збій SMTP на одній компанії раніше обривав увесь прогін ДО
 * штампа lastSentAt → наступного дня тим самим клієнтам ішов ще один звіт з новим номером.
 * Тепер: звіт періоду шукається перед створенням (надісланий — пропуск, ненадісланий —
 * повторна відправка з тим самим номером), статус `sent` — лише після sendMail, помилка
 * компанії не зупиняє решту, а lastSentAt ставиться тільки коли збоїв не було.
 */
const INTERVAL_MS = 24 * 60 * 60 * 1000

const fmtDate = (d: Date): string => d.toLocaleDateString('uk-UA')

export async function runClientMonthlyReportOnce(
  logger: FastifyBaseLogger,
  now: Date = new Date()
): Promise<number> {
  return runWithSystemContext(async () => {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
    const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
    const periodLabel = new Intl.DateTimeFormat('uk-UA', {
      month: 'long',
      year: 'numeric',
    }).format(prevStart)

    const agencies = await prisma.agency.findMany({
      where: {
        clientMonthlyReportEnabled: true,
        OR: [
          { clientMonthlyReportLastSentAt: null },
          { clientMonthlyReportLastSentAt: { lt: monthStart } },
        ],
      },
      select: { id: true, name: true },
      take: 100,
    })
    if (agencies.length === 0) return 0

    let sentReports = 0
    for (const agency of agencies) {
      // Компанії з активністю за місяць: замовлення / оплати / залогований час.
      const window = { gte: prevStart, lt: monthStart }
      const [orderCompanies, paymentCompanies, timeCompanies, ownerRow] = await Promise.all([
        prisma.order.findMany({
          where: { agencyId: agency.id, deletedAt: null, createdAt: window },
          select: { companyId: true },
          distinct: ['companyId'],
        }),
        prisma.payment.findMany({
          where: { agencyId: agency.id, status: 'confirmed', confirmedAt: window },
          select: { companyId: true },
          distinct: ['companyId'],
        }),
        prisma.timeLog.findMany({
          where: { agencyId: agency.id, date: window, order: { companyId: { not: null } } },
          select: { order: { select: { companyId: true } } },
          distinct: ['orderId'],
          take: 2000,
        }),
        prisma.agencyMember.findFirst({
          where: { agencyId: agency.id, role: 'owner' },
          select: { profileId: true },
        }),
      ])
      if (!ownerRow) continue // агенція без власника — нікому підписати документ

      const companyIds = [
        ...new Set(
          [
            ...orderCompanies.map((o) => o.companyId),
            ...paymentCompanies.map((p) => p.companyId),
            ...timeCompanies.map((t) => t.order?.companyId ?? null),
          ].filter((id): id is string => id != null)
        ),
      ]

      let failures = 0
      for (const companyId of companyIds) {
        try {
          const sent = await reportCompany({
            logger,
            agency,
            companyId,
            ownerProfileId: ownerRow.profileId,
            prevStart,
            monthStart,
            periodLabel,
            now,
          })
          if (sent) sentReports += 1
        } catch (err) {
          failures += 1
          logger.error(
            { err, agencyId: agency.id, companyId },
            'clientMonthlyReport: company failed — retried on the next run'
          )
        }
      }

      // Не штампуємо місяць, поки хоч одна компанія не отримала звіт: наступний прогін
      // повторить лише її (решта — `sent`, пропускаються).
      if (failures > 0) continue
      await prisma.agency.update({
        where: { id: agency.id },
        data: { clientMonthlyReportLastSentAt: now },
      })
    }

    logger.info(
      { agencies: agencies.length, reports: sentReports },
      'clientMonthlyReport: client reports dispatched'
    )
    return sentReports
  })
}

interface ReportCompanyInput {
  logger: FastifyBaseLogger
  agency: { id: string; name: string }
  companyId: string
  ownerProfileId: string
  prevStart: Date
  monthStart: Date
  periodLabel: string
  now: Date
}

/** Звіт однієї компанії за попередній місяць. true — лист відправлено в цьому прогоні. */
async function reportCompany(input: ReportCompanyInput): Promise<boolean> {
  const { logger, agency, companyId, prevStart, monthStart, periodLabel, now } = input
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, documentEmail: true, documentEmailCc: true },
  })
  if (!company) return false

  const numbers = await computeClientMonthlyNumbers(prisma, {
    agencyId: agency.id,
    companyId,
    from: prevStart,
    to: monthStart,
  })
  if (!numbers.hasActivity) return false

  // Отримувачі: documentEmail (+cc) або власники компанії. Без отримувача документ не
  // створюємо — інакше лишався б «надісланий» звіт, якого ніхто не отримав.
  let to = company.documentEmail
  let cc = company.documentEmailCc
  if (!to) {
    const members = await prisma.companyMember.findMany({
      where: { companyId, role: 'owner' },
      select: { profile: { select: { email: true } } },
      take: 3,
    })
    to = members[0]?.profile.email ?? null
    cc = members
      .slice(1)
      .map((m) => m.profile.email)
      .join(', ')
  }
  if (!to) {
    logger.warn({ companyId }, 'clientMonthlyReport: компанія без отримувача — пропущено')
    return false
  }

  // Звіт за попередній місяць генерується лише впродовж поточного, тож «вже є звіт
  // періоду» = monthly_report цієї компанії з generatedAt ≥ початку поточного місяця.
  const existing = await prisma.document.findFirst({
    where: {
      agencyId: agency.id,
      companyId,
      type: 'monthly_report',
      generatedAt: { gte: monthStart },
    },
    orderBy: { generatedAt: 'asc' },
    select: { id: true, number: true, generatedAt: true, status: true },
  })
  if (existing && existing.status !== 'draft' && existing.status !== 'generated') return false

  const document =
    existing ??
    (await prisma.document.create({
      data: {
        agency: { connect: { id: agency.id } },
        type: 'monthly_report',
        number: await nextDocumentNumber(
          prisma,
          agency.id,
          'monthly_report',
          prevStart.getUTCFullYear()
        ),
        company: { connect: { id: companyId } },
        status: 'generated',
        createdBy: { connect: { id: input.ownerProfileId } },
      },
      select: { id: true, number: true, generatedAt: true, status: true },
    }))

  const html = renderClientMonthlyReportHtml({
    agencyName: agency.name,
    companyName: company.name,
    periodLabel,
    number: document.number,
    generatedAt: fmtDate(document.generatedAt),
    newOrders: numbers.newOrders,
    completedOrders: numbers.completedOrders,
    hoursByProject: numbers.hoursByProject,
    totalHours: numbers.totalHours,
    paidLabel: moneyLabel(numbers.paid),
    debtLabel: moneyLabel(numbers.debt),
  })

  // PDF; без Chromium — чесний HTML-фолбек (відкривається і друкується).
  let attachment: { filename: string; content: Buffer | string; contentType: string }
  try {
    attachment = {
      filename: `${document.number}.pdf`,
      content: await htmlToPdf(html),
      contentType: 'application/pdf',
    }
  } catch (err) {
    if (!(err instanceof ChromiumUnavailableError)) throw err
    logger.warn({ number: document.number }, 'clientMonthlyReport: Chromium → HTML fallback')
    attachment = {
      filename: `${document.number}.html`,
      content: html,
      contentType: 'text/html',
    }
  }

  const rows: [string, string][] = [
    ['Нових замовлень', String(numbers.newOrders.length)],
    ['Завершено', String(numbers.completedOrders.length)],
    ['Годин по проєктах', String(numbers.totalHours)],
    ['Оплачено за період', moneyLabel(numbers.paid)],
    ['Поточний борг', moneyLabel(numbers.debt)],
  ]
  // 08-EMAIL: owner-override теми/вступу (псевдо-подія reports.client_monthly, uk)
  const override = await prisma.emailTemplate.findUnique({
    where: {
      agencyId_event_locale: {
        agencyId: agency.id,
        event: 'reports.client_monthly',
        locale: 'uk',
      },
    },
    select: { subject: true, intro: true },
  })
  const rendered = applyEmailOverride(
    renderClientMonthlyReportEmail({ agencyName: agency.name, periodLabel, rows }),
    override ?? undefined,
    { periodLabel, agencyName: agency.name }
  )
  const from = getActiveFrom()
  await getMailer().sendMail({
    from: `"${from.name}" <${from.address}>`,
    to,
    ...(cc ? { cc } : {}),
    subject: rendered.subject,
    html: rendered.html,
    attachments: [attachment],
  })

  await prisma.document.update({
    where: { id: document.id },
    data: { status: 'sent', sentAt: now },
  })
  return true
}

const cron = makeCron({
  name: 'clientMonthlyReport',
  bootDelayMs: 180_000,
  intervalMs: INTERVAL_MS,
  run: (logger) => runClientMonthlyReportOnce(logger),
})
export const startClientMonthlyReportCron = cron.start
export const stopClientMonthlyReportCron = cron.stop
