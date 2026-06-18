import { Prisma } from '@workflo/db'

/**
 * Margin engine v1 (S5.6 P-9, PROJECTS_SPEC §4.1 — 22-Д cost allocation lifted into
 * the core). For a project `P` over `[from, to]`:
 *
 *   revenue(P) = Σ ServiceCharge.totalAmount (projectId = P, month ∈ [t1,t2])   // accrual
 *   cost(P)    = Σ over TimeLog of the project's orders: hours × costRateUsd     // §2.3 / П7
 *   margin(P)  = revenue(P) − cost(P) ; margin% = margin / revenue
 *
 * Everything is normalized to USD (sibling of `pnl.ts`): revenue is converted with the
 * agency's stored ExchangeRate; cost is already a per-date USD snapshot (P-5/П7), so it
 * needs no FX. Cost INCLUDES zero-billed task hours (clientRate=0 but the cost is real)
 * — that is precisely how the owner sees whether a subscription project is profitable.
 *
 * Two views sit on top of the accrual (П2): the accrued `margin`, and an «оплачено N%»
 * indicator overlaying cash actually collected (Σ PaymentAllocation) on the revenue.
 *
 * Visibility (§4.3): margin/cost is agency-admin-only (owner) — enforced at the route.
 * Executors never see client rates or margin.
 */

/** USD-normalize a native amount (mirrors `pnl.ts`: USD pass-through, UAH via stored FX). */
function toUsd(
  amount: Prisma.Decimal,
  currency: string,
  usdToUah: Prisma.Decimal | null
): Prisma.Decimal {
  if (currency === 'USD') return amount
  if (currency === 'UAH' && usdToUah && usdToUah.greaterThan(0)) return amount.div(usdToUah)
  return amount // unknown currency / missing rate → counted as-is (documented, as in pnl.ts)
}

export interface ExecutorCost {
  executorId: string
  hours: string
  costUsd: string
}

export interface ProjectMargin {
  projectId: string
  projectName: string
  currency: string
  revenueUsd: string
  costUsd: string
  marginUsd: string
  marginPct: string
  /** Cash actually collected against this period's charges (accrual overlay, П2). */
  paidUsd: string
  paidPct: string
  /** Cost split by executor (same TimeLogs, grouped by `executorId`) — revenue is project-level. */
  byExecutor: ExecutorCost[]
}

interface ExecutorCostRaw {
  executorId: string
  hours: Prisma.Decimal
  costUsd: Prisma.Decimal
}

interface ProjectMarginRaw {
  projectId: string
  projectName: string
  currency: string
  revenueUsd: Prisma.Decimal
  costUsd: Prisma.Decimal
  marginUsd: Prisma.Decimal
  paidUsd: Prisma.Decimal
  byExecutor: ExecutorCostRaw[]
}

function pct(part: Prisma.Decimal, whole: Prisma.Decimal): Prisma.Decimal {
  return whole.greaterThan(0)
    ? part.div(whole).times(100).toDecimalPlaces(2)
    : new Prisma.Decimal(0)
}

export function projectMarginDto(r: ProjectMarginRaw): ProjectMargin {
  return {
    projectId: r.projectId,
    projectName: r.projectName,
    currency: r.currency,
    revenueUsd: r.revenueUsd.toFixed(2),
    costUsd: r.costUsd.toFixed(2),
    marginUsd: r.marginUsd.toFixed(2),
    marginPct: pct(r.marginUsd, r.revenueUsd).toFixed(2),
    paidUsd: r.paidUsd.toFixed(2),
    paidPct: pct(r.paidUsd, r.revenueUsd).toFixed(2),
    byExecutor: r.byExecutor.map((e) => ({
      executorId: e.executorId,
      hours: e.hours.toFixed(2),
      costUsd: e.costUsd.toFixed(2),
    })),
  }
}

interface MarginScope {
  agencyId: string
  projectId: string
  from: Date
  to: Date
}

