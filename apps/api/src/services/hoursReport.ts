import { type Prisma } from '@workflo/db'

/**
 * Hours plan-vs-actual report (19, 12-ПЛАН-ФАКТ). For a date window it sums logged TimeLog
 * hours and compares each order's estimate (the "plan") to the hours actually logged in the
 * window (the "fact"). All window-scoped — "за період". Capacity-norm planning (норма×тижні)
 * needs a per-executor capacity field (not yet modelled), so this uses the order estimate as
 * the plan, which is available today.
 */

const ROUND2 = (n: number): number => Math.round(n * 100) / 100

export interface HoursReportOrderRow {
  orderId: string
  title: string
  projectName: string | null
  estimatedHours: number | null
  loggedHours: number
  /** loggedHours − estimatedHours (null when the order has no estimate). */
  variance: number | null
}

export interface HoursReportExecutorRow {
  executorId: string
  name: string
  loggedHours: number
}

export interface HoursReport {
  from: string
  to: string
  byOrder: HoursReportOrderRow[]
  byExecutor: HoursReportExecutorRow[]
  totals: { estimatedHours: number; loggedHours: number; variance: number }
}

const TIMELOG_SELECT = {
  hours: true,
  executorId: true,
  orderId: true,
  executor: { select: { name: true } },
  order: {
    select: {
      id: true,
      title: true,
      estimatedHours: true,
      project: { select: { name: true } },
    },
  },
} as const

export async function computeHoursReport(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; from: string; to: string }
): Promise<HoursReport> {
  const { agencyId, from, to } = args
  // TimeLog.date is a DATE column → midnight-aligned; lte `to` includes that whole day.
  // Exclude a still-running timer (endedAt null) — its hours aren't final yet.
  const rows = await tx.timeLog.findMany({
    where: {
      agencyId,
      date: { gte: new Date(from), lte: new Date(to) },
      OR: [{ startedAt: null }, { endedAt: { not: null } }],
    },
    select: TIMELOG_SELECT,
  })

  const orders = new Map<string, HoursReportOrderRow>()
  const execs = new Map<string, HoursReportExecutorRow>()
  let loggedTotal = 0

  for (const r of rows) {
    const h = Number(r.hours)
    loggedTotal += h

    const o = orders.get(r.orderId)
    if (o) {
      o.loggedHours = ROUND2(o.loggedHours + h)
    } else {
      orders.set(r.orderId, {
        orderId: r.orderId,
        title: r.order?.title ?? '—',
        projectName: r.order?.project?.name ?? null,
        estimatedHours: r.order?.estimatedHours != null ? Number(r.order.estimatedHours) : null,
        loggedHours: ROUND2(h),
        variance: null,
      })
    }

    const e = execs.get(r.executorId)
    if (e) {
      e.loggedHours = ROUND2(e.loggedHours + h)
    } else {
      execs.set(r.executorId, {
        executorId: r.executorId,
        name: r.executor?.name ?? '—',
        loggedHours: ROUND2(h),
      })
    }
  }

  let estTotal = 0
  const byOrder = [...orders.values()].map((o) => {
    if (o.estimatedHours != null) {
      estTotal += o.estimatedHours
      o.variance = ROUND2(o.loggedHours - o.estimatedHours)
    }
    return o
  })
  byOrder.sort((a, b) => b.loggedHours - a.loggedHours)
  const byExecutor = [...execs.values()].sort((a, b) => b.loggedHours - a.loggedHours)

  return {
    from,
    to,
    byOrder,
    byExecutor,
    totals: {
      estimatedHours: ROUND2(estTotal),
      loggedHours: ROUND2(loggedTotal),
      variance: ROUND2(loggedTotal - estTotal),
    },
  }
}

/** CSV: one section for orders (plan-vs-actual), then executors. */
export function hoursReportToCsv(r: HoursReport): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines: string[] = [`Години (план-факт) ${r.from} — ${r.to}`, '']
  lines.push('Замовлення,Проєкт,Оцінка (год),Факт (год),Відхилення (год)')
  for (const o of r.byOrder) {
    lines.push(
      [
        esc(o.title),
        esc(o.projectName ?? '—'),
        o.estimatedHours ?? '',
        o.loggedHours,
        o.variance ?? '',
      ].join(',')
    )
  }
  lines.push(
    ['РАЗОМ', '', r.totals.estimatedHours, r.totals.loggedHours, r.totals.variance].join(',')
  )
  lines.push('', 'Виконавець,Факт (год)')
  for (const e of r.byExecutor) lines.push([esc(e.name), e.loggedHours].join(','))
  return lines.join('\n')
}
