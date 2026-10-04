import { Prisma } from '@workflo/db'
import {
  ApiErrorCode,
  ApprovalMode,
  AppError,
  LOYALTY_DISCOUNT_PCT,
  type LoyaltyTier,
} from '@workflo/types'
import { refreshMoneyBalance } from './allocation.js'
import { resolveApprovalMode } from './approvalPolicy.js'

/**
 * P-11: does this project's effective cost-approval mode make issued charges `on_actuals`
 * drafts? If so they are stamped `approvalStatus='pending'` and stay out of moneyBalance/
 * revenue/FIFO until the client (or internal team) releases them. Accepts the loosely-typed
 * (Prisma-enum) project row so both charge producers can call it without enum-cast noise.
 */
function resolveChargeOnActuals(p: {
  approvalMode: string | null
  requiresApproval: boolean | null
  company: { approvalMode: string | null }
  agency: { defaultApprovalMode: string }
}): boolean {
  return (
    resolveApprovalMode({
      project: {
        approvalMode: p.approvalMode as ApprovalMode | null,
        requiresApproval: p.requiresApproval,
      },
      company: { approvalMode: p.company.approvalMode as ApprovalMode | null },
      agencyDefault: p.agency.defaultApprovalMode as ApprovalMode,
    }) === ApprovalMode.ON_ACTUALS
  )
}

/**
 * Recurring project-charge generation (05-ПРОЕКТИ, S5.6 P-1 3b). One charge per
 * `(projectId, periodStart)` — the `@@unique` constraint makes generation
 * idempotent, so the monthly cron, a manual replay, and a double-run all converge
 * to the same rows. The loyalty discount is applied here at creation time from the
 * project company's effective tier (the discount math lives in this single place).
 *
 * Scope (P-2a/b/d): `fixed_monthly_advance` — abonAmount up-front for the upcoming
 * month (+ hybrid overage: hours over includedHoursCap × clientHourlyRate for the
 * just-closed month, kind='overage'); `hourly_postpaid` — Σ(hours × clientRateSnapshot)
 * for the cycle that just ended. Cycles: monthly_day_n + weekly_day_x (manual close
 * → closeProjectCycle). `hourly_prepaid` (advance + reconcile) is P-7 (needs the
 * 02-В advance gate). See PROJECTS_SPEC §3.
 *
 * Runs inside the caller's transaction: the cron wraps all tenants (worker /
 * RLS-bypass); the manual `generate` endpoint scopes to one agency.
 *
 * dueDate (P-4): derived from the resolved net payment terms (project → company →
 * agency cascade, `resolveTermsDays`) added to the issue anchor (periodStart for the
 * advance subscription, periodEnd for postpaid/overage). Unconfigured projects keep
 * the legacy per-model dueDate.
 */

const MAX_CATCHUP_PERIODS = 24 // backstop so a stale nextCycleAt can't spin forever

/** First instant (UTC) of the month containing `d`. The canonical period anchor. */
export function startOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
}

/** First instant (UTC) of the month after `d` — advances a monthly anchor by one cycle. */
function addMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
}

/** Shift `d` by `n` calendar days (UTC) — advances/rewinds a weekly anchor/period. */
function addDaysUtc(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n))
}

/** Last calendar day (UTC) of the month containing `d` — the cycle's periodEnd. */
function endOfMonthDateUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
}

/** First instant (UTC) of the month BEFORE `d` — the period a postpaid close bills. */
function firstOfPrevMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
}

/** The cascade fields a charge's dueDate is derived from (P-4). */
interface TermsContext {
  paymentTermsDays: number | null
  company: { paymentTermsDays: number | null }
  agency: { paymentSettings: { paymentTermsDays: number | null } | null }
}

/**
 * Net payment terms (days) for a project, cascading project → company → agency default
 * (05-Г / В10, PROJECTS_SPEC §5). null at every tier → null: the charge keeps its
 * billing-model default dueDate (no behavior change for unconfigured projects).
 */
