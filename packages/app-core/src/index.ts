/**
 * @workflo/app-core — the shared client core of portal + workspace (AR-42, audit
 * 2026-06-11). These modules used to live as byte-identical copies in both apps
 * and had already drifted once (the `??`/`||` API_URL bug). The apps keep thin
 * re-export shims at their old paths, so call-sites did not change.
 */
export * from './api.js'
export * from './sse.js'
export * from './queryClient.js'
export * from './format.js'
export * from './password.js'
export * from './PasswordStrengthMeter.js'
export * from './i18n.js'
export * from './ErrorBoundary.js'
// S6 notification surface — was byte-identical in both apps (drift risk); shared here.
export * from './notifications.js'
export * from './notificationPrefs.js'
export * from './telegram.js'
export * from './InboxView.js'
export * from './BellDropdown.js'
// Auth-lib surface — was byte-identical in both apps (AR-42, audit r4); shared here.
export * from './sessions.js'
export * from './twoFactor.js'
export * from './oauth.js'
// Order-chat data layer — shared query keys + comment/reaction/pin/stream hooks.
export * from './orderChat.js'
// Order-chat UI — one shared component (AR-42 decomp C), parameterised by capabilities.
export * from './OrderChatView.js'
