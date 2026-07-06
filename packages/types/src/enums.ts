// ============================================================================
// Source of truth: packages/db/prisma/schema.prisma
// Keep this file in sync with Prisma enums (lowercase snake_case values).
// ============================================================================

// ─── Identity / Users ───────────────────────────────────────────────────────
export enum Role {
  OWNER = 'owner',
  EXECUTOR = 'executor',
  CLIENT = 'client',
}

export enum CompanyMemberRole {
  OWNER = 'owner',
  MEMBER = 'member',
}

export enum Language {
  UK = 'uk',
  EN = 'en',
}

export enum Theme {
  LIGHT = 'light',
  DARK = 'dark',
  SYSTEM = 'system',
}

// ─── Loyalty (% discount tiers, NOT cashback points) ────────────────────────
export enum LoyaltyTier {
  NEW = 'new',
  REGULAR = 'regular',
  PARTNER = 'partner',
  VIP = 'vip',
}

// ─── Orders ─────────────────────────────────────────────────────────────────
export enum OrderType {
  CLIENT_ORDER = 'client_order',
  INTERNAL_TASK = 'internal_task',
}

export enum OrderPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * 9 internal statuses tracked in workspace.
 * NB: `estimating` (not `estimated`) after S1-03 migration renames the value.
 */
export enum OrderInternalStatus {
  NEW = 'new',
  CLARIFICATION = 'clarification',
  ESTIMATING = 'estimating',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  REVISION = 'revision',
  DONE = 'done',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

/**
 * 4 client-facing statuses (collapsed view shown in portal).
 * Mapping lives in `constants.ts` → INTERNAL_TO_CLIENT_STATUS.
 */
export enum OrderClientStatus {
  IN_PROGRESS = 'in_progress',
  PENDING_APPROVAL = 'pending_approval',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * 02-А — estimate-approval state (optional, gated by Order.requiresApproval).
 * Distinct from OrderClientStatus: this tracks the CLIENT's decision on the estimate
 * (estimating → in_progress), not acceptance of finished work (review → pending_approval).
 */
export enum OrderApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * P-11 (PROJECTS_SPEC §8) — cost-approval mode, one choice cascading
 * Agency → Company → Project → Order. `upfront` = approve estimate before work (02-А,
 * gates → in_progress); `on_actuals` = approve the actual amount before invoicing (Gate-2,
 * a charge stays draft/out-of-balance until released); `none` = no approval.
 */
export enum ApprovalMode {
  NONE = 'none',
  UPFRONT = 'upfront',
  ON_ACTUALS = 'on_actuals',
}

/** P-11 — who signs off the amount in `on_actuals`: the client (portal) or internal team. */
export enum InvoiceApprover {
  CLIENT = 'client',
  INTERNAL = 'internal',
}

export enum StageStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum InternalTaskStatus {
  TODO = 'todo',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

/** Leads/CRM pipeline stage (module 26). */
export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  QUALIFIED = 'qualified',
  PROPOSAL = 'proposal',
  WON = 'won',
  LOST = 'lost',
}

// ─── Billing ────────────────────────────────────────────────────────────────
export enum BillingType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
}

/**
 * BillingMode controls how an internal task is paid:
 *   - client_paid: rolled into a client invoice,
 *   - internal_paid: covered by company budget,
 *   - unpaid: tracked but not invoiced.
 */
export enum BillingMode {
  CLIENT_PAID = 'client_paid',
  INTERNAL_PAID = 'internal_paid',
  UNPAID = 'unpaid',
}

export enum ChargeStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  WRITTEN_OFF = 'written_off',
}

/**
 * Derived (computed) charge state for read DTOs (S5-07, module 25). A function of
 * Σ(allocations) vs `totalAmount` + `dueDate` — NOT the stored `ChargeStatus`
 * enum, which has no `awaiting`/`overpaid`. `deriveChargeState` produces these;
 * the stored status is updated to the nearest persistable `ChargeStatus`.
 */
export const CHARGE_DERIVED_STATES = ['awaiting', 'partial', 'paid', 'overdue', 'overpaid'] as const
export type ChargeDerivedState = (typeof CHARGE_DERIVED_STATES)[number]

/** Recurring-charge cadence for a CompanyService subscription (module 05). */
export enum ChargeFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
}

// ─── Projects (05-ПРОЕКТИ, фінмодель 2.0 — S5.6 P-1) ─────────────────────────
export enum ProjectBillingModel {
  FIXED_MONTHLY_ADVANCE = 'fixed_monthly_advance',
  HOURLY_PREPAID = 'hourly_prepaid',
  HOURLY_POSTPAID = 'hourly_postpaid',
}

export enum ProjectBillingCycle {
  MONTHLY_DAY_N = 'monthly_day_n',
  WEEKLY_DAY_X = 'weekly_day_x',
  MANUAL = 'manual',
}

export enum PaymentType {
  ADVANCE = 'advance',
  FINAL = 'final',
  PARTIAL = 'partial',
}

export enum PaymentStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

/** Direction of a bonus-wallet ledger entry (module 25). */
export enum WalletTxnType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

/** What produced a bonus-wallet ledger entry (module 25). */
export enum WalletTxnSource {
  REFERRAL_BONUS = 'referral_bonus',
  MANUAL_ADJUSTMENT = 'manual_adjustment',
  INVOICE_PAYMENT = 'invoice_payment',
  REFUND = 'refund',
}

/** Executor payout settlement status (module 12). */
export enum PayoutStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  PAID = 'paid',
}

/** Operating-expense recurrence type (module 22). */
export enum ExpenseType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}