function resolveTermsDays(p: TermsContext): number | null {
  return (
    p.paymentTermsDays ??
    p.company.paymentTermsDays ??
    p.agency.paymentSettings?.paymentTermsDays ??
    null
  )
}

/**
 * dueDate = issue anchor + net terms (05-Г: «paymentTermsDays від дати виставлення»).
 * Advance charges issue at periodStart, postpaid/overage at periodEnd. When terms are
 * unresolved (null) the caller's legacy per-model dueDate stands — keeps existing
 * unconfigured projects untouched.
 */
function dueDateFromTerms(anchor: Date, termsDays: number | null, legacy: Date): Date {
  return termsDays != null ? addDaysUtc(anchor, termsDays) : legacy
}

/**
 * The cascade-tier (P-4) + loyalty fields BOTH charge producers select from a project.
 * Shared so the two `select`s can never drift apart — add a tier here once and both
 * `closeProjectCycle` and `generateRecurringCharges` pick it up.
 */
const TERMS_TIER_SELECT = {
  paymentTermsDays: true,
  // P-11: cost-approval cascade tiers (project → company → agency floor). on_actuals → the
  // issued charge is born `pending` (draft, out of moneyBalance until released).
  approvalMode: true,
  requiresApproval: true,
  company: {
    select: { loyaltyTier: true, tierOverride: true, paymentTermsDays: true, approvalMode: true },
  },
  agency: {
    select: {
      paymentSettings: { select: { paymentTermsDays: true } },
      defaultApprovalMode: true,
    },
  },
} satisfies Prisma.ProjectSelect

/**
 * Σ(billable revenue) for a project's time in [periodStart, periodEnd] — the
 * snapshotted client rate per hour (P-5) times hours. zeroBilled tasks carry a
 * `clientRateSnapshot` of 0, so they contribute nothing (cost-only) automatically.
 */
