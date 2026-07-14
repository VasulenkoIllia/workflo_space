import { prisma, tenantTransaction } from '@workflo/db'
import { ApiErrorCode, AppError, INVITE_TTL_MS, inviteExecutorSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { can } from '../../auth/can.js'
import { requireActiveAgency } from '../../auth/tenant.js'
import { generateOpaqueToken } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { sendExecutorInviteEmail } from '../../services/inviteEmail.js'

/** POST /workspace/team/invite — invite an executor (internal team). */
const createExecutorInviteRoute: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/workspace/team/invite',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!can(request.user, 'executor.invite')) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Запрошувати виконавців може лише команда', 403)
      }

      const input = inviteExecutorSchema.parse(request.body)
      const email = input.email.toLowerCase().trim()
      const inviterId = request.user.sub
      // Stamp the inviter's agency so acceptance can create the AgencyMember (R-1).
      const agencyId = requireActiveAgency(request.user)

      // Supersede prior pending invites + issue the new one atomically, so a
      // double-submit can't leave two live invites for the same email (audit S0-S2).
      const invite = await tenantTransaction(prisma, async (tx) => {
        await tx.invite.updateMany({
          where: { email, type: 'executor', usedAt: null },
          data: { usedAt: new Date() },
        })
        return tx.invite.create({
          data: {
            agencyId,
            email,
            token: generateOpaqueToken(),
            type: 'executor',
            invitedById: inviterId,
            expiresAt: new Date(Date.now() + INVITE_TTL_MS),
          },
          select: { id: true, token: true, expiresAt: true },
        })
      })

      const inviter = await prisma.profile.findUnique({
        where: { id: inviterId },
        select: { name: true },
      })

      const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
      sendExecutorInviteEmail(request.log, {
        to: email,
        inviterName: inviter?.name ?? 'Workflo',
        acceptUrl: `${workspaceUrl}/invite/${invite.token}`,
        expiresAt: invite.expiresAt.toISOString().slice(0, 16).replace('T', ' '),
      })

      writeAuditAsync(request.log, {
        actorId: inviterId,
        agencyId,
        action: 'executor.invited',
        resourceType: 'invite',
        resourceId: invite.id,
        result: 'allowed',
        metadata: { email },
      })

      return reply.status(201).send({
        success: true,
        data: { inviteId: invite.id, email, expiresAt: invite.expiresAt },
      })
    }
  )

  // ── TEAM-ADMIN-2: керування pending-запрошеннями (таб «Запрошення») ───────────

  // Список живих (не прийнятих, не скасованих) executor-інвайтів агенції.
  fastify.get(
    '/workspace/team/invites',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!can(request.user, 'executor.invite')) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const agencyId = requireActiveAgency(request.user)
      const invites = await tenantTransaction(prisma, (tx) =>
        tx.invite.findMany({
          where: { agencyId, type: 'executor', usedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true,
            email: true,
            createdAt: true,
            expiresAt: true,
            invitedBy: { select: { name: true } },
          },
        })
      )
      return reply.send({
        success: true,
        data: {
          invites: invites.map((i) => ({
            id: i.id,
            email: i.email,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
            invitedByName: i.invitedBy.name,
            expired: i.expiresAt.getTime() < Date.now(),
          })),
        },
      })
    }
  )

  // Повторно надіслати: продовжує TTL і шле лист з ТИМ САМИМ токеном (лінк у
  // старому листі лишається робочим — менше плутанини для запрошеного).
  fastify.post<{ Params: { id: string } }>(
    '/workspace/team/invites/:id/resend',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: { max: 20, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      if (!can(request.user, 'executor.invite')) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const agencyId = requireActiveAgency(request.user)
      const invite = await tenantTransaction(prisma, async (tx) => {
        const existing = await tx.invite.findFirst({
          where: { id: request.params.id, agencyId, type: 'executor', usedAt: null },
          select: { id: true },
        })
        if (!existing) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Запрошення не знайдено', 404)
        }
        return tx.invite.update({
          where: { id: existing.id },
          data: { expiresAt: new Date(Date.now() + INVITE_TTL_MS) },
          select: { id: true, email: true, token: true, expiresAt: true },
        })
      })
      const inviter = await prisma.profile.findUnique({
        where: { id: request.user.sub },
        select: { name: true },
      })
      const workspaceUrl = process.env.WORKSPACE_URL ?? 'https://work.workflo.space'
      sendExecutorInviteEmail(request.log, {
        to: invite.email,
        inviterName: inviter?.name ?? 'Workflo',
        acceptUrl: `${workspaceUrl}/invite/${invite.token}`,
        expiresAt: invite.expiresAt.toISOString().slice(0, 16).replace('T', ' '),
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'executor.invite_resent',
        resourceType: 'invite',
        resourceId: invite.id,
        result: 'allowed',
        metadata: { email: invite.email },
      })
      return reply.send({ success: true, data: { id: invite.id, expiresAt: invite.expiresAt } })
    }
  )

  // Скасувати: usedAt=now — accept-роут таке запрошення відхиляє.
  fastify.delete<{ Params: { id: string } }>(
    '/workspace/team/invites/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      if (!can(request.user, 'executor.invite')) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступно лише команді', 403)
      }
      const agencyId = requireActiveAgency(request.user)
      await tenantTransaction(prisma, async (tx) => {
        const updated = await tx.invite.updateMany({
          where: { id: request.params.id, agencyId, type: 'executor', usedAt: null },
          data: { usedAt: new Date() },
        })
        if (updated.count === 0) {
          throw new AppError(ApiErrorCode.NOT_FOUND, 'Запрошення не знайдено', 404)
        }
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'executor.invite_cancelled',
        resourceType: 'invite',
        resourceId: request.params.id,
        result: 'allowed',
      })
      return reply.send({ success: true, data: { id: request.params.id } })
    }
  )

  return Promise.resolve()
}

export default createExecutorInviteRoute
