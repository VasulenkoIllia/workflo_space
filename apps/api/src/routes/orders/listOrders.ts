import { type Prisma, prisma } from '@workflo/db'
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

    const sortField = q.sortBy === 'dueDate' ? 'deadline' : q.sortBy
    const orderBy = { [sortField]: q.sortDir } as Prisma.OrderOrderByWithRelationInput

    // Two standalone queries (the RLS extension scopes each on its own connection
    // via the tenant GUC); count + rows needn't share one transaction for a list.
    const total = await prisma.order.count({ where })
    const rows = await prisma.order.findMany({
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
      },
    })

    return reply.send({
      success: true,
      data: {
        orders: rows.map((o) => ({
          id: o.id,
          title: o.title,
          clientStatus: o.clientStatus,
          ...(isInternal ? { internalStatus: o.internalStatus } : {}),
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
