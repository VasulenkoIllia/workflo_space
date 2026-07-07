import { NotificationChannel, type NotificationEvent } from '@workflo/types'
import { type EmailPayload, type EmailSendResult, sendEmail } from './adapters/EmailAdapter.js'
import {
  type TelegramPayload,
  type TelegramSendResult,
  sendTelegram,
} from './adapters/TelegramAdapter.js'
import type { LocaleKey } from './email/i18n.js'
import {
  renderApprovalDecidedEmail,
  renderApprovalRequestedEmail,
  renderDocumentSentEmail,
  renderInviteCompanyMemberEmail,
  renderInviteExecutorEmail,
  renderInvoiceSentEmail,
  renderPaymentReminderEmail,
  renderDunningEscalationEmail,
  renderMentionedEmail,
  renderNewCommentEmail,
  renderOrderAssignedEmail,
  renderOrderCreatedEmail,
  renderOrderStatusChangedEmail,
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderPaymentReceivedEmail,
  renderWelcomeEmail,
  type RenderedEmail,
  renderMagicLinkEmail,
  renderEmailChangeConfirmEmail,
  renderEmailChangeRequestedEmail,
  renderMonthlyReportEmail,
} from './email/templates/index.js'
import {
  renderApprovalDecidedTelegram,
  renderApprovalRequestedTelegram,
  renderDocumentSentTelegram,
  renderInviteCompanyMemberTelegram,
  renderInviteExecutorTelegram,
  renderInvoiceSentTelegram,
  renderMentionedTelegram,
  renderNewCommentTelegram,
  renderOrderAssignedTelegram,
  renderOrderCreatedTelegram,
  renderOrderStatusChangedTelegram,
  renderEmailVerificationTelegram,
  renderPasswordResetTelegram,
  renderPaymentReceivedTelegram,
  renderWelcomeTelegram,
  type RenderedTelegram,
} from './telegram/templates/index.js'

/**
 * Recipient block — every dispatch needs at least an email address; telegramChatId
 * is optional and only used when the resolver picks the telegram channel.
 */
export interface Recipient {
  email: string
  telegramChatId?: string | null
  name?: string
  locale?: LocaleKey
}

/**
 * Per-event payload union. Keys are the event ID literal; values are the
 * variables the corresponding renderer expects (sans Recipient).
 *
 * Only events that have actual templates in S1 are typed here. Other events
 * still flow through `dispatch()` but fall through to "no template" branches
 * which the dispatcher logs as `status: 'skipped'`.
 */
export type EventPayloadMap = {
  'auth.welcome': { portalUrl: string }
  'auth.password_reset': { resetUrl: string }
  'auth.email_verification': { verifyUrl: string }
  'auth.magic_link': { loginUrl: string }
  'auth.email_change_confirm': { confirmUrl: string }
  'auth.email_change_requested': { newEmail: string }
  'reports.monthly': { periodLabel: string; rows: [string, string][] }
  // One event, two templates: companyName present → company-member invite,
  // else executor invite (expiresAt used by the executor template).
  'system.invite_sent': {
    inviterName: string
    acceptUrl: string
    companyName?: string
    expiresAt?: string
  }
  'orders.status_changed': { orderTitle: string; orderUrl: string; newClientStatus: string }
  'chat.new_comment': { orderTitle: string; authorName: string; preview: string; orderUrl: string }
  'chat.mentioned': { orderTitle: string; authorName: string; preview: string; orderUrl: string }
  'billing.invoice_sent': {
    invoiceNumber: string
    amount: string
    dueDate: string
    invoiceUrl: string
  }
  'orders.created': { orderTitle: string; orderUrl: string }
  'orders.assigned': { orderTitle: string; orderUrl: string }
  'orders.approval_requested': { orderTitle: string; orderUrl: string }
  'orders.approval_decided': {
    orderTitle: string
    orderUrl: string
    approved: boolean
    comment?: string | null
  }
  'documents.completion_act_ready': {
    documentLabel: string
    documentNumber: string
    documentUrl: string
  }
  'billing.invoice_paid': { amount: string; method?: string | null; portalUrl: string }
  // 05-Б дунінг: нагадування клієнту (фаза задає тон листа)
  'billing.payment_reminder': {
    amountDue: string
    dueDateLabel: string
    phase: 'upcoming' | 'due' | 'overdue'
    daysOverdue: number
    periodLabel?: string | null
    portalUrl: string
  }
  // 05-Б ескалація власнику: ланцюжок вичерпано, клієнт не платить
  'billing.invoice_overdue': {
    companyName: string
    amountDue: string
    daysOverdue: number
    clientUrl: string
  }
}

