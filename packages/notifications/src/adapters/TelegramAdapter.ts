import type { Bot } from 'grammy'
import { GrammyError, HttpError } from 'grammy'
import { getBot } from '../telegram/bot.js'

export interface TelegramPayload {
  chatId: string
  text: string
  parseMode?: 'HTML' | 'MarkdownV2'
  disableWebPagePreview?: boolean
  disableNotification?: boolean
}

export type TelegramSendResult =
  | { status: 'sent'; messageId: number }
  | { status: 'skipped'; reason: 'bot_not_configured' }
  | { status: 'failed'; reason: 'blocked'; error: string }
  | { status: 'failed'; reason: 'invalid_chat'; error: string }
  | { status: 'failed'; reason: 'rate_limited'; retryAfter: number; error: string }
  | { status: 'failed'; reason: 'transport_error'; error: string }

export interface SendTelegramOpts {
  /** Override bot — for tests. */
  bot?: Bot
}

/**
 * Send via Telegram Bot API. Returns rich result so callers can:
 *   - log delivery in notification_logs,
 *   - auto-disable telegram channel for blocked users (status=blocked),
 *   - back off on rate_limited (retryAfter in seconds).
 *
 * Never throws — all failures are surfaced as a `status: 'failed'` result.
 */
export async function sendTelegram(
  payload: TelegramPayload,
  opts: SendTelegramOpts = {}
): Promise<TelegramSendResult> {
  const bot = opts.bot ?? getBot()
  if (!bot) {
    return { status: 'skipped', reason: 'bot_not_configured' }
  }

  try {
    const msg = await bot.api.sendMessage(payload.chatId, payload.text, {
      parse_mode: payload.parseMode ?? 'HTML',
      link_preview_options: payload.disableWebPagePreview
        ? { is_disabled: true }
        : undefined,
      disable_notification: payload.disableNotification,
    })
    return { status: 'sent', messageId: msg.message_id }
  } catch (err) {
    if (err instanceof GrammyError) {
      // 403 — bot blocked or kicked
      if (err.error_code === 403) {
        return { status: 'failed', reason: 'blocked', error: err.description }
      }
      // 400 — chat not found / invalid chat id
      if (err.error_code === 400 && /chat not found|user not found/i.test(err.description)) {
        return { status: 'failed', reason: 'invalid_chat', error: err.description }
      }
      // 429 — rate limit
      if (err.error_code === 429) {
        const retryAfter =
          (err.parameters as { retry_after?: number } | undefined)?.retry_after ?? 1
        return { status: 'failed', reason: 'rate_limited', retryAfter, error: err.description }
      }
      return { status: 'failed', reason: 'transport_error', error: err.description }
    }
    if (err instanceof HttpError) {
      return {
        status: 'failed',
        reason: 'transport_error',
        error: `HttpError: ${err.message}`,
      }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'failed', reason: 'transport_error', error: message }
  }
}
