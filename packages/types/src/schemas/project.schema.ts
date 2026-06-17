import { z } from 'zod'
import { ProjectBillingCycle, ProjectBillingModel } from '../enums.js'

/**
 * Financial projects (05-ПРОЕКТИ, PROJECTS_SPEC §2/§5 — S5.6 P-1). A project is a
 * per-client financial container: billing model + cycle + currency + rates.
 */

function hasTwoFractionDigits(value: number): boolean {
  return Number(value.toFixed(2)) === value
}
const amount = z
  .number()
  .finite()
  .nonnegative()
  .max(1_000_000_000)
  .refine(hasTwoFractionDigits, 'Сума має не більше 2 десяткових знаків')

const pct = z.number().finite().min(0).max(100).refine(hasTwoFractionDigits, 'Відсоток: ≤2 знаки')

/**
 * Default `contractRequired` by billing model (PROJECTS_SPEC §5): a fixed monthly
 * subscription needs a contract; hourly projects don't by default. Used when the
 * caller omits the flag. Canon for the create handler.
 */
export function defaultContractRequired(model: ProjectBillingModel): boolean {
  return model === ProjectBillingModel.FIXED_MONTHLY_ADVANCE
}

/** Shared shape; create requires billingModel, update makes everything optional. */
const baseShape = {
  name: z.string().trim().min(2).max(200),
  type: z.string().trim().max(100).nullish(),
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  abonAmount: amount.nullish(),
  clientHourlyRate: amount.nullish(),
  billingCycle: z.nativeEnum(ProjectBillingCycle).default(ProjectBillingCycle.MONTHLY_DAY_N),
  cycleDay: z.number().int().min(1).max(28).nullish(),
  cycleWeekday: z.number().int().min(1).max(7).nullish(),
  paymentTermsDays: z.number().int().min(0).max(365).nullish(),
  legalEntityId: z.string().uuid().nullish(),
  contractRequired: z.boolean().optional(),
  requiresApproval: z.boolean().nullish(),
  advanceGatePct: pct.nullish(),
  includedHoursCap: amount.nullish(),
}

/**
 * Coherence between billing model / cycle and the amount + schedule fields
 * (PROJECTS_SPEC §5). Applied to both create and update (on the merged view the
 * handler builds — here it validates whatever subset is present).
 */
function checkCoherence(
  d: {
    billingModel?: ProjectBillingModel
    billingCycle?: ProjectBillingCycle
    abonAmount?: number | null
    clientHourlyRate?: number | null
    includedHoursCap?: number | null
    cycleDay?: number | null
    cycleWeekday?: number | null
  },
  ctx: z.RefinementCtx
): void {
  if (d.billingModel === ProjectBillingModel.FIXED_MONTHLY_ADVANCE && d.abonAmount == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['abonAmount'],
      message: 'Абонплата потребує abonAmount',
    })
  }
  if (
    (d.billingModel === ProjectBillingModel.HOURLY_PREPAID ||
      d.billingModel === ProjectBillingModel.HOURLY_POSTPAID) &&
    d.clientHourlyRate == null
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clientHourlyRate'],
      message: 'Погодинна модель потребує clientHourlyRate',
    })
  }
  // Hybrid project (PROJECTS_SPEC §4.1): a fixed subscription that includes N hours
  // (includedHoursCap) bills the overage hourly — so it needs an overage rate. The
  // overage-charge GENERATION is the P-2 cycle-engine; the config is validated here.
  if (d.includedHoursCap != null && d.includedHoursCap > 0 && d.clientHourlyRate == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clientHourlyRate'],
      message: 'Ліміт годин (includedHoursCap) потребує clientHourlyRate для білінгу понад ліміт',
    })
  }
  if (d.billingCycle === ProjectBillingCycle.WEEKLY_DAY_X && d.cycleWeekday == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cycleWeekday'],
      message: 'Щотижневий цикл потребує cycleWeekday (1-7)',
    })
  }
}

/** POST /workspace/projects */
export const createProjectSchema = z
  .object({
    companyId: z.string().uuid(),
    billingModel: z.nativeEnum(ProjectBillingModel),
    ...baseShape,
  })
  .superRefine((d, ctx) => checkCoherence(d, ctx))
export type CreateProjectInput = z.infer<typeof createProjectSchema>

/** POST /workspace/projects/:id/close-cycle — manual cycle close for an explicit period. */
export const closeCycleSchema = z
  .object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Очікується YYYY-MM-DD'),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Очікується YYYY-MM-DD'),
  })
  .refine((d) => d.periodEnd >= d.periodStart, {
    message: 'periodEnd має бути ≥ periodStart',
    path: ['periodEnd'],
  })
export type CloseCycleInput = z.infer<typeof closeCycleSchema>

/** PATCH /workspace/projects/:id — partial; `companyId`/`billingModel` are immutable here. */
export const updateProjectSchema = z
  .object({ ...baseShape, active: z.boolean().optional() })
  .partial()
  .strict()
  .superRefine((d, ctx) => {
    if (Object.keys(d).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Потрібно вказати хоча б одне поле' })
    }
    checkCoherence(d, ctx)
  })
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