/** The agency's stored USD→UAH rate (or null) — the single FX basis for revenue normalization. */
async function getUsdToUah(
  tx: Prisma.TransactionClient,
  agencyId: string
): Promise<Prisma.Decimal | null> {
  const rate = await tx.exchangeRate.findUnique({
    where: { agencyId },
    select: { usdToUah: true },
  })
  return rate?.usdToUah ?? null
}

/** Compute one project's margin (Decimal-precise). Returns null if the project is not in the tenant. */
async function projectMarginRaw(
  tx: Prisma.TransactionClient,
  scope: MarginScope,
  usdToUah: Prisma.Decimal | null
): Promise<ProjectMarginRaw | null> {
  const project = await tx.project.findFirst({
    where: { id: scope.projectId, agencyId: scope.agencyId },
    select: { id: true, name: true, currency: true },
  })
  if (!project) return null

  // Revenue (accrual) + cash collected — both in the project's native currency, then → USD.
  const [revenueAgg, paidAgg] = await Promise.all([
    tx.serviceCharge.aggregate({
      where: {
        agencyId: scope.agencyId,
        projectId: scope.projectId,
        month: { gte: scope.from, lte: scope.to },
      },
      _sum: { totalAmount: true, amount: true },
    }),
    tx.paymentAllocation.aggregate({
      where: {
        agencyId: scope.agencyId,
        charge: { is: { projectId: scope.projectId, month: { gte: scope.from, lte: scope.to } } },
      },
      _sum: { amount: true },
    }),
  ])
  // totalAmount is the post-discount owed amount; fall back to `amount` for any legacy row.
  const revenueNative =
    revenueAgg._sum.totalAmount ?? revenueAgg._sum.amount ?? new Prisma.Decimal(0)
  const paidNative = paidAgg._sum.amount ?? new Prisma.Decimal(0)
  const revenueUsd = toUsd(revenueNative, project.currency, usdToUah)
  const paidUsd = toUsd(paidNative, project.currency, usdToUah)

  // Cost = Σ hours × costRateUsd, grouped by executor (a product-sum Prisma's groupBy can't
  // express, so raw SQL). costRateUsd is already a per-date USD snapshot (П7) — no FX here.
  // A TimeLog with no resolved cost rate (cascade tier 5) carries null → counts as 0 cost.
  const costRows = await tx.$queryRaw<
    Array<{ executorId: string; hours: string | null; cost: string | null }>
  >`
    SELECT t."executorId" AS "executorId",
           COALESCE(SUM(t."hours"), 0) AS hours,
           COALESCE(SUM(t."hours" * COALESCE(t."costRateUsd", 0)), 0) AS cost
    FROM "time_logs" t
    JOIN "orders" o ON o."id" = t."orderId"
    WHERE t."agencyId" = ${scope.agencyId}
      AND o."projectId" = ${scope.projectId}
      AND t."date" >= ${scope.from}
      AND t."date" <= ${scope.to}
    GROUP BY t."executorId"
    ORDER BY t."executorId"
  `
  const byExecutor: ExecutorCostRaw[] = costRows.map((r) => ({
    executorId: r.executorId,
    hours: new Prisma.Decimal(r.hours ?? 0),
    costUsd: new Prisma.Decimal(r.cost ?? 0),
  }))
  let costUsd = new Prisma.Decimal(0)
  for (const e of byExecutor) costUsd = costUsd.plus(e.costUsd)

  return {
    projectId: project.id,
    projectName: project.name,
    currency: project.currency,
    revenueUsd,
    costUsd,
    marginUsd: revenueUsd.minus(costUsd),
    paidUsd,
    byExecutor,
  }
}

/** Public: one project's margin as a DTO, or null if not found in the tenant. */
export async function computeProjectMargin(
  tx: Prisma.TransactionClient,
  args: MarginScope
): Promise<ProjectMargin | null> {
  const usdToUah = await getUsdToUah(tx, args.agencyId)
  const raw = await projectMarginRaw(tx, args, usdToUah)
  return raw ? projectMarginDto(raw) : null
}

