import { bold, escapeHtml, italic, link } from '../escape.js'
import type { LocaleKey } from '../../email/i18n.js'

export interface RenderedTelegram {
  text: string
  parseMode: 'HTML'
  disableWebPagePreview?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// AUTH category
// ────────────────────────────────────────────────────────────────────────────

export function renderWelcomeTelegram(opts: {
  name: string
  portalUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const greet = opts.name ? `👋 ${bold(`Привіт, ${opts.name}!`)}` : `👋 ${bold('Привіт!')}`
  const body =
    opts.locale === 'en'
      ? `Welcome to Workflo! Sign in to your portal: ${link('open portal', opts.portalUrl)}`
      : `Ласкаво просимо у Workflo! Увійдіть у свій кабінет: ${link('відкрити portal', opts.portalUrl)}`
  return { text: `${greet}\n\n${body}`, parseMode: 'HTML' }
}

export function renderInviteExecutorTelegram(opts: {
  inviterName: string
  acceptUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `${bold('Workflo Workspace invite')}\n\n${escapeHtml(opts.inviterName)} invited you as an executor. ${link('Accept', opts.acceptUrl)}`
      : `${bold('Запрошення до Workflo Workspace')}\n\n${escapeHtml(opts.inviterName)} запросив(ла) вас як виконавця. ${link('Прийняти', opts.acceptUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderInviteCompanyMemberTelegram(opts: {
  inviterName: string
  companyName: string
  acceptUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `${bold(`Invitation to ${opts.companyName}`)}\n\n${escapeHtml(opts.inviterName)} invites you to join. ${link('Accept', opts.acceptUrl)}`
      : `${bold(`Запрошення до ${opts.companyName}`)}\n\n${escapeHtml(opts.inviterName)} запрошує вас приєднатися. ${link('Прийняти', opts.acceptUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderPasswordResetTelegram(opts: {
  resetUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  // Per ADR-003: password_reset is also email-critical. Telegram message is
  // an ADDITIONAL channel if user has it enabled. We include the reset link
  // here for convenience but the email is canonical.
  const text =
    opts.locale === 'en'
      ? `${bold('Reset your password')}\n\nIf you requested a reset, ${link('click here', opts.resetUrl)}. Link is valid for 1 hour.\n\n${italic('If you did NOT request a reset, ignore this message.')}`
      : `${bold('Скидання пароля')}\n\nЯкщо ви запитували скидання, ${link('натисніть тут', opts.resetUrl)}. Посилання діє 1 годину.\n\n${italic('Якщо ви НЕ запитували — проігноруйте це повідомлення.')}`
  return { text, parseMode: 'HTML' }
}

// ────────────────────────────────────────────────────────────────────────────
// ORDERS category
// ────────────────────────────────────────────────────────────────────────────

export function renderOrderStatusChangedTelegram(opts: {
  orderTitle: string
  orderUrl: string
  newClientStatus: string // already-translated label like "У роботі"
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `📋 ${bold('Order status changed')}\n${escapeHtml(opts.orderTitle)} → ${bold(opts.newClientStatus)}\n${link('Open order', opts.orderUrl)}`
      : `📋 ${bold('Статус замовлення змінено')}\n${escapeHtml(opts.orderTitle)} → ${bold(opts.newClientStatus)}\n${link('Відкрити замовлення', opts.orderUrl)}`
  return { text, parseMode: 'HTML' }
}

// ────────────────────────────────────────────────────────────────────────────
// CHAT category
// ────────────────────────────────────────────────────────────────────────────

export function renderNewCommentTelegram(opts: {
  orderTitle: string
  authorName: string
  preview: string // first 200 chars of comment
  orderUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const preview = opts.preview.length > 200 ? `${opts.preview.slice(0, 200)}…` : opts.preview
  const text =
    opts.locale === 'en'
      ? `💬 ${bold('New comment')}\n${escapeHtml(opts.orderTitle)} — ${italic(opts.authorName)}\n${escapeHtml(preview)}\n${link('Open chat', opts.orderUrl)}`
      : `💬 ${bold('Новий коментар')}\n${escapeHtml(opts.orderTitle)} — ${italic(opts.authorName)}\n${escapeHtml(preview)}\n${link('Відкрити чат', opts.orderUrl)}`
  return { text, parseMode: 'HTML' }
}

// ────────────────────────────────────────────────────────────────────────────
// BILLING category
// ────────────────────────────────────────────────────────────────────────────

export function renderInvoiceSentTelegram(opts: {
  invoiceNumber: string
  amount: string // pre-formatted: "$ 1,200.00" or "₴ 49 000.00"
  dueDate: string // pre-formatted: "2026-04-25"
  invoiceUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `💳 ${bold(`Invoice #${opts.invoiceNumber}`)}\nAmount: ${bold(opts.amount)} (due ${escapeHtml(opts.dueDate)})\n${link('View invoice', opts.invoiceUrl)}`
      : `💳 ${bold(`Рахунок #${opts.invoiceNumber}`)}\nСума: ${bold(opts.amount)} (до ${escapeHtml(opts.dueDate)})\n${link('Переглянути рахунок', opts.invoiceUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderOrderCreatedTelegram(opts: {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `🆕 ${bold('New order')}\n${escapeHtml(opts.orderTitle)}\n${link('Open order', opts.orderUrl)}`
      : `🆕 ${bold('Нове замовлення')}\n${escapeHtml(opts.orderTitle)}\n${link('Відкрити замовлення', opts.orderUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderOrderAssignedTelegram(opts: {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `👤 ${bold('You were assigned')}\n${escapeHtml(opts.orderTitle)}\n${link('Open order', opts.orderUrl)}`
      : `👤 ${bold('Вас призначено виконавцем')}\n${escapeHtml(opts.orderTitle)}\n${link('Відкрити замовлення', opts.orderUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderApprovalRequestedTelegram(opts: {
  orderTitle: string
  orderUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `✅ ${bold('Estimate awaits your approval')}\n${escapeHtml(opts.orderTitle)}\n${link('Approve estimate', opts.orderUrl)}`
      : `✅ ${bold('Оцінка чекає на погодження')}\n${escapeHtml(opts.orderTitle)}\n${link('Погодити оцінку', opts.orderUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderApprovalDecidedTelegram(opts: {
  orderTitle: string
  orderUrl: string
  approved: boolean
  comment?: string | null
  locale?: LocaleKey
}): RenderedTelegram {
  const head =
    opts.locale === 'en'
      ? opts.approved
        ? `👍 ${bold('Estimate approved')}`
        : `✍️ ${bold('Client requested changes')}`
      : opts.approved
        ? `👍 ${bold('Оцінку погоджено')}`
        : `✍️ ${bold('Клієнт запросив правки')}`
  const comment = !opts.approved && opts.comment ? `\n${italic(escapeHtml(opts.comment))}` : ''
  const cta =
    opts.locale === 'en'
      ? link('Open order', opts.orderUrl)
      : link('Відкрити замовлення', opts.orderUrl)
  return {
    text: `${head}\n${escapeHtml(opts.orderTitle)}${comment}\n${cta}`,
    parseMode: 'HTML',
  }
}

export function renderDocumentSentTelegram(opts: {
  documentLabel: string
  documentNumber: string
  documentUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const text =
    opts.locale === 'en'
      ? `📄 ${bold('New document')}\n${escapeHtml(opts.documentLabel)} ${escapeHtml(opts.documentNumber)}\n${link('View document', opts.documentUrl)}`
      : `📄 ${bold('Новий документ')}\n${escapeHtml(opts.documentLabel)} ${escapeHtml(opts.documentNumber)}\n${link('Переглянути документ', opts.documentUrl)}`
  return { text, parseMode: 'HTML' }
}

export function renderPaymentReceivedTelegram(opts: {
  amount: string
  method?: string | null
  portalUrl: string
  locale?: LocaleKey
}): RenderedTelegram {
  const method = opts.method ? ` · ${escapeHtml(opts.method)}` : ''
  const text =
    opts.locale === 'en'
      ? `💸 ${bold('Payment received')}\n${escapeHtml(opts.amount)}${method}\n${link('Open portal', opts.portalUrl)}`
      : `💸 ${bold('Оплату отримано')}\n${escapeHtml(opts.amount)}${method}\n${link('Відкрити кабінет', opts.portalUrl)}`
  return { text, parseMode: 'HTML' }
}
