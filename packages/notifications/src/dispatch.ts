import { NotificationChannel, type NotificationEvent } from '@workflo/types'
import { type EmailPayload, type EmailSendResult, sendEmail } from './adapters/EmailAdapter.js'
import {
  type TelegramPayload,
  type TelegramSendResult,
  sendTelegram,
} from './adapters/TelegramAdapter.js'
import type { LocaleKey } from './email/i18n.js'
import {
  renderInviteCompanyMemberEmail,
  renderInviteExecutorEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
  type RenderedEmail,
} from './email/templates/index.js'
import {
  renderInviteCompanyMemberTelegram,
  renderInviteExecutorTelegram,
  renderInvoiceSentTelegram,
  renderNewCommentTelegram,
  renderOrderStatusChangedTelegram,
  renderPasswordResetTelegram,
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
  'billing.invoice_sent': {
    invoiceNumber: string
    amount: string
    dueDate: string
    invoiceUrl: string
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
  // We intentionally use `as` casts here because the per-event types are
  // proven by the caller building EventPayloadMap[event].
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
    default:
      return null
  }
}

// ─── Single-channel dispatch helpers ────────────────────────────────────────
export async function dispatchEmail(
  event: NotificationEvent,
  recipient: Recipient,
  vars: Record<string, unknown>
): Promise<DispatchResult> {
  const tpl = renderEmailForEvent(event, recipient, vars)
  if (!tpl) {
    return {
      channel: NotificationChannel.EMAIL,
      result: { status: 'skipped', reason: 'no_template' },
    }
  }
  const payload: EmailPayload = { to: recipient.email, subject: tpl.subject, html: tpl.html }
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
