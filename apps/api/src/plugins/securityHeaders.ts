import type { FastifyPluginAsync } from 'fastify'
import helmet from '@fastify/helmet'

const securityHeadersPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: false,
    hsts:
      process.env.NODE_ENV === 'production'
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
          }
        : false,
  })
}

export default securityHeadersPlugin
