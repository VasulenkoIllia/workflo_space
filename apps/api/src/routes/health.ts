import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@workflo/db'

const healthRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/health', async (request, reply) => {
    let dbStatus: 'ok' | 'error' = 'ok'

    try {
      await prisma.$queryRaw`SELECT 1`
    } catch {
      dbStatus = 'error'
    }

    const checks = {
      db: dbStatus,
      uptime: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    }

    const overallStatus = dbStatus === 'ok' ? 'ok' : 'degraded'

    request.log.info({ checks, status: overallStatus }, 'Health check requested')

    if (overallStatus === 'ok') {
      return reply.status(200).send({
        status: overallStatus,
        checks,
      })
    }

    return reply.status(503).send({
      status: overallStatus,
      checks,
    })
  })

  return Promise.resolve()
}

export default healthRoute