export interface ClientMargin {
  companyId: string
  revenueUsd: string
  costUsd: string
  marginUsd: string
  marginPct: string
  paidUsd: string
  paidPct: string
  /** Per-project breakdown (only projects with revenue or cost in the window). */
  projects: ProjectMargin[]
}

interface ClientScope {
  agencyId: string
  companyId: string
  from: Date
  to: Date
}

/** Raw per-project margins for every project of a client (drives both the DTO and net-income). */
async function clientProjectMarginsRaw(
  tx: Prisma.TransactionClient,
  scope: ClientScope,
  usdToUah: Prisma.Decimal | null
): Promise<ProjectMarginRaw[]> {
  const projects = await tx.project.findMany({
    where: { agencyId: scope.agencyId, companyId: scope.companyId },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  // Per-project margins are independent reads — fan out on the same tx (the pnl.ts /
  // payout.ts pattern) rather than a sequential chain, which matters when this runs
  // across an executor's referred clients inside the payout-draft transaction.
  const results = await Promise.all(
    projects.map((p) =>
      projectMarginRaw(
        tx,
        { agencyId: scope.agencyId, projectId: p.id, from: scope.from, to: scope.to },
        usdToUah
      )
    )
  )
  return results.filter((r): r is ProjectMarginRaw => r !== null)
}

/**
 * Public: a client's margin rolled up over all their projects (§4.1 consolidated view).
 * Returns null if the company is not in the tenant (route maps to 404, like the project
 * endpoint) — so a guessed cross-tenant UUID is not a silent zero-margin oracle.
 */
export async function computeClientMargin(
  tx: Prisma.TransactionClient,
  scope: ClientScope
): Promise<ClientMargin | null> {
  const company = await tx.company.findFirst({
    where: { id: scope.companyId, agencyId: scope.agencyId },
    select: { id: true },
  })
  if (!company) return null

  const usdToUah = await getUsdToUah(tx, scope.agencyId)
  const raws = await clientProjectMarginsRaw(tx, scope, usdToUah)

  let revenueUsd = new Prisma.Decimal(0)
  let costUsd = new Prisma.Decimal(0)
  let paidUsd = new Prisma.Decimal(0)
  for (const r of raws) {
    revenueUsd = revenueUsd.plus(r.revenueUsd)
    costUsd = costUsd.plus(r.costUsd)
    paidUsd = paidUsd.plus(r.paidUsd)
  }
  const marginUsd = revenueUsd.minus(costUsd)

  return {
    companyId: scope.companyId,
    revenueUsd: revenueUsd.toFixed(2),
    costUsd: costUsd.toFixed(2),
    marginUsd: marginUsd.toFixed(2),
    marginPct: pct(marginUsd, revenueUsd).toFixed(2),
    paidUsd: paidUsd.toFixed(2),
    paidPct: pct(paidUsd, revenueUsd).toFixed(2),
    // Only surface projects that had activity in the window (keeps the response tidy).
    projects: raws
      .filter((r) => r.revenueUsd.greaterThan(0) || r.costUsd.greaterThan(0))
      .map(projectMarginDto),
  }
}

/**
 * Net income (= Σ project margin) for a client over a window, as a Decimal. The
 * employee-referral accrual (P-9b, §4.2) is `netIncome × refPct`. Kept Decimal-precise
 * (no `toFixed`) so callers do exact money math.
 */
export async function computeClientNetIncomeUsd(
  tx: Prisma.TransactionClient,
  scope: ClientScope
): Promise<Prisma.Decimal> {
  const usdToUah = await getUsdToUah(tx, scope.agencyId)
  const raws = await clientProjectMarginsRaw(tx, scope, usdToUah)
  let net = new Prisma.Decimal(0)
  for (const r of raws) net = net.plus(r.marginUsd)
  return net
}
