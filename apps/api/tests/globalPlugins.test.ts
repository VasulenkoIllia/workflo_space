import { describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// Minimal @workflo/db mock — /health never touches the DB, we only need the
// module to load so buildApp() can register every route plugin. Mirrors the
// proven shape used by billing.test.ts (importOriginal just for the Prisma ns).
vi.mock('@workflo/db', async (importOriginal) => {
  const actual = (await importOriginal()) as { Prisma: unknown }
  const prisma = { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) }
  return {
    prisma,
    Prisma: actual.Prisma,
    tenantTransaction: (_client: unknown, fn: (tx: unknown) => unknown) => fn(prisma),
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
  }
})

vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

/**
 * Regression guard for the fp-encapsulation bug (2026-06): cors / helmet /
 * rate-limit plugins were registered WITHOUT fastify-plugin, so their global
 * onRequest hooks lived in encapsulated sibling contexts and never reached the
 * actual route handlers. Preflight (a global `OPTIONS *` route) still emitted
 * ACAO, masking the bug — but real responses shipped with NO security/CORS
 * headers and every browser client was blocked. This asserts all three plugins
 * reach a real route response.
 */
describe('global plugins reach route responses (fp encapsulation guard)', () => {
  it('emits CORS, helmet and rate-limit headers on a real (non-preflight) response', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'http://localhost:3000' },
    })

    expect(res.statusCode).toBe(200)

    // CORS: the hook must reach the route, not only the OPTIONS * preflight route.
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(res.headers['access-control-allow-credentials']).toBe('true')

    // helmet: CSP + nosniff must be present on the actual response.
    expect(String(res.headers['content-security-policy'])).toContain("default-src 'none'")
    expect(res.headers['x-content-type-options']).toBe('nosniff')

    // rate-limit: the limiter must be attached to the route (headers present).
    expect(res.headers['x-ratelimit-limit']).toBeDefined()

    await app.close()
  })

  // Regression (ROADMAP:1085, verified 05.10): the limiter's errorResponseBuilder returned a
  // plain object — @fastify/rate-limit throws it, the error handler saw no AppError and
  // answered 500 "Щось пішло не так" (+ a Sentry event) to a user who only mistyped a password.
  it('answers 429 RATE_LIMITED (not 500) once a route limit is exceeded', async () => {
    const app = buildApp()
    const hit = () =>
      app.inject({ method: 'POST', url: '/auth/login', payload: {}, remoteAddress: '10.9.9.9' })

    // login: max 10 / 15 min. An empty body fails validation (400) before any DB access.
    for (let i = 0; i < 10; i += 1) {
      expect((await hit()).statusCode).toBe(400)
    }
    const res = await hit()

    expect(res.statusCode).toBe(429)
    expect(res.json()).toMatchObject({
      success: false,
      error: { code: 'RATE_LIMITED', message: expect.stringContaining('Забагато запитів') },
    })
    expect(res.headers['retry-after']).toBeDefined()

    await app.close()
  })

  it('rejects a disallowed cross-origin request (CORS allowlist still enforced)', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/health',
      headers: { origin: 'https://evil.example.com' },
    })

    // Non-allowlisted origin → no ACAO reflected back (request not CORS-approved).
    expect(res.headers['access-control-allow-origin']).toBeUndefined()

    await app.close()
  })
})
