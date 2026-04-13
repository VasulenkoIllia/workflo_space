import type { FastifyPluginAsync } from 'fastify'

const securityHeadersPlugin: FastifyPluginAsync = (fastify) => {
  fastify.addHook('onRequest', async (_request, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff')
    reply.header('X-Frame-Options', 'DENY')
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin')
    reply.header('X-DNS-Prefetch-Control', 'off')
    reply.header('X-Download-Options', 'noopen')
    reply.header('X-Permitted-Cross-Domain-Policies', 'none')

    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    }
  })

  return Promise.resolve()
}

export default securityHeadersPlugin
