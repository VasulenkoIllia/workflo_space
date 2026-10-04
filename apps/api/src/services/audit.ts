import { prisma } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'

export interface AuditEntry {
  agencyId?: string | null
  actorId?: string | null
  action: string
  resourceType?: string | null
  resourceId?: string | null
  result: 'allowed' | 'denied' | 'error'
  metadata?: Record<string, unknown>
}

/** Persist an audit_logs row. Throws on DB error — callers usually wrap with writeAuditAsync. */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      agencyId: entry.agencyId ?? null,
      actorId: entry.actorId ?? null,
      action: entry.action,
      resourceType: entry.resourceType ?? null,
      resourceId: entry.resourceId ?? null,
      result: entry.result,
      metadata: entry.metadata as object | undefined,
    },
  })
}

/** Fire-and-forget audit write — never blocks or fails the request path. */
export function writeAuditAsync(logger: FastifyBaseLogger, entry: AuditEntry): void {
  void writeAudit(entry).catch((err: unknown) => {
    logger.error({ err, action: entry.action }, 'audit write failed')
  })
}
