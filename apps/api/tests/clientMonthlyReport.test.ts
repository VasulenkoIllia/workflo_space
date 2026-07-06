import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// ─── Mock @workflo/db ────────────────────────────────────────────────────────
const agencyFindMany = vi.fn()
const agencyUpdate = vi.fn()
const agencyMemberFindFirst = vi.fn()
const orderFindMany = vi.fn()
const activityLogFindMany = vi.fn()
const timeLogFindMany = vi.fn()
const paymentFindMany = vi.fn()
const companyFindUnique = vi.fn()
const companyMemberFindMany = vi.fn()
const documentCreate = vi.fn()
const queryRaw = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: {
    agency: { findMany: agencyFindMany, update: agencyUpdate },
    agencyMember: { findFirst: agencyMemberFindFirst },
    order: { findMany: orderFindMany },
    activityLog: { findMany: activityLogFindMany },
    timeLog: { findMany: timeLogFindMany },
    payment: { findMany: paymentFindMany },
    company: { findUnique: companyFindUnique },
    companyMember: { findMany: companyMemberFindMany },
    document: { create: documentCreate },
    $queryRaw: queryRaw,
  },
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {},
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  },
  runWithSystemContext: (fn: () => unknown) => fn(),
}))

const sendMail = vi.fn().mockResolvedValue({})
vi.mock('@workflo/notifications', () => ({
  notify: vi.fn(),
  getMailer: () => ({ sendMail }),
  getActiveFrom: () => ({ name: 'workflo', address: 'no-reply@workflo.space' }),
  renderClientMonthlyReportEmail: (v: { periodLabel: string; agencyName: string }) => ({
    subject: `Місячний звіт — ${v.periodLabel} — ${v.agencyName}`,
    html: '<p>report</p>',
  }),
}))
vi.mock('@workflo/templates', () => ({
  renderClientMonthlyReportHtml: vi.fn().mockReturnValue('<html>report</html>'),
  htmlToPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-fake')),
  ChromiumUnavailableError: class extends Error {},
}))

const { runClientMonthlyReportOnce } = await import('../src/cron/clientMonthlyReport.js')
const { computeClientMonthlyNumbers } = await import('../src/services/clientMonthlyReport.js')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as any
const NOW = new Date('2026-07-06T10:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  agencyUpdate.mockResolvedValue({})
  orderFindMany.mockResolvedValue([])
  activityLogFindMany.mockResolvedValue([])
  timeLogFindMany.mockResolvedValue([])
  paymentFindMany.mockResolvedValue([])
  queryRaw.mockResolvedValue([])
  companyMemberFindMany.mockResolvedValue([])
  agencyMemberFindFirst.mockResolvedValue({ profileId: 'owner-1' })
  documentCreate.mockResolvedValue({
    id: 'doc-1',
    number: 'RPT-2026-000001',
    generatedAt: NOW,
  })
  sendMail.mockResolvedValue({})
})