async function sumBillableRevenue(
  tx: Prisma.TransactionClient,
  projectId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Prisma.Decimal> {
  const rows = await tx.$queryRaw<Array<{ revenue: Prisma.Decimal | string | null }>>`
    SELECT COALESCE(SUM(t."hours" * t."clientRateSnapshot"), 0) AS revenue
    FROM "time_logs" t
    JOIN "orders" o ON o."id" = t."orderId"
    WHERE o."projectId" = ${projectId}
      AND t."date" >= ${periodStart}
      AND t."date" <= ${periodEnd}
  `
  return new Prisma.Decimal(rows[0]?.revenue ?? 0)
}

export interface ChargeAmounts {
  baseAmount: Prisma.Decimal
  discountPct: Prisma.Decimal
  discountAmount: Prisma.Decimal
  totalAmount: Prisma.Decimal
}

/** Apply the tier's auto-discount to a base price. Pure Decimal — no `Number` rounding drift. */
export function computeChargeAmounts(base: Prisma.Decimal, tier: LoyaltyTier): ChargeAmounts {
  const pct = LOYALTY_DISCOUNT_PCT[tier] ?? 0
  const discountAmount = base.times(pct).div(100).toDecimalPlaces(2)
  return {
    baseAmount: base,
    discountPct: new Prisma.Decimal(pct),
    discountAmount,
    totalAmount: base.minus(discountAmount),
  }
}

export interface GenerateOptions {
  /** Charge every project whose `nextCycleAt` is at or before this instant. */
  now: Date
  /** Scope to one tenant (the manual endpoint); omit for the cross-tenant cron. */
  agencyId?: string
}

export interface GenerateResult {
  /** Newly-inserted charge rows (existing ones are skipped by the unique constraint). */
  created: number
  /** Projects found due this run. */
  due: number
  /** Projects due but HELD by the П3 contract-gate (charges blocked until contract). */
  gated: number
}

/** The project fields a charge is built from (auto cron + manual close share this). */
interface ChargeableProject {
  id: string
  agencyId: string
  companyId: string
  currency: string
  billingModel: string
  abonAmount: Prisma.Decimal | null
}

/**
 * Build one charge row for a project's [periodStart, periodEnd], or null to skip:
 * fixed → abonAmount; hourly_postpaid → Σ(billable hours). Loyalty discount applied.
 * Shared by the auto cron loop and the manual «close cycle» endpoint.
 */
async function buildChargeRow(
  tx: Prisma.TransactionClient,
  p: ChargeableProject,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date,
  tier: LoyaltyTier
): Promise<Prisma.ServiceChargeCreateManyInput | null> {
  let base: Prisma.Decimal | null
  if (p.billingModel === 'fixed_monthly_advance') {
    base = p.abonAmount ?? null
  } else {
    const revenue = await sumBillableRevenue(tx, p.id, periodStart, periodEnd)
    base = revenue.isZero() ? null : revenue // no billable work → no charge
  }
  if (!base) return null
  const amounts = computeChargeAmounts(base, tier)
  return {
    agencyId: p.agencyId,
    companyId: p.companyId,
    projectId: p.id,
    amount: amounts.totalAmount,
    baseAmount: amounts.baseAmount,
    discountPct: amounts.discountPct,
    discountAmount: amounts.discountAmount,
    totalAmount: amounts.totalAmount,
    currency: p.currency,
    month: periodStart,
    periodStart,
    periodEnd,
    kind: p.billingModel === 'fixed_monthly_advance' ? 'subscription' : 'hourly',
    status: 'pending',
    dueDate,
  }
}

/** Σ(hours) for a project's time in [periodStart, periodEnd] — drives the hybrid cap. */
async function sumProjectHours(
  tx: Prisma.TransactionClient,
  projectId: string,
  periodStart: Date,
  periodEnd: Date
): Promise<Prisma.Decimal> {
  const rows = await tx.$queryRaw<Array<{ hours: Prisma.Decimal | string | null }>>`
    SELECT COALESCE(SUM(t."hours"), 0) AS hours
    FROM "time_logs" t
    JOIN "orders" o ON o."id" = t."orderId"
    WHERE o."projectId" = ${projectId}
      AND t."date" >= ${periodStart}
      AND t."date" <= ${periodEnd}
  `
  return new Prisma.Decimal(rows[0]?.hours ?? 0)
}

/** Σ(EstimateLine.hours) for a project — the budgeted hours an advance is sized from (P-7). */
async function sumEstimateHours(
  tx: Prisma.TransactionClient,
  projectId: string
): Promise<Prisma.Decimal> {
  const agg = await tx.estimateLine.aggregate({ where: { projectId }, _sum: { hours: true } })
  return agg._sum.hours ?? new Prisma.Decimal(0)
}

/** The project fields a prepaid cycle is built from. */
interface PrepaidProject {
  id: string
  agencyId: string
  companyId: string
  currency: string
  clientHourlyRate: Prisma.Decimal | null
  advanceGatePct: Prisma.Decimal | null
}

interface Period {
  start: Date
  end: Date
  due: Date
}

/**
 * hourly_prepaid (P-7, 02-В) — the charges one cycle boundary produces:
 *  1. ADVANCE for the upcoming period (`curr`): Σ(estimate hours) × clientHourlyRate ×
 *     advanceGatePct% (loyalty-discounted), kind='prepaid_advance'.
 *  2. RECONCILE the just-closed period (`prev`): actual Σ(hours × clientRateSnapshot)
 *     (loyalty-discounted) − the advance already charged for it → a positive
 *     kind='prepaid_reconciliation' top-up (client under-paid) or a NEGATIVE
 *     kind='prepaid_credit' (client over-paid; a negative line that lifts moneyBalance and
 *     is auto-skipped by FIFO settlement since its outstanding is ≤ 0). The advance amount
 *     is read back from the stored prev-period `prepaid_advance` charge so reconciliation is
 *     exact. Idempotent via @@unique(projectId, periodStart, kind).
 */
async function buildPrepaidCharges(
  tx: Prisma.TransactionClient,
  p: PrepaidProject,
  curr: Period,
  prev: Period,
  tier: LoyaltyTier,
  // Charges already built THIS run but NOT yet inserted — a multi-period catch-up
  // reconciles period N against an advance charged in an EARLIER iteration of the same
  // run, which only lives here until the final createMany. Search it before the DB.
  runRows: Prisma.ServiceChargeCreateManyInput[]
): Promise<Prisma.ServiceChargeCreateManyInput[]> {
  const out: Prisma.ServiceChargeCreateManyInput[] = []
  const base = {
    agencyId: p.agencyId,
    companyId: p.companyId,
    projectId: p.id,
    currency: p.currency,
    status: 'pending' as const,
  }
  const rate = p.clientHourlyRate ?? new Prisma.Decimal(0)
  const pct = p.advanceGatePct ?? new Prisma.Decimal(0)

  // 1. Advance for the upcoming period (only when a rate + gate% are configured).
  if (rate.greaterThan(0) && pct.greaterThan(0)) {
    const estHours = await sumEstimateHours(tx, p.id)
    const advanceBase = estHours.times(rate).times(pct).div(100).toDecimalPlaces(2)
    if (advanceBase.greaterThan(0)) {
      const a = computeChargeAmounts(advanceBase, tier)
      out.push({
        ...base,
        amount: a.totalAmount,
        baseAmount: a.baseAmount,
        discountPct: a.discountPct,
        discountAmount: a.discountAmount,
        totalAmount: a.totalAmount,
        month: curr.start,
        periodStart: curr.start,
        periodEnd: curr.end,
        kind: 'prepaid_advance',
        dueDate: curr.due,
      })
    }
  }

  // 2. Reconcile the just-closed period against the advance charged for it. During a
  // multi-period catch-up the prev-period advance was built earlier in THIS run and is
  // not in the DB yet — search runRows first so reconciliation reads the real advance
  // instead of falling back to 0 (which would double-bill the whole period).
  const actual = await sumBillableRevenue(tx, p.id, prev.start, prev.end)
  const inRun = runRows.find(
    (r) =>
      r.kind === 'prepaid_advance' &&
      r.projectId === p.id &&
      r.periodStart instanceof Date &&
      r.periodStart.getTime() === prev.start.getTime()
  )
  let advancePaid = new Prisma.Decimal(0)
  if (inRun) {
    // This row was built earlier in the same run; its money fields are Prisma.Decimal.
    advancePaid = new Prisma.Decimal((inRun.totalAmount ?? inRun.amount) as Prisma.Decimal.Value)
  } else {
    const prior = await tx.serviceCharge.findFirst({
      where: { projectId: p.id, periodStart: prev.start, kind: 'prepaid_advance' },
      select: { totalAmount: true, amount: true },
    })
    if (prior) advancePaid = new Prisma.Decimal(prior.totalAmount ?? prior.amount)
  }
  const actualOwed = computeChargeAmounts(actual, tier).totalAmount
  const diff = actualOwed.minus(advancePaid).toDecimalPlaces(2)
  if (!diff.isZero()) {
    const credit = diff.lessThan(0)
    out.push({
      ...base,
      amount: diff,
      baseAmount: diff,
      discountPct: new Prisma.Decimal(0),
      discountAmount: new Prisma.Decimal(0),
      totalAmount: diff,
      month: prev.start,
      periodStart: prev.start,
      periodEnd: prev.end,
      kind: credit ? 'prepaid_credit' : 'prepaid_reconciliation',
      dueDate: prev.due,
    })
  }
  return out
}

/**
 * Manually close ONE project's cycle for an explicit [periodStart, periodEnd]
 * (manual billingCycle — owner clicks «Закрити цикл»). Same charge logic as the
 * cron; idempotent via `@@unique([projectId, periodStart])`; refreshes moneyBalance.
 * Caller validates ownership + that the cycle is `manual`.
 */
export async function closeProjectCycle(
  tx: Prisma.TransactionClient,
  opts: { agencyId: string; projectId: string; periodStart: Date; periodEnd: Date }
): Promise<GenerateResult> {
  const p = await tx.project.findFirst({
    where: { id: opts.projectId, agencyId: opts.agencyId },
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      currency: true,
      billingModel: true,
      abonAmount: true,
      contractRequired: true,
      contractDocumentId: true,
      ...TERMS_TIER_SELECT,
    },
  })
  if (!p) return { created: 0, due: 0, gated: 0 }
  // П3 contract-gate (посилено 06-ДОГОВІР-2, рішення власника 06.07): договір має бути
  // ПРИЙНЯТИМ (accepted у порталі або зареєстрований зовнішній) — привʼязана чернетка
  // білінг більше не відкриває.
  if (p.contractRequired) {
    const accepted = p.contractDocumentId
      ? await tx.document.findFirst({
          where: { id: p.contractDocumentId, status: 'accepted' },
          select: { id: true },
        })
      : null
    if (!accepted) {
      throw new AppError(
        ApiErrorCode.CONFLICT,
        'Генерація заблокована: прив’яжіть ПРИЙНЯТИЙ (підписаний) договір до проєкту',
        409
      )
    }
  }
  const tier = (p.company.tierOverride ?? p.company.loyaltyTier) as LoyaltyTier
  // P-4: manual close bills a completed period → issue anchor = periodEnd + net terms
  // (legacy default was periodEnd, i.e. terms = 0).
  const dueDate = dueDateFromTerms(opts.periodEnd, resolveTermsDays(p), opts.periodEnd)
  const built = await buildChargeRow(tx, p, opts.periodStart, opts.periodEnd, dueDate, tier)
  if (!built) return { created: 0, due: 1, gated: 0 }
  // P-11: on_actuals → the manually-closed charge is born a draft, out of moneyBalance
  // until the client/team releases it.
  const row = resolveChargeOnActuals(p) ? { ...built, approvalStatus: 'pending' as const } : built
  const res = await tx.serviceCharge.createMany({ data: [row], skipDuplicates: true })
  if (res.count > 0) {
    await refreshMoneyBalance(tx, { agencyId: opts.agencyId, companyId: p.companyId })
  }
  return { created: res.count, due: 1, gated: 0 }
}

