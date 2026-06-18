import { Prisma } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  type CreateEstimateLineInput,
  type UpdateEstimateLineInput,
} from '@workflo/types'

/**
 * Estimate lines (02-Б, P-6) — a Project's budget positions (service × hours). Creating a
 * line auto-spawns a zeroBilled kanban task (В12) the work is logged against; its hours
 * feed the margin cost and the `includedHoursCap` reconciliation. Deleting a line leaves
 * the task (real logged work). All ops are tenant-checked against the parent project.
 */

export const ESTIMATE_LINE_SELECT = {
  id: true,
  serviceId: true,
  name: true,
  hours: true,
  amount: true,
  orderId: true,
  position: true,
} satisfies Prisma.EstimateLineSelect

export type EstimateLineRow = Prisma.EstimateLineGetPayload<{ select: typeof ESTIMATE_LINE_SELECT }>

export function estimateLineDto(l: EstimateLineRow) {
  return {
    id: l.id,
    serviceId: l.serviceId,
    name: l.name,
    hours: l.hours.toFixed(2),
    amount: l.amount ? l.amount.toFixed(2) : null,
    orderId: l.orderId,
    position: l.position,
  }
}

export interface EstimateSummary {
  lines: ReturnType<typeof estimateLineDto>[]
  totalHours: string
  /** Project subscription hour budget (null when the project has no cap). */
  includedHoursCap: string | null
  /** Σ(line hours) ≤ cap. true when no cap is set (nothing to exceed). */
  withinCap: boolean
  /** cap − Σ hours (null when no cap); negative = over budget (overage billed by P-2). */
  remainingHours: string | null
}

/** Load the tenant's project (id + cap + companyId) or 404. */
async function requireProject(
  tx: Prisma.TransactionClient,
  agencyId: string,
  projectId: string
): Promise<{ id: string; companyId: string; includedHoursCap: Prisma.Decimal | null }> {
  const project = await tx.project.findFirst({
    where: { id: projectId, agencyId },
    select: { id: true, companyId: true, includedHoursCap: true },
  })
  if (!project) throw new AppError(ApiErrorCode.NOT_FOUND, 'Проєкт не знайдено', 404)
  return project
}

/** List a project's estimate lines + the included-hours reconciliation (soft, P-2 bills overage). */
export async function getEstimate(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; projectId: string }
): Promise<EstimateSummary> {
  const project = await requireProject(tx, args.agencyId, args.projectId)
  const lines = await tx.estimateLine.findMany({
    where: { agencyId: args.agencyId, projectId: args.projectId },
    select: ESTIMATE_LINE_SELECT,
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  })
  let totalHours = new Prisma.Decimal(0)
  for (const l of lines) totalHours = totalHours.plus(l.hours)
  const cap = project.includedHoursCap
  return {
    lines: lines.map(estimateLineDto),
    totalHours: totalHours.toFixed(2),
    includedHoursCap: cap ? cap.toFixed(2) : null,
    withinCap: cap ? totalHours.lessThanOrEqualTo(cap) : true,
    remainingHours: cap ? cap.minus(totalHours).toFixed(2) : null,
  }
}

/** Create an estimate line + auto-spawn its zeroBilled kanban task; link the two. */
export async function createEstimateLine(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; projectId: string; actorId: string; input: CreateEstimateLineInput }
): Promise<EstimateLineRow> {
  const project = await requireProject(tx, args.agencyId, args.projectId)
  const order = await tx.order.create({
    data: {
      agencyId: args.agencyId,
      companyId: project.companyId,
      projectId: project.id,
      title: args.input.name,
      createdById: args.actorId,
      zeroBilled: true, // В12: included in the subscription — logged, not billed
      estimatedHours: new Prisma.Decimal(args.input.hours),
    },
    select: { id: true },
  })
  return tx.estimateLine.create({
    data: {
      agencyId: args.agencyId,
      projectId: project.id,
      serviceId: args.input.serviceId ?? null,
      name: args.input.name,
      hours: new Prisma.Decimal(args.input.hours),
      amount: args.input.amount != null ? new Prisma.Decimal(args.input.amount) : null,
      orderId: order.id,
      position: args.input.position ?? 0,
    },
    select: ESTIMATE_LINE_SELECT,
  })
}

/** Update an estimate line; keep the linked zeroBilled task's title/hours in sync. */
export async function updateEstimateLine(
  tx: Prisma.TransactionClient,
  args: {
    agencyId: string
    projectId: string
    lineId: string
    input: UpdateEstimateLineInput
  }
): Promise<EstimateLineRow> {
  const existing = await tx.estimateLine.findFirst({
    where: { id: args.lineId, agencyId: args.agencyId, projectId: args.projectId },
    select: { id: true, orderId: true },
  })
  if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Позицію кошторису не знайдено', 404)

  const data: Prisma.EstimateLineUpdateInput = {}
  if ('serviceId' in args.input)
    data.service = args.input.serviceId
      ? { connect: { id: args.input.serviceId } }
      : { disconnect: true }
  if (args.input.name !== undefined) data.name = args.input.name
  if (args.input.hours !== undefined) data.hours = new Prisma.Decimal(args.input.hours)
  if ('amount' in args.input)
    data.amount = args.input.amount != null ? new Prisma.Decimal(args.input.amount) : null
  if (args.input.position !== undefined) data.position = args.input.position

  const line = await tx.estimateLine.update({
    where: { id: existing.id },
    data,
    select: ESTIMATE_LINE_SELECT,
  })
  // Keep the spawned task aligned with the budget (title + estimated hours).
  if (line.orderId && (args.input.name !== undefined || args.input.hours !== undefined)) {
    await tx.order.update({
      where: { id: line.orderId },
      data: {
        ...(args.input.name !== undefined ? { title: args.input.name } : {}),
        ...(args.input.hours !== undefined
          ? { estimatedHours: new Prisma.Decimal(args.input.hours) }
          : {}),
      },
    })
  }
  return line
}

/** Delete an estimate line. The spawned zeroBilled task is LEFT in place (real logged work). */
export async function deleteEstimateLine(
  tx: Prisma.TransactionClient,
  args: { agencyId: string; projectId: string; lineId: string }
): Promise<void> {
  const existing = await tx.estimateLine.findFirst({
    where: { id: args.lineId, agencyId: args.agencyId, projectId: args.projectId },
    select: { id: true },
  })
  if (!existing) throw new AppError(ApiErrorCode.NOT_FOUND, 'Позицію кошторису не знайдено', 404)
  await tx.estimateLine.delete({ where: { id: existing.id } })
}
