import { prisma, runWithSystemContext } from '@workflo/db'
import { getActiveFrom, getMailer, renderClientMonthlyReportEmail } from '@workflo/notifications'
import {
  ChromiumUnavailableError,
  htmlToPdf,
  renderClientMonthlyReportHtml,
} from '@workflo/templates'
import type { FastifyBaseLogger } from 'fastify'
import { captureException } from '../observability/sentry.js'
import { nextDocumentNumber } from '../routes/documents/documents.js'
import { computeClientMonthlyNumbers, moneyLabel } from '../services/clientMonthlyReport.js'

/**
 * Cron C-client_monthly_report (19-Г, раз на добу): агенціям з увімкненим
 * clientMonthlyReportEnabled — для кожної КОМПАНІЇ з активністю за попередній
 * UTC-місяць створюється Document(monthly_report, orderId=null) + лист клієнту з
 * PDF-вкладенням. Отримувачі: Company.documentEmail (+cc, 06-Г) або, як fallback,
 * власники компанії. Одна розсилка на місяць — clientMonthlyReportLastSentAt.
 * Без Chromium PDF деградує до HTML-вкладення (той самий патерн, що PDF-роут).
 */
const INTERVAL_MS = 24 * 60 * 60 * 1000

let bootTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let running = false

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

      for (const companyId of companyIds) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: { id: true, name: true, documentEmail: true, documentEmailCc: true },
        })
        if (!company) continue

        const numbers = await computeClientMonthlyNumbers(prisma, {
          agencyId: agency.id,
          companyId,
          from: prevStart,
          to: monthStart,
        })
        if (!numbers.hasActivity) continue

        const year = prevStart.getUTCFullYear()
        const number = await nextDocumentNumber(prisma, agency.id, 'monthly_report', year)
        const document = await prisma.document.create({
          data: {
            agency: { connect: { id: agency.id } },
            type: 'monthly_report',
            number,
            company: { connect: { id: companyId } },
            status: 'sent',
            sentAt: now,
            createdBy: { connect: { id: ownerRow.profileId } },
          },
          select: { id: true, number: true, generatedAt: true },
        })

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

        // Отримувачі: documentEmail (+cc) або власники компанії.
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
          continue
        }

        const rows: [string, string][] = [
          ['Нових замовлень', String(numbers.newOrders.length)],
          ['Завершено', String(numbers.completedOrders.length)],
          ['Годин по проєктах', String(numbers.totalHours)],
          ['Оплачено за період', moneyLabel(numbers.paid)],
          ['Поточний борг', moneyLabel(numbers.debt)],
        ]
        const rendered = renderClientMonthlyReportEmail({
          agencyName: agency.name,
          periodLabel,
          rows,
        })
        const from = getActiveFrom()
        await getMailer().sendMail({
          from: `"${from.name}" <${from.address}>`,
          to,
          ...(cc ? { cc } : {}),
          subject: rendered.subject,
          html: rendered.html,
          attachments: [attachment],
        })
        sentReports += 1
      }

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

async function runOnce(logger: FastifyBaseLogger): Promise<void> {
  if (running) return
  running = true
  try {
    await runClientMonthlyReportOnce(logger)
  } catch (err) {
    logger.error({ err }, 'clientMonthlyReport: run failed')
    captureException(err, { scope: 'cron.clientMonthlyReport' })
  } finally {
    running = false
  }
}

export function startClientMonthlyReportCron(logger: FastifyBaseLogger): void {
  if (bootTimer || intervalTimer) return
  bootTimer = setTimeout(() => {
    void runOnce(logger)
    intervalTimer = setInterval(() => void runOnce(logger), INTERVAL_MS)
    intervalTimer.unref()
  }, 180_000)
  bootTimer.unref()
}

export function stopClientMonthlyReportCron(): void {
  if (bootTimer) {
    clearTimeout(bootTimer)
    bootTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}
