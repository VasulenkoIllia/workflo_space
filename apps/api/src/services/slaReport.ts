import { type Prisma } from '@workflo/db'

/**
 * SLA-compliance звіт (S11, спека 02-orders §C). Для вікна [from, to] по замовленнях,
 * СТВОРЕНИХ у вікні і з проштампованим SLA (firstResponseDueAt/resolutionDueAt зі SlaPolicy):
 *
 * - Перша відповідь: точні мітки є (firstRespondedAt vs firstResponseDueAt) — met/late/pending.
 * - Розвʼязання: у Order нема doneAt, тому момент закриття беремо з ActivityLog
 *   (перший `status_changed` → done); fallback — updatedAt (для legacy-рядків без активності).
 *   Скасовані виключаються зі знаменника розвʼязання.
 *
 * % рахується лише по «розсуджених» (met+late) — pending не тягне метрику вниз.
 */

export interface SlaSideStats {
  met: number
  late: number
  pending: number
  /** met / (met+late) × 100; null коли нема розсуджених. */
  compliancePct: number | null
}

export interface SlaAssigneeRow {
  assigneeId: string | null
  name: string
  total: number
  firstResponse: SlaSideStats
  resolution: SlaSideStats
}

export interface SlaBreachedOrderRow {
  orderId: string
  title: string
  assigneeName: string | null
  kind: 'first_response' | 'resolution'
  dueAt: string
}

export interface SlaReport {
  from: string
  to: string
  /** Замовлення вікна з проштампованим SLA. */
  total: number
  firstResponse: SlaSideStats
  resolution: SlaSideStats
  byAssignee: SlaAssigneeRow[]
  /** Останні порушення (up to 20) для списку «розібрати». */
  breachedOrders: SlaBreachedOrderRow[]
}

type Db = Pick<Prisma.TransactionClient, 'order' | 'activityLog'>

interface OrderRow {
  id: string
  title: string
  assigneeId: string | null
  assignee: { name: string } | null
  internalStatus: string
  firstResponseDueAt: Date | null
  firstRespondedAt: Date | null
  resolutionDueAt: Date | null
  updatedAt: Date
}

function emptySide(): { met: number; late: number; pending: number } {
  return { met: 0, late: 0, pending: 0 }
}

function withPct(s: { met: number; late: number; pending: number }): SlaSideStats {
  const judged = s.met + s.late
  return { ...s, compliancePct: judged === 0 ? null : Math.round((s.met / judged) * 1000) / 10 }
}

export async function computeSlaReport(
  db: Db,
  opts: { agencyId: string; from: string; to: string; now?: Date }
): Promise<SlaReport> {
  const now = opts.now ?? new Date()
  const windowEnd = new Date(new Date(opts.to).getTime() + 86_400_000) // inclusive `to`

  const orders = (await db.order.findMany({
    where: {
      agencyId: opts.agencyId,
      deletedAt: null,
      createdAt: { gte: new Date(opts.from), lt: windowEnd },
      OR: [{ firstResponseDueAt: { not: null } }, { resolutionDueAt: { not: null } }],
    },
    select: {
      id: true,
      title: true,
      assigneeId: true,
      assignee: { select: { name: true } },
      internalStatus: true,
      firstResponseDueAt: true,
      firstRespondedAt: true,
      resolutionDueAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'asc' },
  })) as OrderRow[]

  // doneAt із таймлайну — одним запитом по всіх done-замовленнях вікна.
  const doneIds = orders.filter((o) => o.internalStatus === 'done').map((o) => o.id)
  const doneAt = new Map<string, Date>()
  if (doneIds.length > 0) {
    const acts = await db.activityLog.findMany({
      where: { orderId: { in: doneIds }, action: 'status_changed' },
      select: { orderId: true, createdAt: true, metadata: true },
      orderBy: { createdAt: 'asc' },
    })
    for (const a of acts) {
      const to = (a.metadata as { to?: string } | null)?.to
      if (to === 'done' && !doneAt.has(a.orderId)) doneAt.set(a.orderId, a.createdAt)
    }
  }

  const totalFr = emptySide()
  const totalRes = emptySide()
  const byAssignee = new Map<
    string,
    {
      assigneeId: string | null
      name: string
      total: number
      fr: ReturnType<typeof emptySide>
      res: ReturnType<typeof emptySide>
    }
  >()
  const breached: SlaBreachedOrderRow[] = []

  for (const o of orders) {
    const key = o.assigneeId ?? '(unassigned)'
    let row = byAssignee.get(key)
    if (!row) {
      row = {
        assigneeId: o.assigneeId,
        name: o.assignee?.name ?? 'Без виконавця',
        total: 0,
        fr: emptySide(),
        res: emptySide(),
      }
      byAssignee.set(key, row)
    }
    row.total += 1

    // Перша відповідь
    if (o.firstResponseDueAt) {
      const due = o.firstResponseDueAt
      if (o.firstRespondedAt) {
        const bucket = o.firstRespondedAt.getTime() <= due.getTime() ? 'met' : 'late'
        totalFr[bucket] += 1
        row.fr[bucket] += 1
      } else if (due.getTime() < now.getTime()) {
        totalFr.late += 1
        row.fr.late += 1
        breached.push({
          orderId: o.id,
          title: o.title,
          assigneeName: o.assignee?.name ?? null,
          kind: 'first_response',
          dueAt: due.toISOString(),
        })
      } else {
        totalFr.pending += 1
        row.fr.pending += 1
      }
    }

    // Розвʼязання (скасовані — поза знаменником)
    if (o.resolutionDueAt && o.internalStatus !== 'cancelled') {
      const due = o.resolutionDueAt
      if (o.internalStatus === 'done') {
        const closedAt = doneAt.get(o.id) ?? o.updatedAt
        const bucket = closedAt.getTime() <= due.getTime() ? 'met' : 'late'
        totalRes[bucket] += 1
        row.res[bucket] += 1
      } else if (due.getTime() < now.getTime()) {
        totalRes.late += 1
        row.res.late += 1
        breached.push({
          orderId: o.id,
          title: o.title,
          assigneeName: o.assignee?.name ?? null,
          kind: 'resolution',
          dueAt: due.toISOString(),
        })
      } else {
        totalRes.pending += 1
        row.res.pending += 1
      }
    }
  }

  breached.sort((a, b) => (a.dueAt < b.dueAt ? 1 : -1))

  return {
    from: opts.from,
    to: opts.to,
    total: orders.length,
    firstResponse: withPct(totalFr),
    resolution: withPct(totalRes),
    byAssignee: [...byAssignee.values()]
      .map((r) => ({
        assigneeId: r.assigneeId,
        name: r.name,
        total: r.total,
        firstResponse: withPct(r.fr),
        resolution: withPct(r.res),
      }))
      .sort((a, b) => b.total - a.total),
    breachedOrders: breached.slice(0, 20),
  }
}
