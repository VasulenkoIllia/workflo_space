import { type Prisma, prisma } from '@workflo/db'
import {
  ChromiumUnavailableError,
  type DocumentKind,
  type DocumentLine,
  type DocumentRenderData,
  type ReconciliationRow,
  htmlToPdf,
  renderDocumentHtml,
} from '@workflo/templates'
import { applyTemplate } from './documentTemplates.js'
import { getStorage } from './storage.js'

/**
 * 06-SEND: збірка даних PDF-рендера, винесена з роутів, щоб outbox-воркер міг
 * рендерити документ у вкладення листа. Роути документів імпортують усе звідси.
 */
export const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: 'Рахунок',
  advance_invoice: 'Аванс-рахунок',
  completion_act: 'Акт виконаних робіт',
  specification: 'Специфікація',
  reconciliation_act: 'Акт звірки',
  contract: 'Договір',
  monthly_report: 'Місячний звіт', // 19-Г
}

export const fmtMoney = (v: unknown): string =>
  Number(v ?? 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fmtDate = (d: Date): string =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`

/** Doc row shape used by the PDF endpoint (result of its select). */
export interface DocRow {
  type: string
  number: string
  generatedAt: Date
  companyId: string
  agencyId: string
  agency: { name: string }
  order: {
    id: string
    title: string
    description: string | null
    totalAmount: unknown
    approvedAmount: unknown
    currency: string
    createdAt: Date
    project: { id: string; name: string; contractDocumentId?: string | null } | null
  } | null
  company: {
    name: string
    legalName: string | null
    taxId: string | null
    legalAddress: string | null
  }
  legalEntity: {
    name: string
    legalName: string | null
    taxId: string | null
    vatPayer: boolean
    legalAddress: string | null
    bankName: string | null
    iban: string | null
    signerName: string | null
    signerTitle: string | null
  } | null
}

/**
 * Пер-типова збірка даних рендера (06, повний UA-комплект): позиції — з estimate-ліній
 * проєкту (фолбек: одна позиція за замовленням), грн-еквівалент — з ExchangeRate,
 * звірка — з реальних charges/payments компанії. Дані читаються свіжими (без снапшоту —
 * D2 follow-up).
 */
/** 06-А: брендинг агенції для PDF — лого як data-URI + акцент. null-safe. */
export async function loadPdfBranding(
  agencyId: string,
  agencyName: string
): Promise<DocumentRenderData['branding']> {
  const agency = await prisma.agency.findUnique({
    where: { id: agencyId },
    select: { pdfLogoKey: true, pdfAccentColor: true },
  })
  if (!agency) return undefined
  let logoDataUri: string | undefined
  if (agency.pdfLogoKey) {
    try {
      const buffer = await getStorage().read(agency.pdfLogoKey)
      const mime = agency.pdfLogoKey.endsWith('.png') ? 'image/png' : 'image/jpeg'
      logoDataUri = `data:${mime};base64,${buffer.toString('base64')}`
    } catch {
      logoDataUri = undefined // файл зник — рендеримо без лого, не валимо PDF
    }
  }
  if (!logoDataUri && !agency.pdfAccentColor) return undefined
  return {
    logoDataUri,
    brandName: agencyName,
    accentColor: agency.pdfAccentColor ?? undefined,
  }
}

export async function buildRenderData(
  tx: Prisma.TransactionClient,
  doc: DocRow
): Promise<DocumentRenderData> {
  const kind = doc.type as DocumentKind
  const order = doc.order
  const currency = order?.currency ?? 'UAH'
  const amountNum = Number(order?.approvedAmount ?? order?.totalAmount ?? 0)

  const data: DocumentRenderData = {
    typeLabel: DOC_TYPE_LABEL[doc.type] ?? doc.type,
    number: doc.number,
    date: fmtDate(doc.generatedAt),
    orderTitle: order?.title ?? '—',
    projectName: order?.project?.name ?? null,
    amount: fmtMoney(amountNum),
    currency,
    issuer: doc.legalEntity ?? { name: doc.agency.name },
    recipient: {
      name: doc.company.name,
      legalName: doc.company.legalName,
      taxId: doc.company.taxId,
      legalAddress: doc.company.legalAddress,
    },
  }

  // 02-Б (рішення власника 07.07): рахунок/акт друкують ЛИШЕ офіційну номенклатуру
  // «згідно КВЕД» (одна позиція на всю суму); специфікація — довільна розбивка
  // (кошторис замовлення або проектні P-6 лінії). Без номенклатури — стара поведінка.
  const isMoneyDoc = kind === 'invoice' || kind === 'advance_invoice' || kind === 'completion_act'
  let nomenclatureName: string | null = null
  if (isMoneyDoc && order) {
    const o = await tx.order.findUnique({
      where: { id: order.id },
      select: {
        nomenclature: { select: { name: true } },
        project: { select: { nomenclature: { select: { name: true } } } },
      },
    })
    nomenclatureName = o?.nomenclature?.name ?? o?.project?.nomenclature?.name ?? null
    if (nomenclatureName) {
      data.lines = [
        {
          name: nomenclatureName,
          qty: '1',
          unit: 'послуга',
          price: data.amount,
          sum: data.amount,
        },
      ]
    }
  }

  // 02-Б: специфікація — кошторис замовлення (к-сть × ціна), якщо він є
  if (kind === 'specification' && order) {
    const estLines = await tx.orderEstimateLine.findMany({
      where: { orderId: order.id },
      orderBy: { position: 'asc' },
      select: { name: true, qty: true, unitPrice: true },
    })
    if (estLines.length > 0) {
      data.lines = estLines.map(
        (l): DocumentLine => ({
          name: l.name,
          qty: fmtMoney(Number(l.qty)),
          unit: 'шт',
          price: fmtMoney(Number(l.unitPrice)),
          sum: fmtMoney(Number(l.qty) * Number(l.unitPrice)),
        })
      )
    }
  }

  // ── позиції: estimate-лінії проєкту (P-6); нема → фолбек у рендерері ──
  if (
    data.lines === undefined &&
    kind !== 'reconciliation_act' &&
    kind !== 'contract' &&
    order?.project
  ) {
    const lines = await tx.estimateLine.findMany({
      where: { projectId: order.project.id },
      orderBy: { createdAt: 'asc' },
      select: { name: true, hours: true, amount: true },
    })
    if (lines.length > 0) {
      data.lines = lines.map((l): DocumentLine => {
        const hours = Number(l.hours)
        const sum = l.amount != null ? Number(l.amount) : 0
        const rate = hours > 0 && sum > 0 ? sum / hours : null
        return {
          name: l.name,
          qty: hours > 0 ? fmtMoney(hours) : '1',
          unit: hours > 0 ? 'год' : 'послуга',
          price: rate != null ? fmtMoney(rate) : sum > 0 ? fmtMoney(sum) : 'включено',
          sum: sum > 0 ? fmtMoney(sum) : '0,00',
        }
      })
    }
  }

  // ── грн-еквівалент для не-UAH валют (курс агенції, S5-03a) ──
  if (currency !== 'UAH' && amountNum > 0) {
    const rate = await tx.exchangeRate.findUnique({
      where: { agencyId: doc.agencyId },
      select: { usdToUah: true, eurToUah: true, updatedAt: true },
    })
    const uah =
      currency === 'USD' && rate?.usdToUah
        ? Number(rate.usdToUah)
        : currency === 'EUR' && rate?.eurToUah
          ? Number(rate.eurToUah)
          : null
    if (uah != null && rate) {
      data.uahTotal = fmtMoney(amountNum * uah)
      data.rateNote = `за курсом ${fmtMoney(uah)} грн/${currency} від ${fmtDate(rate.updatedAt)}`
    }
  }

  data.vatNote = doc.legalEntity?.vatPayer ? 'у т.ч. ПДВ 20%' : 'без ПДВ (неплатник ПДВ)'

  // 06-ДОГОВІР-2 «Підстава»: проектний привʼязаний договір (якщо accepted) →
  // інакше останній accepted-договір компанії. Нема жодного — рядок не друкується.
  if (kind !== 'contract') {
    const projectContractId = order?.project?.contractDocumentId ?? null
    let contract = projectContractId
      ? await tx.document.findFirst({
          where: { id: projectContractId, status: 'accepted' },
          select: { number: true, contractDate: true, acceptedAt: true, generatedAt: true },
        })
      : null
    contract ??= await tx.document.findFirst({
      where: { companyId: doc.companyId, type: 'contract', status: 'accepted' },
      orderBy: { acceptedAt: 'desc' },
      select: { number: true, contractDate: true, acceptedAt: true, generatedAt: true },
    })
    if (contract) {
      const cDate = contract.contractDate ?? contract.acceptedAt ?? contract.generatedAt
      // зовнішні номери часто вже містять «№» — не дублюємо знак
      const n = contract.number.trim().startsWith('№')
        ? contract.number.trim()
        : `№ ${contract.number}`
      data.contractRef = `Договір ${n} від ${fmtDate(cDate)}`
    }
  }

  if (kind === 'invoice' || kind === 'advance_invoice') {
    const settings = await tx.paymentSettings.findUnique({
      where: { agencyId: doc.agencyId },
      select: { paymentTermsDays: true },
    })
    const terms = settings?.paymentTermsDays ?? 7
    data.dueDate = fmtDate(new Date(doc.generatedAt.getTime() + terms * 86_400_000))
    const advance = kind === 'advance_invoice' ? 'Авансова оплата' : 'Оплата'
    const subject = nomenclatureName ?? `послуги з розробки ПЗ (${data.orderTitle})`
    data.paymentPurpose = `${advance} за рахунком № ${doc.number} від ${data.date} за ${subject}. ${data.vatNote === 'без ПДВ (неплатник ПДВ)' ? 'Без ПДВ.' : 'З ПДВ.'}`
  }

  if (kind === 'completion_act' && order) {
    data.periodFrom = fmtDate(order.createdAt)
    data.periodTo = fmtDate(doc.generatedAt)
    const invoice = await tx.document.findFirst({
      where: { orderId: order.id, type: { in: ['invoice', 'advance_invoice'] } },
      orderBy: { generatedAt: 'desc' },
      select: { number: true, generatedAt: true },
    })
    if (invoice) data.basisRef = `Рахунок ${invoice.number} від ${fmtDate(invoice.generatedAt)}`
  }

  if (kind === 'specification') {
    data.description = order?.description ?? null
  }

  if (kind === 'reconciliation_act') {
    // Звірка по КОМПАНІЇ: нарахування (charges, без pending-гейта) = дебет,
    // підтверджені оплати = кредит. Суми «як записано» — мульти-валютні кейси
    // позначаються валютою документа (MVP-обмеження, задокументовано).
    const [charges, payments] = await Promise.all([
      tx.serviceCharge.findMany({
        where: { companyId: doc.companyId, approvalStatus: { not: 'pending' } },
        orderBy: { month: 'asc' },
        select: {
          month: true,
          kind: true,
          amount: true,
          totalAmount: true,
          project: { select: { name: true } },
        },
      }),
      tx.payment.findMany({
        where: { companyId: doc.companyId },
        orderBy: { confirmedAt: 'asc' },
        select: { confirmedAt: true, amount: true, paymentMethod: true },
      }),
    ])
    const ops: (ReconciliationRow & { at: number })[] = []
    let debit = 0
    let credit = 0
    for (const c of charges) {
      const v = Number(c.totalAmount ?? c.amount)
      debit += v
      ops.push({
        at: c.month.getTime(),
        date: fmtDate(c.month),
        doc: c.kind === 'subscription' ? 'нарахування' : c.kind,
        desc: c.project?.name ?? 'Разове нарахування',
        debit: fmtMoney(v),
        credit: null,
      })
    }
    for (const p of payments) {
      const v = Number(p.amount)
      credit += v
      ops.push({
        at: p.confirmedAt.getTime(),
        date: fmtDate(p.confirmedAt),
        doc: 'оплата',
        desc: p.paymentMethod ?? 'Платіж',
        debit: null,
        credit: fmtMoney(v),
      })
    }
    ops.sort((a, b) => a.at - b.at)
    data.operations = ops.map(({ at: _at, ...row }) => row)
    data.opening = fmtMoney(0)
    data.totalDebit = fmtMoney(debit)
    data.totalCredit = fmtMoney(credit)
    data.closing = fmtMoney(debit - credit)
    data.amount = fmtMoney(debit - credit)
    if (ops.length > 0) {
      data.periodFrom = ops[0]?.date
      data.periodTo = fmtDate(doc.generatedAt)
    }
  }

  if (kind === 'contract') {
    data.contractPlace = doc.legalEntity?.legalAddress?.split(',')[0]?.trim() || undefined
  }

  // 06-А: шаблон агенції накладається ПІСЛЯ повної збірки даних (щоб {{змінні}}
  // мали значення, включно з contractRef).
  const template = await tx.documentTemplate.findUnique({
    where: { agencyId_type: { agencyId: doc.agencyId, type: doc.type as never } },
    select: { body: true },
  })
  if (template) applyTemplate(data, doc.type, template.body)

  return data
}

/**
 * 06-SEND: зрендерити документ у email-вкладення (PDF; без Chromium — HTML).
 * Будь-який інший збій → null: лист піде без вкладення, доставку не валимо.
 */
export async function renderDocumentAttachmentById(
  docId: string
): Promise<{ filename: string; content: Buffer | string; contentType: string } | null> {
  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: {
        type: true,
        number: true,
        generatedAt: true,
        companyId: true,
        agencyId: true,
        agency: { select: { name: true } },
        order: {
          select: {
            id: true,
            title: true,
            description: true,
            totalAmount: true,
            approvedAmount: true,
            currency: true,
            createdAt: true,
            project: { select: { id: true, name: true, contractDocumentId: true } },
          },
        },
        company: { select: { name: true, legalName: true, taxId: true, legalAddress: true } },
        legalEntity: {
          select: {
            name: true,
            legalName: true,
            taxId: true,
            vatPayer: true,
            legalAddress: true,
            bankName: true,
            iban: true,
            signerName: true,
            signerTitle: true,
          },
        },
      },
    })
    if (!doc) return null
    const data = await buildRenderData(prisma as unknown as Prisma.TransactionClient, doc)
    data.branding = await loadPdfBranding(doc.agencyId, doc.agency.name)
    const html = renderDocumentHtml(doc.type as DocumentKind, data)
    const safeName = doc.number.replace(/[^\w.-]+/g, '_') || 'document'
    try {
      return {
        filename: `${safeName}.pdf`,
        content: await htmlToPdf(html),
        contentType: 'application/pdf',
      }
    } catch (err) {
      if (err instanceof ChromiumUnavailableError) {
        return { filename: `${safeName}.html`, content: html, contentType: 'text/html' }
      }
      throw err
    }
  } catch {
    return null
  }
}