export type DispatchResult =
  | { channel: NotificationChannel.EMAIL; result: EmailSendResult }
  | { channel: NotificationChannel.TELEGRAM; result: TelegramSendResult }
  | { channel: NotificationChannel; result: { status: 'skipped'; reason: string } }

// ─── Email rendering router ─────────────────────────────────────────────────
export function renderEmailForEvent(
  event: NotificationEvent,
  recipient: Recipient,
  vars: Record<string, unknown>
): RenderedEmail | null {
  const locale: LocaleKey = recipient.locale ?? 'uk'
  // The `as` casts below are now genuinely backed: the public notify()/
  // notifyRecipient()/dispatchNotification() boundary is generic over the event
  // (NotifyVars<E>), so a literal-event caller cannot pass mismatched vars. This
  // router only re-narrows the widened record it receives internally.
  switch (event) {
    case 'auth.welcome':
      return renderWelcomeEmail({
        name: recipient.name ?? '',
        portalUrl: (vars as EventPayloadMap['auth.welcome']).portalUrl,
        locale,
      })
    case 'auth.password_reset':
      return renderPasswordResetEmail({
        resetUrl: (vars as EventPayloadMap['auth.password_reset']).resetUrl,
        locale,
      })
    case 'auth.email_verification':
      return renderEmailVerificationEmail({
        verifyUrl: (vars as EventPayloadMap['auth.email_verification']).verifyUrl,
        locale,
      })
    case 'auth.magic_link':
      return renderMagicLinkEmail({
        loginUrl: (vars as EventPayloadMap['auth.magic_link']).loginUrl,
        locale,
      })
    case 'auth.email_change_confirm':
      return renderEmailChangeConfirmEmail({
        confirmUrl: (vars as EventPayloadMap['auth.email_change_confirm']).confirmUrl,
        locale,
      })
    case 'auth.email_change_requested':
      return renderEmailChangeRequestedEmail({
        newEmail: (vars as EventPayloadMap['auth.email_change_requested']).newEmail,
        locale,
      })
    case 'reports.monthly': {
      const v = vars as EventPayloadMap['reports.monthly']
      return renderMonthlyReportEmail({ periodLabel: v.periodLabel, rows: v.rows, locale })
    }
    case 'system.invite_sent': {
      // One event, two templates — disambiguated by presence of companyName.
      const v = vars as {
        inviterName: string
        acceptUrl: string
        companyName?: string
        expiresAt?: string
      }
      if (v.companyName) {
        return renderInviteCompanyMemberEmail({
          inviterName: v.inviterName,
          companyName: v.companyName,
          acceptUrl: v.acceptUrl,
          locale,
        })
      }
      return renderInviteExecutorEmail({
        inviterName: v.inviterName,
        acceptUrl: v.acceptUrl,
        expiresAt: v.expiresAt ?? '',
        locale,
      })
    }
    case 'orders.status_changed': {
      const v = vars as EventPayloadMap['orders.status_changed']
      return renderOrderStatusChangedEmail({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        newClientStatus: v.newClientStatus,
        locale,
      })
    }
    case 'chat.new_comment': {
      const v = vars as EventPayloadMap['chat.new_comment']
      return renderNewCommentEmail({
        orderTitle: v.orderTitle,
        authorName: v.authorName,
        preview: v.preview,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'chat.mentioned': {
      const v = vars as EventPayloadMap['chat.mentioned']
      return renderMentionedEmail({
        orderTitle: v.orderTitle,
        authorName: v.authorName,
        preview: v.preview,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'billing.invoice_sent': {
      const v = vars as EventPayloadMap['billing.invoice_sent']
      return renderInvoiceSentEmail({
        invoiceNumber: v.invoiceNumber,
        amount: v.amount,
        dueDate: v.dueDate,
        invoiceUrl: v.invoiceUrl,
        locale,
      })
    }
    case 'billing.payment_reminder': {
      const v = vars as EventPayloadMap['billing.payment_reminder']
      return renderPaymentReminderEmail({
        amountDue: v.amountDue,
        dueDateLabel: v.dueDateLabel,
        phase: v.phase,
        daysOverdue: v.daysOverdue,
        periodLabel: v.periodLabel,
        portalUrl: v.portalUrl,
        locale,
      })
    }
    case 'billing.invoice_overdue': {
      const v = vars as EventPayloadMap['billing.invoice_overdue']
      return renderDunningEscalationEmail({
        companyName: v.companyName,
        amountDue: v.amountDue,
        daysOverdue: v.daysOverdue,
        clientUrl: v.clientUrl,
      })
    }
    case 'orders.created': {
      const v = vars as EventPayloadMap['orders.created']
      return renderOrderCreatedEmail({ orderTitle: v.orderTitle, orderUrl: v.orderUrl, locale })
    }
    case 'orders.assigned': {
      const v = vars as EventPayloadMap['orders.assigned']
      return renderOrderAssignedEmail({ orderTitle: v.orderTitle, orderUrl: v.orderUrl, locale })
    }
    case 'orders.approval_requested': {
      const v = vars as EventPayloadMap['orders.approval_requested']
      return renderApprovalRequestedEmail({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'orders.approval_decided': {
      const v = vars as EventPayloadMap['orders.approval_decided']
      return renderApprovalDecidedEmail({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        approved: v.approved,
        comment: v.comment,
        locale,
      })
    }
    case 'documents.completion_act_ready': {
      const v = vars as EventPayloadMap['documents.completion_act_ready']
      return renderDocumentSentEmail({
        documentLabel: v.documentLabel,
        documentNumber: v.documentNumber,
        documentUrl: v.documentUrl,
        locale,
      })
    }
    case 'billing.invoice_paid': {
      const v = vars as EventPayloadMap['billing.invoice_paid']
      return renderPaymentReceivedEmail({
        amount: v.amount,
        method: v.method,
        portalUrl: v.portalUrl,
        locale,
      })
    }
    default:
      return null
  }
}

// ─── Telegram rendering router ──────────────────────────────────────────────
export function renderTelegramForEvent(
  event: NotificationEvent,
  recipient: Recipient,
  vars: Record<string, unknown>
): RenderedTelegram | null {
  const locale: LocaleKey = recipient.locale ?? 'uk'
  switch (event) {
    case 'auth.welcome':
      return renderWelcomeTelegram({
        name: recipient.name ?? '',
        portalUrl: (vars as EventPayloadMap['auth.welcome']).portalUrl,
        locale,
      })
    case 'auth.password_reset':
      return renderPasswordResetTelegram({
        resetUrl: (vars as EventPayloadMap['auth.password_reset']).resetUrl,
        locale,
      })
    case 'auth.email_verification':
      return renderEmailVerificationTelegram({
        verifyUrl: (vars as EventPayloadMap['auth.email_verification']).verifyUrl,
        locale,
      })
    case 'system.invite_sent': {
      const v = vars as { inviterName: string; acceptUrl: string; companyName?: string }
      if (v.companyName) {
        return renderInviteCompanyMemberTelegram({
          inviterName: v.inviterName,
          companyName: v.companyName,
          acceptUrl: v.acceptUrl,
          locale,
        })
      }
      return renderInviteExecutorTelegram({
        inviterName: v.inviterName,
        acceptUrl: v.acceptUrl,
        locale,
      })
    }
    case 'orders.status_changed': {
      const v = vars as EventPayloadMap['orders.status_changed']
      return renderOrderStatusChangedTelegram({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        newClientStatus: v.newClientStatus,
        locale,
      })
    }
    case 'chat.new_comment': {
      const v = vars as EventPayloadMap['chat.new_comment']
      return renderNewCommentTelegram({
        orderTitle: v.orderTitle,
        authorName: v.authorName,
        preview: v.preview,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'chat.mentioned': {
      const v = vars as EventPayloadMap['chat.mentioned']
      return renderMentionedTelegram({
        orderTitle: v.orderTitle,
        authorName: v.authorName,
        preview: v.preview,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'billing.invoice_sent': {
      const v = vars as EventPayloadMap['billing.invoice_sent']
      return renderInvoiceSentTelegram({
        invoiceNumber: v.invoiceNumber,
        amount: v.amount,
        dueDate: v.dueDate,
        invoiceUrl: v.invoiceUrl,
        locale,
      })
    }
    case 'orders.created': {
      const v = vars as EventPayloadMap['orders.created']
      return renderOrderCreatedTelegram({ orderTitle: v.orderTitle, orderUrl: v.orderUrl, locale })
    }
    case 'orders.assigned': {
      const v = vars as EventPayloadMap['orders.assigned']
      return renderOrderAssignedTelegram({ orderTitle: v.orderTitle, orderUrl: v.orderUrl, locale })
    }
    case 'orders.approval_requested': {
      const v = vars as EventPayloadMap['orders.approval_requested']
      return renderApprovalRequestedTelegram({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        locale,
      })
    }
    case 'orders.approval_decided': {
      const v = vars as EventPayloadMap['orders.approval_decided']
      return renderApprovalDecidedTelegram({
        orderTitle: v.orderTitle,
        orderUrl: v.orderUrl,
        approved: v.approved,
        comment: v.comment,
        locale,
      })
    }
    case 'documents.completion_act_ready': {
      const v = vars as EventPayloadMap['documents.completion_act_ready']
      return renderDocumentSentTelegram({
        documentLabel: v.documentLabel,
        documentNumber: v.documentNumber,
        documentUrl: v.documentUrl,
        locale,
      })
    }
    case 'billing.invoice_paid': {
      const v = vars as EventPayloadMap['billing.invoice_paid']
      return renderPaymentReceivedTelegram({
        amount: v.amount,
        method: v.method,
        portalUrl: v.portalUrl,
        locale,
      })
    }
    default:
      return null
  }
}

// ─── Single-channel dispatch helpers ────────────────────────────────────────
/** 08-EMAIL: owner-override листа — тема + вступний абзац поверх системного макета. */
export interface EmailOverride {
  subject?: string | null
  intro?: string | null
}

/** Підстановка {{ключ}} зі значень vars події; невідомий токен лишається видимим. */
function substituteEventVars(text: string, vars: Record<string, unknown>): string {
  return text.replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g, (token, key: string) => {
    const value = vars[key]
    if (value === undefined || value === null || typeof value === 'object') return token
    return String(value as string | number | boolean)
  })
}

/**
 * 08-EMAIL: накласти override. intro підміняє ПЕРШИЙ <p> системного листа (наш
 * фіксований макет: heading → lead-параграф → решта) — верстку зламати неможливо.
 */
export function applyEmailOverride(
  tpl: RenderedEmail,
  override: EmailOverride | undefined,
  vars: Record<string, unknown>
): RenderedEmail {
  if (!override) return tpl
  let { subject, html } = tpl
  if (override.subject) subject = substituteEventVars(override.subject, vars)
  if (override.intro) {
    const intro = substituteEventVars(override.intro, vars)
    const safe = intro.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    html = html.replace(
      /<p style="margin:0 0 16px;[^"]*">[\s\S]*?<\/p>/,
      `<p style="margin:0 0 16px;font-size:15px;line-height:1.55;">${safe}</p>`
    )
  }
  return { subject, html }
}

export async function dispatchEmail(
  event: NotificationEvent,
  recipient: Recipient,
  vars: Record<string, unknown>,
  attachments?: EmailPayload['attachments'],
  override?: EmailOverride
): Promise<DispatchResult> {
  const rendered = renderEmailForEvent(event, recipient, vars)
  if (!rendered) {
    return {
      channel: NotificationChannel.EMAIL,
      result: { status: 'skipped', reason: 'no_template' },
    }
  }
  const tpl = applyEmailOverride(rendered, override, vars)
  const payload: EmailPayload = {
    to: recipient.email,
    subject: tpl.subject,
    html: tpl.html,
    ...(attachments?.length ? { attachments } : {}),
  }
  const result = await sendEmail(payload)
  return { channel: NotificationChannel.EMAIL, result }
}

export async function dispatchTelegram(
  event: NotificationEvent,
  recipient: Recipient,
  vars: Record<string, unknown>
): Promise<DispatchResult> {
  if (!recipient.telegramChatId) {
    return {
      channel: NotificationChannel.TELEGRAM,
      result: { status: 'skipped', reason: 'no_chat_id' },
    }
  }
  const tpl = renderTelegramForEvent(event, recipient, vars)
  if (!tpl) {
    return {
      channel: NotificationChannel.TELEGRAM,
      result: { status: 'skipped', reason: 'no_template' },
    }
  }
  const payload: TelegramPayload = {
    chatId: recipient.telegramChatId,
    text: tpl.text,
    parseMode: tpl.parseMode,
    disableWebPagePreview: tpl.disableWebPagePreview,
  }
  const result = await sendTelegram(payload)
  return { channel: NotificationChannel.TELEGRAM, result }
}

/** in_app dispatch is a no-op at the adapter level — caller writes a row to `notifications` table. */
export function dispatchInApp(
  _event: NotificationEvent,
  _recipient: Recipient,
  _vars: Record<string, unknown>
): DispatchResult {
  return {
    channel: NotificationChannel.IN_APP,
    result: { status: 'skipped', reason: 'persistence_handled_by_caller' },
  }
}
