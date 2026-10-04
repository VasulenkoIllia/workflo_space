import { type Prisma, prisma, withTenant } from '@workflo/db'
import { ApiErrorCode, AppError, updateProfileSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'
import { buildProfileExport } from '../../services/gdprExport.js'

/** PATCH /profile — update own display name / language / theme / avatar. */
const updateProfileRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body)
    const profileId = request.user.sub

    const data: Prisma.ProfileUpdateInput = {}
    if (input.displayName !== undefined) data.name = input.displayName.trim()
    if (input.language !== undefined) data.language = input.language
    if (input.theme !== undefined) data.theme = input.theme
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl
    // S9-06 (хвіст): телефон + часовий пояс. Timezone валідуємо через Intl —
    // невідома зона кинула б RangeError у кожному майбутньому форматуванні.
    if (input.phone !== undefined) data.phone = input.phone === '' ? null : input.phone
    if (input.timezone !== undefined) {
      if (input.timezone) {
        try {
          new Intl.DateTimeFormat('en', { timeZone: input.timezone })
        } catch {
          throw new AppError(
            ApiErrorCode.VALIDATION_ERROR,
            'Невідомий часовий пояс (очікується IANA-назва, напр. Europe/Kyiv)',
            400
          )
        }
      }
      data.timezone = input.timezone === '' ? null : input.timezone
    }

    const profile = await prisma.profile.update({
      where: { id: profileId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        language: true,
        theme: true,
        avatarUrl: true,
        phone: true,
        timezone: true,
      },
    })

    writeAuditAsync(request.log, {
      actorId: profileId,
      action: 'profile.updated',
      resourceType: 'profile',
      resourceId: profileId,
      result: 'allowed',
      metadata: { fields: Object.keys(data) },
    })

    return reply.status(200).send({
      success: true,
      data: {
        profile: {
          id: profile.id,
          email: profile.email,
          displayName: profile.name,
          role: profile.role,
          language: profile.language,
          theme: profile.theme,
          avatarUrl: profile.avatarUrl,
          phone: profile.phone,
          timezone: profile.timezone,
        },
      },
    })
  })

  // GET /profile/export — GDPR-вивантаження власних даних (S9-06). JSON-attachment.
  fastify.get('/profile/export', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const profileId = request.user.sub
    // withTenant → tenant-таблиці (сповіщення/тікети/відсутності) у скоупі активної
    // агенції; identity-таблиці (profile/settings) без RLS — читаються так само.
    const data = await withTenant((tx) => buildProfileExport(tx as never, profileId, new Date()))
    writeAuditAsync(request.log, {
      actorId: profileId,
      action: 'profile.exported',
      resourceType: 'profile',
      resourceId: profileId,
      result: 'allowed',
    })
    return reply
      .header('Content-Type', 'application/json; charset=utf-8')
      .header('Content-Disposition', 'attachment; filename="workflo-my-data.json"')
      .header('Cache-Control', 'private, no-store')
      .send(JSON.stringify(data, null, 2))
  })

  return Promise.resolve()
}

export default updateProfileRoute
