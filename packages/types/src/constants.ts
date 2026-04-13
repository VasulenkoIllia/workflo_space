import { LoyaltyTier, OrderClientStatus, OrderInternalStatus } from './enums.js'

export const INTERNAL_TO_CLIENT_STATUS: Record<OrderInternalStatus, OrderClientStatus> = {
  [OrderInternalStatus.NEW]: OrderClientStatus.PENDING,
  [OrderInternalStatus.CLARIFICATION]: OrderClientStatus.PENDING,
  [OrderInternalStatus.ESTIMATION]: OrderClientStatus.PENDING,
  [OrderInternalStatus.APPROVED]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.IN_PROGRESS]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.REVIEW]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.ON_HOLD]: OrderClientStatus.IN_WORK,
  [OrderInternalStatus.DONE]: OrderClientStatus.DONE,
  [OrderInternalStatus.CANCELLED]: OrderClientStatus.CANCELLED,
}

export const LOYALTY_TIERS: Record<LoyaltyTier, { minUsd: number; cashbackPercent: number }> = {
  [LoyaltyTier.BRONZE]: { minUsd: 0, cashbackPercent: 1 },
  [LoyaltyTier.SILVER]: { minUsd: 1000, cashbackPercent: 2 },
  [LoyaltyTier.GOLD]: { minUsd: 5000, cashbackPercent: 3 },
  [LoyaltyTier.PLATINUM]: { minUsd: 10000, cashbackPercent: 5 },
}

export const REFERRAL_CODE_PREFIX = 'workflo-'
export const REFERRAL_CODE_LENGTH = 6
