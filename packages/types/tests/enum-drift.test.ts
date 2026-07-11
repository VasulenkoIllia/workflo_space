import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BillingType,
  BlogPostType,
  ChargeFrequency,
  ChargeStatus,
  TicketStatus,
  TicketPriority,
  CalendarEventType,
  AttendeeResponse,
  CompanyMemberRole,
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseSource,
  ExpenseType,
  DocKit,
  DocumentStatus,
  DocumentType,
  InternalTaskStatus,
  InviteType,
  Language,
  LeadStatus,
  AnnouncementAudience,
  LeadStageKind,
  LoyaltyTier,
  OrderClientStatus,
  OrderInternalStatus,
  OrderPriority,
  OrderType,
  OtpChannel,
  OtpPurpose,
  PaymentStatus,
  PaymentType,
  PayoutStatus,
  ProjectBillingCycle,
  ProjectBillingModel,
  Role,
  StageStatus,
  Theme,
  WalletTxnSource,
  WalletTxnType,
} from '../src/enums.js'

/**
 * Guard against drift between the TypeScript enums in @workflo/types and the
 * canonical Prisma schema. The enums file header promises this sync is manual —
 * this test enforces it (the audit found IMPLEMENTATION_PLAN had already drifted).
 */

const SCHEMA_PATH = fileURLToPath(new URL('../../db/prisma/schema.prisma', import.meta.url))
const schema = readFileSync(SCHEMA_PATH, 'utf8')

function prismaEnumValues(name: string): string[] {
  const match = new RegExp(`enum\\s+${name}\\s*\\{([^}]*)\\}`).exec(schema)
  if (!match) throw new Error(`Prisma enum "${name}" not found in schema.prisma`)
  return match[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l.length > 0)
    .sort()
}

function tsEnumValues(e: Record<string, string>): string[] {
  return Object.values(e).sort()
}

// TS enum (from @workflo/types) ↔ Prisma enum name. Only enums that exist in
// BOTH are checked; TS-only constructs (BillingMode, Notification*, InviteStatus,
// BlogPostStatus) have no Prisma counterpart and are skipped.
const PAIRS: Array<[string, Record<string, string>]> = [
  ['Role', Role],
  ['CompanyMemberRole', CompanyMemberRole],
  ['Language', Language],
  ['Theme', Theme],
  ['LoyaltyTier', LoyaltyTier],
  ['OrderType', OrderType],
  ['OrderPriority', OrderPriority],
  ['OrderInternalStatus', OrderInternalStatus],
  ['OrderClientStatus', OrderClientStatus],
  ['StageStatus', StageStatus],
  ['InternalTaskStatus', InternalTaskStatus],
  ['LeadStatus', LeadStatus],
  ['LeadStageKind', LeadStageKind],
  ['AnnouncementAudience', AnnouncementAudience],
  ['DocKit', DocKit],
  ['BillingType', BillingType],
  ['ChargeStatus', ChargeStatus],
  ['TicketStatus', TicketStatus],
  ['TicketPriority', TicketPriority],
  ['CalendarEventType', CalendarEventType],
  ['AttendeeResponse', AttendeeResponse],
  ['ChargeFrequency', ChargeFrequency],
  ['ProjectBillingModel', ProjectBillingModel],
  ['ProjectBillingCycle', ProjectBillingCycle],
  ['PaymentType', PaymentType],
  ['PaymentStatus', PaymentStatus],
  ['WalletTxnType', WalletTxnType],
  ['WalletTxnSource', WalletTxnSource],
  ['PayoutStatus', PayoutStatus],
  ['ExpenseType', ExpenseType],
  ['ExpenseCategory', ExpenseCategory],
  ['ExpenseSource', ExpenseSource],
  ['ExpenseFrequency', ExpenseFrequency],
  ['DocumentType', DocumentType],
  ['DocumentStatus', DocumentStatus],
  ['InviteType', InviteType],
  ['OtpPurpose', OtpPurpose],
  ['OtpChannel', OtpChannel],
  ['BlogPostType', BlogPostType],
]

describe('enum drift: @workflo/types ↔ prisma schema', () => {
  it.each(PAIRS)('%s values match Prisma', (prismaName, tsEnum) => {
    expect(tsEnumValues(tsEnum)).toEqual(prismaEnumValues(prismaName))
  })

  it('OrderInternalStatus uses estimating (not estimated)', () => {
    expect(Object.values(OrderInternalStatus)).toContain('estimating')
    expect(Object.values(OrderInternalStatus)).not.toContain('estimated')
  })

  it('DocumentType includes reconciliation_act', () => {
    expect(Object.values(DocumentType)).toContain('reconciliation_act')
  })
})
