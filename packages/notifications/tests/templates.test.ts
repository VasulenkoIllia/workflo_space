import { describe, expect, it } from 'vitest'
import {
  renderInviteCompanyMemberEmail,
  renderInviteExecutorEmail,
  renderInvoiceSentEmail,
  renderNewCommentEmail,
  renderOrderStatusChangedEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  renderOrderCreatedEmail,
  renderOrderAssignedEmail,
  renderApprovalRequestedEmail,
  renderApprovalDecidedEmail,
  renderDocumentSentEmail,
  renderPaymentReceivedEmail,
} from '../src/email/templates/index.js'
import {
  renderInviteCompanyMemberTelegram,
  renderInviteExecutorTelegram,
  renderInvoiceSentTelegram,
  renderNewCommentTelegram,
  renderOrderStatusChangedTelegram,
  renderPasswordResetTelegram,
  renderWelcomeTelegram,
  renderApprovalRequestedTelegram,
  renderPaymentReceivedTelegram,
} from '../src/telegram/templates/index.js'

describe('email templates', () => {
  it('welcome: renders both subject and html in Ukrainian', () => {
    const r = renderWelcomeEmail({ name: 'Іван', portalUrl: 'https://portal.workflo.space' })
    expect(r.subject).toBe('Ласкаво просимо у Workflo')
    expect(r.html).toContain('Іван')
    expect(r.html).toContain('https://portal.workflo.space')
  })

  it('welcome: english variant', () => {
    const r = renderWelcomeEmail({ name: 'Bob', portalUrl: 'https://x', locale: 'en' })
    expect(r.subject).toBe('Welcome to Workflo')
    expect(r.html).toContain('Bob')
  })

  it('welcome: handles empty name with anonymous greeting', () => {
    const r = renderWelcomeEmail({ name: '', portalUrl: 'https://x' })
    expect(r.html).toContain('Привіт!')
  })

  it('inviteExecutor: contains inviter name and expiry', () => {
    const r = renderInviteExecutorEmail({
      inviterName: 'Olena',
      acceptUrl: 'https://accept',
      expiresAt: '2026-04-25 14:00',
    })
    expect(r.subject).toBe('Запрошення приєднатися до Workflo Workspace')
    expect(r.html).toContain('Olena')
    expect(r.html).toContain('2026-04-25 14:00')
  })

  it('inviteCompanyMember: subject contains companyName', () => {
    const r = renderInviteCompanyMemberEmail({
      inviterName: 'Olena',
      companyName: 'Acme LLC',
      acceptUrl: 'https://accept',
    })
    expect(r.subject).toContain('Acme LLC')
    expect(r.html).toContain('Olena')
  })

  it('passwordReset: contains "Скидання" header', () => {
    const r = renderPasswordResetEmail({ resetUrl: 'https://reset' })
    expect(r.subject).toContain('Скидання')
    expect(r.html).toContain('https://reset')
  })

  it('passwordReset: english variant says "НЕ" warning equivalent', () => {
    const r = renderPasswordResetEmail({ resetUrl: 'https://reset', locale: 'en' })
    expect(r.html).toContain('did NOT request')
  })

  it('orderStatusChanged: maps the client status to a human label + links the order', () => {
    const r = renderOrderStatusChangedEmail({
      orderTitle: 'Лендінг',
      orderUrl: 'https://portal/tasks/o1',
      newClientStatus: 'pending_approval',
    })
    expect(r.subject).toContain('Лендінг')
    expect(r.html).toContain('Очікує погодження') // status code → label
    expect(r.html).toContain('https://portal/tasks/o1')
  })

  it('orderStatusChanged: falls back to the raw code for an unmapped status', () => {
    const r = renderOrderStatusChangedEmail({
      orderTitle: 'X',
      orderUrl: 'https://x',
      newClientStatus: 'weird_status',
    })
    expect(r.html).toContain('weird_status')
  })

  it('newComment: shows author, order, quoted preview + reply link', () => {
    const r = renderNewCommentEmail({
      orderTitle: 'Бот',
      authorName: 'Олена',
      preview: 'Готово до перевірки',
      orderUrl: 'https://portal/tasks/o2',
    })
    expect(r.subject).toContain('Бот')
    expect(r.html).toContain('Олена')
    expect(r.html).toContain('Готово до перевірки')
    expect(r.html).toContain('https://portal/tasks/o2')
  })

  it('invoiceSent: includes number, amount, due date + pay link', () => {
    const r = renderInvoiceSentEmail({
      invoiceNumber: 'INV-2026-000001',
      amount: '12 000,00 UAH',
      dueDate: '01.07.2026',
      invoiceUrl: 'https://portal/invoices/i1',
    })
    expect(r.subject).toContain('INV-2026-000001')
    expect(r.html).toContain('12 000,00 UAH')
    expect(r.html).toContain('01.07.2026')
    expect(r.html).toContain('https://portal/invoices/i1')
  })

  it('all templates escape HTML in user-supplied vars', () => {
    const r = renderInviteCompanyMemberEmail({
      inviterName: '<script>alert(1)</script>',
      companyName: 'Acme & Co',
      acceptUrl: 'https://accept',
    })
    expect(r.html).not.toContain('<script>alert(1)</script>')
    expect(r.html).toContain('&lt;script&gt;')
    expect(r.html).toContain('Acme &amp; Co')
  })

  it('newComment: escapes HTML in the comment preview (user content)', () => {
    const r = renderNewCommentEmail({
      orderTitle: 'X',
      authorName: 'A',
      preview: '<img src=x onerror=alert(1)>',
      orderUrl: 'https://x',
    })
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).toContain('&lt;img')
  })
})

