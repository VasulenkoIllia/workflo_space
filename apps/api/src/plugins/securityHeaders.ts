import helmet from '@fastify/helmet'
import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

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

// MUST be fp-wrapped: helmet's `global` hook is added in the registering context.
// Without fp the plugin is encapsulated and security headers (CSP, HSTS,
// X-Content-Type-Options, …) never reach the sibling route plugins, silently
// disabling them on every real response (caught during S5 UI testing, 2026-06).
export default fp(securityHeadersPlugin, { name: 'security-headers-plugin', fastify: '5.x' })
