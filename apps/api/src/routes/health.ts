import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@workflo/db'

async function getDbStatus(): Promise<'ok' | 'error'> {
  try {
    await prisma.$queryRaw`SELECT 1`
    return 'ok'
  } catch {
    return 'error'
  }
}

const healthRoute: FastifyPluginAsync = (fastify) => {
  fastify.get('/health', async (request, reply) => {
    const checks = {
      uptime: Math.floor(process.uptime()),
      version: process.env.APP_VERSION ?? process.env.npm_package_version ?? '0.1.0',
      timestamp: new Date().toISOString(),
    }

    request.log.debug({ checks, status: 'ok' }, 'Liveness check requested')

    return reply.status(200).send({
      status: 'ok',
      checks,
    })
  })

  fastify.get('/ready', async (request, reply) => {
    const dbStatus = await getDbStatus()
    const isReady = dbStatus === 'ok'

    request.log.debug({ db: dbStatus, ready: isReady }, 'Readiness check requested')

    return reply.status(isReady ? 200 : 503).send({
      status: isReady ? 'ready' : 'not-ready',
      checks: {
        db: dbStatus,
      },
      timestamp: new Date().toISOString(),
    })
  })

  return Promise.resolve()
}

export default healthRoute
