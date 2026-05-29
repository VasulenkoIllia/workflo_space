import { prisma } from '@workflo/db'
import { updateProfileSchema } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { writeAuditAsync } from '../../services/audit.js'

/** PATCH /profile — update own display name / language / theme / avatar. */
const updateProfileRoute: FastifyPluginAsync = (fastify) => {
  fastify.patch('/profile', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const input = updateProfileSchema.parse(request.body)
    const profileId = request.user.sub

    const data: Record<string, unknown> = {}
    if (input.displayName !== undefined) data.name = input.displayName.trim()
    if (input.language !== undefined) data.language = input.language
    if (input.theme !== undefined) data.theme = input.theme
    if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl

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
        },
      },
    })
  })

  return Promise.resolve()
}

export default updateProfileRoute
