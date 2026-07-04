// Public surface — every consumer (API, bot, cron) imports from here.

// Main entry point.
export {
  notify,
  notifyRecipient,
  type NotifyDeps,
  type NotifyInput,
  type NotifyLogger,
  type NotifyOutcome,
  type NotifyPrisma,
  type NotifyRecipientInput,
  type NotifyVars,
} from './notify.js'

// Resolver — exported so API layer can preview channels in /profile/settings.
export { resolveTargetChannels, type ResolverPrisma } from './resolver.js'

// Dispatchers — exported for direct-send flows that bypass resolver (e.g. cron).
export {
  dispatchEmail,
  dispatchInApp,
  dispatchTelegram,
  renderEmailForEvent,
  renderTelegramForEvent,
  type DispatchResult,
  type EventPayloadMap,
  type Recipient,
} from './dispatch.js'

// Adapters (low-level escape hatches).
export {
  sendEmail,
  type EmailPayload,
  type EmailSendResult,
  type RawSentInfo,
} from './adapters/EmailAdapter.js'
export {
  sendTelegram,
  type TelegramPayload,
  type TelegramSendResult,
} from './adapters/TelegramAdapter.js'

// Config / transport — useful for ops health checks.
export {
  loadConfig,
  loadEmailConfig,
  loadTelegramConfig,
  type EmailConfig,
  type NotificationConfig,
  type TelegramConfig,
} from './config.js'
export { getMailer, getActiveFrom, resetMailer, verifyMailer } from './email/mailer.js'
export { getBot, resetBot, setBotForTest } from './telegram/bot.js'

// i18n primitives — re-exported so consumers can format their own copy.
export { bindTranslator, translate, SUPPORTED_LOCALES, type LocaleKey } from './email/i18n.js'

// Render primitives — for places that want to compose ad-hoc emails.
export {
  escapeAttr,
  escapeText,
  renderButton,
  renderHeading,
  renderLayout,
  renderMuted,
  renderParagraph,
} from './email/render.js'
export { bold, code, escapeHtml, italic, link } from './telegram/escape.js'

// Templates — directly importable when caller wants more control.
export * from './email/templates/index.js'
export * from './telegram/templates/index.js'
