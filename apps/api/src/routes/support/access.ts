import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyRequest } from 'fastify'
import { assertSameTenant } from '../../auth/tenant.js'
import { isInternalTeam } from '../../auth/tokens.js'

/**
 * 29 Support access — дзеркалить requireOrderParticipant (03/02). Клієнт бачить лише
 * тікети СВОЇХ компаній; команда (isInternalTeam) — усі тікети агенції. Повертає скоуп
 * для leak-guard (internal-нотатки невидимі клієнту).
 */
export interface TicketAccess {
  ticketId: string
  agencyId: string
  companyId: string | null
  isInternal: boolean
}

export async function requireTicketParticipant(
  request: FastifyRequest,
  ticketId: string
): Promise<TicketAccess> {
  const user = request.user
  const notFound = () => new AppError(ApiErrorCode.NOT_FOUND, 'Тікет не знайдено', 404)

  const ticket = await withTenant((tx) =>
    tx.ticket.findUnique({
      where: { id: ticketId },
      select: { id: true, agencyId: true, companyId: true },
    })
  )
  if (!ticket) throw notFound()
  assertSameTenant(user, ticket.agencyId)

  const isInternal = isInternalTeam(user)
  if (!isInternal) {
    // клієнт — лише тікети компаній, де він учасник
    const inCompany =
      ticket.companyId != null && user.memberships.some((m) => m.companyId === ticket.companyId)
    if (!inCompany) throw notFound() // той самий тенант, інша компанія → ховаємо
  }
  return { ticketId: ticket.id, agencyId: ticket.agencyId, companyId: ticket.companyId, isInternal }
}

// ── Серіалізація повідомлення з leak-guard (author.kind + internal → лише команді) ──
export const TICKET_MESSAGE_SELECT = {
  id: true,
  content: true,
  isInternal: true,
  createdAt: true,
  editedAt: true,
  authorId: true,
  // author.agencyMemberships → мітка команда/клієнт; agencyId для kind, стрипиться перед send
  author: { select: { id: true, name: true, agencyMemberships: { select: { agencyId: true } } } },
} as const

interface RawTicketMessage {
  id: string
  content: string
  isInternal: boolean
  createdAt: Date
  editedAt: Date | null
  authorId: string
  author?: { id: string; name: string; agencyMemberships?: { agencyId: string }[] } | null
}

/**
 * Читаючий DTO повідомлення. `author.kind` = 'team' якщо автор — член агенції тікета,
 * інакше 'client'. Сирі memberships зрізаються. Internal-повідомлення фільтруються
 * ВИЩЕ (у роуті) для клієнта — серіалізатор лише мітить kind.
 */
export function serializeTicketMessage(m: RawTicketMessage, agencyId: string) {
  const isTeam = (m.author?.agencyMemberships ?? []).some((am) => am.agencyId === agencyId)
  return {
    id: m.id,
    content: m.content,
    isInternal: m.isInternal,
    createdAt: m.createdAt,
    editedAt: m.editedAt,
    author: {
      id: m.authorId,
      name: m.author?.name ?? 'Учасник',
      kind: isTeam ? ('team' as const) : ('client' as const),
    },
  }
}
