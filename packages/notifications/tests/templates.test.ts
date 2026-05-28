import { describe, expect, it } from 'vitest'
import {
  renderInviteCompanyMemberEmail,
  renderInviteExecutorEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from '../src/email/templates/index.js'
import {
  renderInviteCompanyMemberTelegram,
  renderInviteExecutorTelegram,
  renderInvoiceSentTelegram,
  renderNewCommentTelegram,
  renderOrderStatusChangedTelegram,
  renderPasswordResetTelegram,
  renderWelcomeTelegram,
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