/** Operating-expense category for P&L grouping (module 22). */
export enum ExpenseCategory {
  INFRASTRUCTURE = 'infrastructure',
  SOFTWARE = 'software',
  SALARY = 'salary',
  CONTRACTOR = 'contractor',
  RENT = 'rent',
  TAX = 'tax',
  MARKETING = 'marketing',
  OTHER = 'other',
}

/** Where an expense came from (module 22). `executor_rate` rows are synthesized in P&L. */
export enum ExpenseSource {
  MANUAL = 'manual',
  EXECUTOR_RATE = 'executor_rate',
}

/** Operating-expense billing cadence (module 22). */
export enum ExpenseFrequency {
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  ONE_TIME = 'one_time',
}

// ─── Documents ──────────────────────────────────────────────────────────────
export enum DocumentType {
  CONTRACT = 'contract',
  ADVANCE_INVOICE = 'advance_invoice',
  INVOICE = 'invoice',
  COMPLETION_ACT = 'completion_act',
  SPECIFICATION = 'specification',
  RECONCILIATION_ACT = 'reconciliation_act',
  // 19-Г: місячний звіт клієнту (company-scoped, без замовлення)
  MONTHLY_REPORT = 'monthly_report',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  GENERATED = 'generated',
  SENT = 'sent',
  // 06-ПІДПИС: клієнт прийняв (договір/акт) — клік + ПІБ у порталі
  ACCEPTED = 'accepted',
}

// ─── Invites ────────────────────────────────────────────────────────────────
export enum InviteType {
  EXECUTOR = 'executor',
  COMPANY_MEMBER = 'company_member',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

// ─── OTP ────────────────────────────────────────────────────────────────────
export enum OtpPurpose {
  TELEGRAM_LINK = 'telegram_link',
  TWO_FA = 'two_fa',
  PHONE_VERIFY = 'phone_verify',
  EMAIL_VERIFY = 'email_verify',
  MAGIC_LINK = 'magic_link',
  EMAIL_CHANGE = 'email_change',
}

export enum OtpChannel {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  SMS = 'sms',
}

// ─── Blog ───────────────────────────────────────────────────────────────────
export enum BlogPostType {
  ARTICLE = 'article',
  CASE_STUDY = 'case_study',
}

export enum BlogPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

// ─── Notifications: 7 categories × 6 channels matrix ────────────────────────
export enum NotificationCategory {
  AUTH = 'auth',
  ORDERS = 'orders',
  CHAT = 'chat',
  BILLING = 'billing',
  DOCUMENTS = 'documents',
  LOYALTY = 'loyalty',
  SYSTEM = 'system',
}

export enum NotificationChannel {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  IN_APP = 'in_app',
  SMS = 'sms',
  PUSH = 'push',
  WEBHOOK = 'webhook',
}

export type NotificationEvent =
  // auth (always email, see CRITICAL_EVENTS)
  | 'auth.welcome'
  | 'auth.password_reset'
  | 'auth.email_verification'
  | 'auth.login_from_new_device'
  // orders
  | 'orders.created'
  | 'orders.status_changed'
  | 'orders.assigned'
  | 'orders.file_uploaded'
  | 'orders.due_soon'
  | 'orders.overdue'
  | 'orders.specification_ready'
  | 'orders.approval_requested'
  | 'orders.approval_decided'
  // chat
  | 'chat.new_comment'
  | 'chat.mentioned'
  | 'chat.mention'
  // billing (always email, see CRITICAL_EVENTS)
  | 'billing.invoice_sent'
  | 'billing.invoice_paid'
  | 'billing.invoice_overdue'
  | 'billing.payment_failed'
  | 'billing.refund_issued'
  | 'billing.subscription_charged'
  | 'billing.subscription_expiring'
  // documents
  | 'documents.completion_act_ready'
  | 'documents.reconciliation_act_ready'
  // loyalty
  | 'loyalty.tier_upgraded'
  | 'loyalty.discount_applied'
  // system
  | 'system.maintenance_planned'
  | 'system.invite_sent'
  | 'system.company_member_added'
  // vault (17-РОТАЦІЯ): секрету спливає термін — нагадування власнику агенції (in-app)
  | 'credentials.rotation_due'
  // S10-02 SLA: порушення терміну реакції/розв'язання — ескалація owner'у (in-app)
  | 'orders.sla_breached'
  // 01-А/01-Г: magic-link вхід + флоу зміни email
  | 'auth.magic_link'
  | 'auth.email_change_requested'
  | 'auth.email_change_confirm'
  // S11: місячний email-дайджест власнику (owner-тумблер у settings)
  | 'reports.monthly'
  // 06-ПІДПИС: клієнт прийняв договір/акт у порталі (in-app власникам)
  | 'documents.accepted'

// ─── Error codes ────────────────────────────────────────────────────────────
export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  // Step-up auth needed before the action (e.g. re-enter password to reveal a vault secret).
  // Returned with HTTP 403 so the API client does NOT treat it as a session-expiry 401.
  STEP_UP_REQUIRED = 'STEP_UP_REQUIRED',
  // 2FA-POLICY: the agency requires TOTP, the grace window expired, and this member has
  // not set it up yet — every route except /auth/* answers 403 with this code.
  TFA_SETUP_REQUIRED = 'TFA_SETUP_REQUIRED',
}

// ─── Departments (CRUD table, not enum — see modules/12) ────────────────────
// Type alias only; actual values come from `departments` table at runtime.
export type DepartmentSlug = string

// Default seed slugs (re-exported as constants in constants.ts):
//   design / dev / marketing / management / qa / devops / content
