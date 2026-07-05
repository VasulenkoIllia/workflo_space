import { type Prisma, withTenant } from '@workflo/db'
import { listOrdersQuerySchema, OrderInternalStatus, OrderPriority } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

function parseEnumList<T extends string>(
  csv: string | undefined,
  valid: readonly T[]
): T[] | undefined {
  if (!csv) return undefined
  const set = new Set<string>(valid)
  const out = csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => set.has(s)) as T[]
  return out.length ? out : undefined
}

/**
 * GET /orders — tenant-scoped list (ADR-004). Clients see only orders of the
 * companies they belong to; internal team (executor) sees all orders in the
 * agency. Supports status/priority/search filters + pagination + sort.
 */
const listOrdersRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/orders', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const q = listOrdersQuerySchema.parse(request.query)
    const user = request.user
    const agencyId = requireActiveAgency(user)

    const where: Prisma.OrderWhereInput = { agencyId, deletedAt: null }
    const isInternal = isInternalTeam(user)

    if (!isInternal) {
      const memberCompanyIds = user.memberships.map((m) => m.companyId)
      const allowed = q.companyId
        ? memberCompanyIds.filter((id) => id === q.companyId)
        : memberCompanyIds
      // `__none__` guarantees an empty result for a client with no companies.
      where.companyId = { in: allowed.length ? allowed : ['__none__'] }
    } else if (q.companyId) {
      where.companyId = q.companyId
    }

    // Triage filter (variant B): workspace can scope to a specific executor or to
    // unassigned (`assigneeId=none`). Clients can't filter by executor.
    if (isInternal && q.assigneeId) {
      where.assigneeId = q.assigneeId === 'none' ? null : q.assigneeId
    }

    const statuses = parseEnumList(q.status, Object.values(OrderInternalStatus))
    if (statuses) where.internalStatus = { in: statuses }
    const priorities = parseEnumList(q.priority, Object.values(OrderPriority))
    if (priorities) where.priority = { in: priorities }
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: 'insensitive' } },
        { description: { contains: q.search, mode: 'insensitive' } },
      ]
    }

    // S10-01: фільтр по тегах (AND не потрібен — будь-який зі списку)
    if (q.tags) {
      const tagIds = q.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
      if (tagIds.length) where.tags = { some: { tagId: { in: tagIds } } }
    }

    const sortField = q.sortBy === 'dueDate' ? 'deadline' : q.sortBy
    const orderBy = { [sortField]: q.sortDir } as Prisma.OrderOrderByWithRelationInput

    // RLS read scope (F4 / ADR-007): count + rows run inside one tenant tx so the
    // `app.current_agency_id` GUC is set for both (no-op unless RLS_ENFORCED). The
    // app-layer `where.agencyId` is the primary filter; RLS is the DB backstop.
    const { total, rows } = await withTenant(async (tx) => ({
      total: await tx.order.count({ where }),
      rows: await tx.order.findMany({
        where,
        orderBy,
        skip: (q.page - 1) * q.limit,
        take: q.limit,
        select: {
          id: true,
          title: true,
          internalStatus: true,
          clientStatus: true,
          priority: true,
          deadline: true,
          totalAmount: true,
          companyId: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { stages: true } },
          tags: { select: { tag: { select: { id: true, name: true, color: true } } } },
        },
      }),
    }))

    return reply.send({
      success: true,
      data: {
        orders: rows.map((o) => ({
          id: o.id,
          title: o.title,
          clientStatus: o.clientStatus,
          ...(isInternal ? { internalStatus: o.internalStatus } : {}),
          ...(isInternal ? { tags: o.tags.map((t) => t.tag) } : {}),
          priority: o.priority,
          dueDate: o.deadline,
          totalAmount: o.totalAmount == null ? null : Number(o.totalAmount),
          companyId: o.companyId,
          stageCount: o._count.stages,
          createdAt: o.createdAt,
          updatedAt: o.updatedAt,
        })),
        pagination: {
          page: q.page,
          limit: q.limit,
          total,
          totalPages: Math.ceil(total / q.limit),
        },
      },
    })
  })

  return Promise.resolve()
}

export default listOrdersRoute