/**
 * Generate the charges owed up to `opts.now` and advance each project's
 * `nextCycleAt`. Idempotent: re-running creates no duplicates (skipDuplicates →
 * `ON CONFLICT DO NOTHING`), and a project already advanced past `now` is not
 * re-billed.
 */
export async function generateRecurringCharges(
  tx: Prisma.TransactionClient,
  opts: GenerateOptions
): Promise<GenerateResult> {
  // П3 contract-gate (посилено 06-ДОГОВІР-2): проект, що вимагає договір без
  // ПРИЙНЯТОГО привʼязаного, — HELD (nextCycleAt не рухається, цикли наздоженуть,
  // коли договір приймуть). Прийнятість — JS-постфільтр (contractDocumentId без FK).
  const dueWhere = {
    active: true,
    billingModel: { in: ['fixed_monthly_advance', 'hourly_postpaid', 'hourly_prepaid'] },
    billingCycle: { in: ['monthly_day_n', 'weekly_day_x'] }, // manual → nextCycleAt null, not due
    nextCycleAt: { lte: opts.now },
    ...(opts.agencyId ? { agencyId: opts.agencyId } : {}),
  } satisfies Prisma.ProjectWhereInput

  const allDue = await tx.project.findMany({
    where: dueWhere,
    select: {
      id: true,
      agencyId: true,
      companyId: true,
      currency: true,
      billingModel: true,
      billingCycle: true,
      abonAmount: true,
      clientHourlyRate: true,
      includedHoursCap: true,
      advanceGatePct: true,
      nextCycleAt: true,
      contractRequired: true,
      contractDocumentId: true,
      ...TERMS_TIER_SELECT,
    },
  })
  // Прийнятість договорів — одним запитом по всіх привʼязаних id
  const contractIds = [
    ...new Set(allDue.map((p) => p.contractDocumentId).filter((id): id is string => id != null)),
  ]
  const acceptedIds = new Set(
    contractIds.length > 0
      ? (
          await tx.document.findMany({
            where: { id: { in: contractIds }, status: 'accepted' },
            select: { id: true },
          })
        ).map((d) => d.id)
      : []
  )
  const isHeld = (p: (typeof allDue)[number]): boolean =>
    p.contractRequired && !(p.contractDocumentId != null && acceptedIds.has(p.contractDocumentId))
  const due = allDue.filter((p) => !isHeld(p))
  const gated = allDue.length - due.length

  const rows: Prisma.ServiceChargeCreateManyInput[] = []
  const advances: Array<{ id: string; nextCycleAt: Date }> = []

  for (const p of due) {
    if (!p.nextCycleAt) continue
    const tier = (p.company.tierOverride ?? p.company.loyaltyTier) as LoyaltyTier
    const termsDays = resolveTermsDays(p) // P-4: cascade once per project
    // P-11: resolve the cost-approval mode once per project; on_actuals charges issue as
    // `pending` drafts (out of moneyBalance/revenue/FIFO until released).
    const onActuals = resolveChargeOnActuals(p)
    // A credit (prepaid_credit, negative) BENEFITS the client — never gate it behind approval,
    // else the client's balance would be under-credited while the credit sits in draft.
    const stamp = (r: Prisma.ServiceChargeCreateManyInput): Prisma.ServiceChargeCreateManyInput =>
      onActuals && r.kind !== 'prepaid_credit' ? { ...r, approvalStatus: 'pending' } : r
    const weekly = p.billingCycle === 'weekly_day_x'
    const advance = weekly ? (d: Date) => addDaysUtc(d, 7) : addMonthUtc
    let cursor = p.nextCycleAt
    let guard = 0
    while (cursor <= opts.now && guard < MAX_CATCHUP_PERIODS) {
      // hourly_prepaid (P-7): advance for the upcoming period + reconcile the just-closed
      // one. Distinct two-charge shape, so it bypasses the single buildChargeRow path.
      if (p.billingModel === 'hourly_prepaid') {
        const cStart = weekly ? cursor : startOfMonthUtc(cursor)
        const cEnd = weekly ? addDaysUtc(cursor, 6) : endOfMonthDateUtc(cStart)
        const pStart = weekly ? addDaysUtc(cursor, -7) : firstOfPrevMonthUtc(cursor)
        const pEnd = weekly ? addDaysUtc(cursor, -1) : endOfMonthDateUtc(pStart)
        const curr = {
          start: cStart,
          end: cEnd,
          due: dueDateFromTerms(
            cStart,
            termsDays,
            weekly ? addDaysUtc(cursor, 7) : addMonthUtc(cStart)
          ),
        }
        const prev = {
          start: pStart,
          end: pEnd,
          due: dueDateFromTerms(
            pEnd,
            termsDays,
            weekly ? addDaysUtc(cursor, 7) : addMonthUtc(pStart)
          ),
        }
        rows.push(...(await buildPrepaidCharges(tx, p, curr, prev, tier, rows)).map(stamp))
        cursor = advance(cursor)
        guard++
        continue
      }
      // Period differs by model/cycle: fixed bills the UPCOMING month in advance;
      // hourly_postpaid bills the cycle that just ENDED, by actual hours. weekly_day_x
      // applies to hourly billing (owner's «щопонеділка»); fixed stays monthly (P-2).
      // dueDate (P-4): issue anchor + net terms — advance issues at periodStart, postpaid
      // at periodEnd; null terms keeps the legacy per-model default.
      let periodStart: Date
      let periodEnd: Date
      let dueDate: Date
      if (p.billingModel === 'fixed_monthly_advance') {
        periodStart = startOfMonthUtc(cursor)
        periodEnd = endOfMonthDateUtc(periodStart)
        dueDate = dueDateFromTerms(periodStart, termsDays, addMonthUtc(periodStart))
      } else if (weekly) {
        periodStart = addDaysUtc(cursor, -7) // the week that just closed
        periodEnd = addDaysUtc(cursor, -1)
        dueDate = dueDateFromTerms(periodEnd, termsDays, addDaysUtc(cursor, 7))
      } else {
        periodStart = firstOfPrevMonthUtc(cursor)
        periodEnd = endOfMonthDateUtc(periodStart)
        dueDate = dueDateFromTerms(periodEnd, termsDays, addMonthUtc(periodStart))
      }
      const row = await buildChargeRow(tx, p, periodStart, periodEnd, dueDate, tier)
      if (row) rows.push(stamp(row))

      // Hybrid overage (P-2d): a fixed project that includes N hours bills the hours
      // OVER the cap for the JUST-CLOSED month at clientHourlyRate — a separate
      // kind='overage' charge (coexists with the subscription advance for that period).
      if (p.billingModel === 'fixed_monthly_advance' && p.includedHoursCap && p.clientHourlyRate) {
        const ovStart = firstOfPrevMonthUtc(cursor)
        const ovEnd = endOfMonthDateUtc(ovStart)
        const overHours = (await sumProjectHours(tx, p.id, ovStart, ovEnd)).minus(
          p.includedHoursCap
        )
        if (overHours.greaterThan(0)) {
          const amounts = computeChargeAmounts(overHours.times(p.clientHourlyRate), tier)
          rows.push(
            stamp({
              agencyId: p.agencyId,
              companyId: p.companyId,
              projectId: p.id,
              amount: amounts.totalAmount,
              baseAmount: amounts.baseAmount,
              discountPct: amounts.discountPct,
              discountAmount: amounts.discountAmount,
              totalAmount: amounts.totalAmount,
              currency: p.currency,
              month: ovStart,
              periodStart: ovStart,
              periodEnd: ovEnd,
              kind: 'overage',
              status: 'pending',
              // overage is postpaid (past usage) → anchor = ovEnd + net terms (P-4)
              dueDate: dueDateFromTerms(ovEnd, termsDays, addMonthUtc(ovStart)),
            })
          )
        }
      }
      cursor = advance(cursor)
      guard++
    }
    advances.push({ id: p.id, nextCycleAt: cursor })
  }

  let created = 0
  if (rows.length > 0) {
    const res = await tx.serviceCharge.createMany({ data: rows, skipDuplicates: true })
    created = res.count
  }
  for (const a of advances) {
    await tx.project.update({ where: { id: a.id }, data: { nextCycleAt: a.nextCycleAt } })
  }

  // AR-11: new charges change Σ(charge.totalAmount) — refresh each affected company's
  // cached moneyBalance in the same tx (sorted for a deterministic lock order; the
  // recompute is a full re-read, so refreshing a skipDuplicates no-op is harmless).
  if (rows.length > 0) {
    const companies = new Map<string, string>()
    for (const r of rows) companies.set(r.companyId, r.agencyId)
    for (const companyId of [...companies.keys()].sort()) {
      const agencyId = companies.get(companyId)
      if (!agencyId) continue
      await refreshMoneyBalance(tx, { agencyId, companyId })
    }
  }

  return { created, due: due.length, gated }
}

/** Parse a `YYYY-MM` to the last instant of that month (UTC) — the `now` a manual generate uses. */
export function endOfMonthUtc(month: string): Date {
  const parts = month.split('-')
  const y = Number(parts[0])
  const m = Number(parts[1]) // 1-based; as a 0-based monthIndex this is the NEXT month
  // First instant of the next month minus 1ms.
  return new Date(Date.UTC(y, m, 1) - 1)
}
