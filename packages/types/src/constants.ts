import {
  LoyaltyTier,
  NotificationCategory,
  NotificationChannel,
  type NotificationEvent,
  OrderClientStatus,
  OrderInternalStatus,
} from './enums.js'

// ============================================================================
// Order status mapping (9 internal → 4 client)
// ============================================================================

export const INTERNAL_TO_CLIENT_STATUS: Record<OrderInternalStatus, OrderClientStatus> = {
  [OrderInternalStatus.NEW]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.CLARIFICATION]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.ESTIMATING]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.IN_PROGRESS]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.ON_HOLD]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.REVIEW]: OrderClientStatus.PENDING_APPROVAL,
  [OrderInternalStatus.REVISION]: OrderClientStatus.IN_PROGRESS,
  [OrderInternalStatus.DONE]: OrderClientStatus.COMPLETED,
  [OrderInternalStatus.CANCELLED]: OrderClientStatus.CANCELLED,
}

// ============================================================================
// Loyalty (% discount tiers, see modules/10-loyalty.md)
// ============================================================================

/**
 * Loyalty tier thresholds in USD (cumulative paid invoices, lifetime).
 * Tier is recomputed nightly via CRON_JOBS C16.
 */
export const LOYALTY_TIER_THRESHOLDS_USD: Record<LoyaltyTier, number> = {
  [LoyaltyTier.NEW]: 0,
  [LoyaltyTier.REGULAR]: 1_000,
  [LoyaltyTier.PARTNER]: 5_000,
  [LoyaltyTier.VIP]: 15_000,
}

/**
 * Discount percentage applied automatically to all new invoices per tier.
 * Owner can override per-order in workspace (audit-logged).
 */
export const LOYALTY_DISCOUNT_PCT: Record<LoyaltyTier, number> = {
  [LoyaltyTier.NEW]: 0,
  [LoyaltyTier.REGULAR]: 3,
  [LoyaltyTier.PARTNER]: 7,
  [LoyaltyTier.VIP]: 12,
}

/** Compute tier from lifetime paid amount (USD). */
export function calculateLoyaltyTier(lifetimePaidUsd: number): LoyaltyTier {
  if (lifetimePaidUsd >= LOYALTY_TIER_THRESHOLDS_USD[LoyaltyTier.VIP]) return LoyaltyTier.VIP
  if (lifetimePaidUsd >= LOYALTY_TIER_THRESHOLDS_USD[LoyaltyTier.PARTNER]) return LoyaltyTier.PARTNER
  if (lifetimePaidUsd >= LOYALTY_TIER_THRESHOLDS_USD[LoyaltyTier.REGULAR]) return LoyaltyTier.REGULAR
  return LoyaltyTier.NEW
}

// ============================================================================
// Notification taxonomy (see ADR-003 + modules/07-notifications.md)
// ============================================================================

/**
 * Maps every NotificationEvent to its NotificationCategory.
 * User preferences in NotificationPreference are stored per (settingsId × category × channel)
 * — events inherit their category's preferences.
 */
export const EVENT_TO_CATEGORY: Record<NotificationEvent, NotificationCategory> = {
  // auth
  'auth.welcome': NotificationCategory.AUTH,
  'auth.password_reset': NotificationCategory.AUTH,
  'auth.email_verification': NotificationCategory.AUTH,
  'auth.login_from_new_device': NotificationCategory.AUTH,
  // orders
  'orders.created': NotificationCategory.ORDERS,
  'orders.status_changed': NotificationCategory.ORDERS,
  'orders.assigned': NotificationCategory.ORDERS,
  'orders.file_uploaded': NotificationCategory.ORDERS,
  'orders.due_soon': NotificationCategory.ORDERS,
  'orders.overdue': NotificationCategory.ORDERS,
  'orders.specification_ready': NotificationCategory.ORDERS,
  // chat
  'chat.new_comment': NotificationCategory.CHAT,
  'chat.mention': NotificationCategory.CHAT,
  // billing
  'billing.invoice_sent': NotificationCategory.BILLING,
  'billing.invoice_paid': NotificationCategory.BILLING,
  'billing.invoice_overdue': NotificationCategory.BILLING,
  'billing.payment_failed': NotificationCategory.BILLING,
  'billing.refund_issued': NotificationCategory.BILLING,
  'billing.subscription_charged': NotificationCategory.BILLING,
  'billing.subscription_expiring': NotificationCategory.BILLING,
  // documents
  'documents.completion_act_ready': NotificationCategory.DOCUMENTS,
  'documents.reconciliation_act_ready': NotificationCategory.DOCUMENTS,
  // loyalty
  'loyalty.tier_upgraded': NotificationCategory.LOYALTY,
  'loyalty.discount_applied': NotificationCategory.LOYALTY,
  // system
  'system.maintenance_planned': NotificationCategory.SYSTEM,
  'system.invite_sent': NotificationCategory.SYSTEM,
  'system.company_member_added': NotificationCategory.SYSTEM,
}

/**
 * Events that ALWAYS go via email regardless of user preferences.
 * Source: ADR-003 (security/legal critical events).
 */
export const CRITICAL_EVENTS: ReadonlyArray<NotificationEvent> = [
  // auth
  'auth.password_reset',
  'auth.email_verification',
  'auth.login_from_new_device',
  // billing
  'billing.invoice_sent',
  'billing.invoice_paid',
  'billing.invoice_overdue',
  'billing.payment_failed',
  'billing.refund_issued',
]

/**
 * Per-channel registry. `enabled: false` channels are skipped silently by the
 * resolver — registered for forward-compat when SMS/push/webhook ship.
 */
export interface ChannelDescriptor {
  enabled: boolean
  cost: 'free' | 'low' | 'high'
  requiresUserOptIn: boolean
}

export const CHANNELS: Record<NotificationChannel, ChannelDescriptor> = {
  [NotificationChannel.EMAIL]:    { enabled: true,  cost: 'low',  requiresUserOptIn: false },
  [NotificationChannel.TELEGRAM]: { enabled: true,  cost: 'low',  requiresUserOptIn: true  },
  [NotificationChannel.IN_APP]:   { enabled: true,  cost: 'free', requiresUserOptIn: false },
  [NotificationChannel.SMS]:      { enabled: false, cost: 'high', requiresUserOptIn: true  },
  [NotificationChannel.PUSH]:     { enabled: false, cost: 'free', requiresUserOptIn: true  },
  [NotificationChannel.WEBHOOK]:  { enabled: false, cost: 'free', requiresUserOptIn: true  },
}

// ============================================================================
// Referrals
// ============================================================================

export const REFERRAL_CODE_PREFIX = 'workflo-'
export const REFERRAL_CODE_LENGTH = 6

// ============================================================================
// Department default seeds (departments are a CRUD table, not enum)
// ============================================================================

export const DEFAULT_DEPARTMENT_SLUGS = [
  'design',
  'dev',
  'marketing',
  'management',
  'qa',
  'devops',
  'content',
] as const

// ============================================================================
// Notification rollup tuning (see modules/07-notifications.md "Anti-spam")
// ============================================================================

export const NOTIFICATION_ROLLUP_WINDOW_MS = 10_000
export const NOTIFICATION_ROLLUP_THRESHOLD = 3

// ============================================================================
// Time tracking limits (see modules/12-team-executors.md "Time tracking")
// ============================================================================

/** Auto-stop a running timer after this many hours (safety net for forgotten timers). */
export const TIME_TRACKING_AUTO_STOP_HOURS = 8