describe('computeClientMonthlyNumbers (19-Г)', () => {
  const OPTS = {
    agencyId: 'ag-1',
    companyId: 'co-1',
    from: new Date('2026-06-01T00:00:00Z'),
    to: new Date('2026-07-01T00:00:00Z'),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = () =>
    ({
      order: { findMany: orderFindMany },
      activityLog: { findMany: activityLogFindMany },
      timeLog: { findMany: timeLogFindMany },
      payment: { findMany: paymentFindMany },
      $queryRaw: queryRaw,
    }) as any

  it('aggregates orders, doneAt-from-activity, hours by project, per-currency money', async () => {
    orderFindMany.mockResolvedValue([
      { title: 'Лендінг', totalAmount: 500, fixedPrice: null, currency: 'USD' },
      { title: 'Бот', totalAmount: null, fixedPrice: null, currency: 'USD' },
    ])
    activityLogFindMany.mockResolvedValue([
      { orderId: 'o-1', metadata: { to: 'done' }, order: { title: 'Стара задача' } },
      { orderId: 'o-1', metadata: { to: 'done' }, order: { title: 'Стара задача' } }, // дубль
      { orderId: 'o-2', metadata: { to: 'in_progress' }, order: { title: 'Не done' } },
    ])
    timeLogFindMany.mockResolvedValue([
      { hours: 2.5, order: { project: { name: 'Сайт' } } },
      { hours: 1.5, order: { project: { name: 'Сайт' } } },
      { hours: 1, order: { project: null } },
    ])
    paymentFindMany.mockResolvedValue([
      { amount: 300, currency: 'USD' },
      { amount: 8000, currency: 'UAH' },
    ])
    queryRaw.mockResolvedValue([{ currency: 'USD', debt: 200 }])

    const r = await computeClientMonthlyNumbers(db(), OPTS)
    expect(r.newOrders).toEqual([
      { title: 'Лендінг', amount: '500 USD' },
      { title: 'Бот', amount: null },
    ])
    expect(r.completedOrders).toEqual([{ title: 'Стара задача' }])
    expect(r.hoursByProject).toEqual([
      { project: 'Сайт', hours: 4 },
      { project: '(без проєкту)', hours: 1 },
    ])
    expect(r.totalHours).toBe(5)
    expect(r.paid).toEqual({ USD: 300, UAH: 8000 })
    expect(r.debt).toEqual({ USD: 200 })
    expect(r.hasActivity).toBe(true)
  })

  it('flags no activity when the month is empty', async () => {
    const r = await computeClientMonthlyNumbers(db(), OPTS)
    expect(r.hasActivity).toBe(false)
  })
})

describe('runClientMonthlyReportOnce (19-Г)', () => {
  it('does nothing without enabled agencies', async () => {
    agencyFindMany.mockResolvedValue([])
    const sent = await runClientMonthlyReportOnce(logger, NOW)
    expect(sent).toBe(0)
    expect(sendMail).not.toHaveBeenCalled()
  })

  it('creates a document and mails the PDF to documentEmail (+cc), stamps lastSentAt', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'ag-1', name: 'Workflo' }])
    // активність: одне замовлення за місяць у компанії co-1
    orderFindMany
      .mockResolvedValueOnce([{ companyId: 'co-1' }]) // distinct companies (orders)
      .mockResolvedValue([
        { title: 'Лендінг', totalAmount: 500, fixedPrice: null, currency: 'USD' },
      ])
    companyFindUnique.mockResolvedValue({
      id: 'co-1',
      name: 'ТОВ Тест',
      documentEmail: 'buh@client.com',
      documentEmailCc: 'cc@client.com',
    })

    const sent = await runClientMonthlyReportOnce(logger, NOW)
    expect(sent).toBe(1)

    // Документ: monthly_report без замовлення, статус sent
    const docArg = documentCreate.mock.calls[0][0].data
    expect(docArg.type).toBe('monthly_report')
    expect(docArg.order).toBeUndefined()
    expect(docArg.status).toBe('sent')

    // Лист: на documentEmail з cc і PDF-вкладенням
    const mail = sendMail.mock.calls[0][0]
    expect(mail.to).toBe('buh@client.com')
    expect(mail.cc).toBe('cc@client.com')
    expect(mail.subject).toContain('Місячний звіт')
    expect(mail.attachments[0].filename).toBe('RPT-2026-000001.pdf')
    expect(mail.attachments[0].contentType).toBe('application/pdf')

    expect(agencyUpdate).toHaveBeenCalledWith({
      where: { id: 'ag-1' },
      data: { clientMonthlyReportLastSentAt: NOW },
    })
  })

  it('falls back to company owners when documentEmail is empty; skips inactive companies', async () => {
    agencyFindMany.mockResolvedValue([{ id: 'ag-1', name: 'Workflo' }])
    orderFindMany
      .mockResolvedValueOnce([{ companyId: 'co-1' }, { companyId: 'co-2' }])
      // co-1: активне замовлення; co-2: порожньо
      .mockResolvedValueOnce([{ title: 'A', totalAmount: 100, fixedPrice: null, currency: 'USD' }])
      .mockResolvedValueOnce([])
    companyFindUnique
      .mockResolvedValueOnce({ id: 'co-1', name: 'A', documentEmail: null, documentEmailCc: null })
      .mockResolvedValueOnce({ id: 'co-2', name: 'B', documentEmail: null, documentEmailCc: null })
    companyMemberFindMany.mockResolvedValue([
      { profile: { email: 'owner@client.com' } },
      { profile: { email: 'second@client.com' } },
    ])

    const sent = await runClientMonthlyReportOnce(logger, NOW)
    expect(sent).toBe(1) // co-2 без активності — пропущено
    const mail = sendMail.mock.calls[0][0]
    expect(mail.to).toBe('owner@client.com')
    expect(mail.cc).toBe('second@client.com')
  })
})
