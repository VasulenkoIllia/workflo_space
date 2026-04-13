export enum OrderInternalStatus {
  NEW = 'new',
  CLARIFICATION = 'clarification',
  ESTIMATION = 'estimation',
  APPROVED = 'approved',
  IN_PROGRESS = 'in_progress',
  REVIEW = 'review',
  DONE = 'done',
  CANCELLED = 'cancelled',
  ON_HOLD = 'on_hold',
}

export enum OrderClientStatus {
  PENDING = 'pending',
  IN_WORK = 'in_work',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum OrderType {
  FIXED = 'fixed',
  HOURLY = 'hourly',
  RETAINER = 'retainer',
}

export enum OrderPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum BillingType {
  PREPAID = 'prepaid',
  POSTPAID = 'postpaid',
}

export enum UserRole {
  OWNER = 'owner',
  EXECUTOR = 'executor',
  CLIENT = 'client',
}

export enum Language {
  UK = 'uk',
  EN = 'en',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  PLATINUM = 'platinum',
}

export enum BlogPostType {
  ARTICLE = 'article',
  CASE = 'case',
}

export enum BlogPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum InviteType {
  EXECUTOR = 'executor',
  COMPANY_MEMBER = 'company_member',
}

export enum InviteStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
}

export enum DocumentType {
  INVOICE = 'invoice',
  ADVANCE_INVOICE = 'advance_invoice',
  COMPLETION_ACT = 'completion_act',
  SPECIFICATION = 'specification',
  CONTRACT = 'contract',
}

export enum DocumentStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  SIGNED = 'signed',
  CANCELLED = 'cancelled',
}

export enum NotificationChannel {
  EMAIL = 'email',
  TELEGRAM = 'telegram',
  IN_APP = 'in_app',
}

export enum NotificationEvent {
  ORDER_CREATED = 'order.created',
  ORDER_STATUS_CHANGED = 'order.status_changed',
  ORDER_COMMENT_ADDED = 'order.comment_added',
  ORDER_DUE_SOON = 'order.due_soon',
  ORDER_ASSIGNED = 'order.assigned',
  ORDER_FILE_UPLOADED = 'order.file_uploaded',
  PAYMENT_CONFIRMED = 'payment.confirmed',
  PAYMENT_PENDING = 'payment.pending',
  SUBSCRIPTION_EXPIRING = 'subscription.expiring',
  SUBSCRIPTION_CHARGED = 'subscription.charged',
  DOCUMENT_SENT = 'document.sent',
  INVITE_SENT = 'invite.sent',
}

export enum ApiErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMITED = 'RATE_LIMITED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
