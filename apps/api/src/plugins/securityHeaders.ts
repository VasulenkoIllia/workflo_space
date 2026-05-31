import type { FastifyPluginAsync } from 'fastify'
import helmet from '@fastify/helmet'

const securityHeadersPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(helmet, {
    global: true,
    // Pure JSON API — lock everything down. A locked CSP is a cheap defense layer
    // and harmless for non-HTML responses (security audit 31.05).
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
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