describe('telegram templates', () => {
  it('welcome: uses HTML parse mode', () => {
    const r = renderWelcomeTelegram({ name: 'Іван', portalUrl: 'https://portal' })
    expect(r.parseMode).toBe('HTML')
    expect(r.text).toContain('Іван')
  })

  it('passwordReset: includes anti-phishing reminder', () => {
    const r = renderPasswordResetTelegram({ resetUrl: 'https://reset' })
    expect(r.text).toContain('НЕ запитували')
  })

  it('orderStatusChanged: contains title and status', () => {
    const r = renderOrderStatusChangedTelegram({
      orderTitle: 'Land migration',
      orderUrl: 'https://workspace/orders/1',
      newClientStatus: 'У роботі',
    })
    expect(r.text).toContain('Land migration')
    expect(r.text).toContain('У роботі')
  })

  it('newComment: truncates preview at 200 chars', () => {
    const longPreview = 'z'.repeat(300)
    const r = renderNewCommentTelegram({
      orderTitle: 'Title',
      authorName: 'Bob',
      preview: longPreview,
      orderUrl: 'https://workflo.test/orders/1',
    })
    expect(r.text).toContain('…')
    // preview is truncated to exactly 200 chars (+ ellipsis); 'z' appears
    // nowhere else in the template so the count is unambiguous.
    const zCount = (r.text.match(/z/g) ?? []).length
    expect(zCount).toBe(200)
  })

  it('invoiceSent: includes amount + due date', () => {
    const r = renderInvoiceSentTelegram({
      invoiceNumber: 'INV-2026-001',
      amount: '$ 1,200.00',
      dueDate: '2026-04-25',
      invoiceUrl: 'https://invoice',
    })
    expect(r.text).toContain('INV-2026-001')
    expect(r.text).toContain('$ 1,200.00')
    expect(r.text).toContain('2026-04-25')
  })

  it('escapes HTML in user-supplied text', () => {
    const r = renderNewCommentTelegram({
      orderTitle: 'A <b>bold</b> title',
      authorName: 'A & B',
      preview: '<i>italic</i>',
      orderUrl: 'https://x',
    })
    expect(r.text).not.toContain('<b>bold</b>')
    expect(r.text).toContain('&lt;b&gt;bold&lt;/b&gt;')
    expect(r.text).toContain('A &amp; B')
  })

  it('inviteExecutor: has CTA link', () => {
    const r = renderInviteExecutorTelegram({
      inviterName: 'Olena',
      acceptUrl: 'https://accept',
    })
    expect(r.text).toContain('Olena')
    expect(r.text).toContain('https://accept')
  })

  it('inviteCompanyMember: includes companyName', () => {
    const r = renderInviteCompanyMemberTelegram({
      inviterName: 'Olena',
      companyName: 'Acme',
      acceptUrl: 'https://accept',
    })
    expect(r.text).toContain('Acme')
  })
})

describe('email templates — блок 03.07 (події без листів)', () => {
  it('orderCreated: назва + лінк у workspace', () => {
    const r = renderOrderCreatedEmail({ orderTitle: 'CRM 1C', orderUrl: 'https://w/orders/1' })
    expect(r.subject).toContain('CRM 1C')
    expect(r.html).toContain('https://w/orders/1')
    expect(r.html).toContain('тріаж')
  })

  it('orderAssigned: виконавцю з CTA', () => {
    const r = renderOrderAssignedEmail({ orderTitle: 'Бот', orderUrl: 'https://w/orders/2' })
    expect(r.subject).toBe('Вам призначено замовлення')
    expect(r.html).toContain('Бот')
    expect(r.html).toContain('https://w/orders/2')
  })

  it('approvalRequested: CTA «Погодити оцінку» веде у портал', () => {
    const r = renderApprovalRequestedEmail({ orderTitle: 'Сайт', orderUrl: 'https://p/orders/3' })
    expect(r.subject).toContain('Погодьте оцінку')
    expect(r.html).toContain('Погодити оцінку')
    expect(r.html).toContain('https://p/orders/3')
  })

  it('approvalDecided: approved-варіант', () => {
    const r = renderApprovalDecidedEmail({
      orderTitle: 'Сайт',
      orderUrl: 'https://w/orders/3',
      approved: true,
    })
    expect(r.subject).toContain('погоджено')
    expect(r.html).not.toContain('Коментар клієнта')
  })

  it('approvalDecided: rejected з коментарем клієнта', () => {
    const r = renderApprovalDecidedEmail({
      orderTitle: 'Сайт',
      orderUrl: 'https://w/orders/3',
      approved: false,
      comment: 'Дорого',
    })
    expect(r.subject).toContain('правки')
    expect(r.html).toContain('Дорого')
  })

  it('documentSent: лейбл + номер + CTA', () => {
    const r = renderDocumentSentEmail({
      documentLabel: 'Акт виконаних робіт',
      documentNumber: 'ACT-2026-000001',
      documentUrl: 'https://p/orders/1',
    })
    expect(r.subject).toContain('ACT-2026-000001')
    expect(r.html).toContain('Акт виконаних робіт')
  })

  it('paymentReceived: сума + метод + en-варіант', () => {
    const uk = renderPaymentReceivedEmail({
      amount: '1 200,00 USD',
      method: 'bank_transfer',
      portalUrl: 'https://p/billing',
    })
    expect(uk.subject).toContain('1 200,00 USD')
    expect(uk.html).toContain('bank_transfer')
    const en = renderPaymentReceivedEmail({ amount: '5 USD', portalUrl: 'https://p', locale: 'en' })
    expect(en.subject).toBe('Payment received — 5 USD')
    expect(en.html).not.toContain('Спосіб оплати')
  })

  it('telegram: approvalRequested + paymentReceived рендеряться', () => {
    const a = renderApprovalRequestedTelegram({ orderTitle: 'X<b>', orderUrl: 'https://p' })
    expect(a.text).toContain('Погодити оцінку')
    expect(a.text).toContain('&lt;b&gt;') // escapeHtml
    const b = renderPaymentReceivedTelegram({ amount: '5 USD', portalUrl: 'https://p' })
    expect(b.text).toContain('Оплату отримано')
  })
})
