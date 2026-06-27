import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

// Public contact endpoint (S7-04) — no auth; honeypot + validation are the boundary.
const contactCreate = vi.fn()

vi.mock('@workflo/db', () => ({
  prisma: { contactForm: { create: contactCreate } },
  tenantTransaction: (c: unknown, fn: (tx: unknown) => unknown) => fn(c),
  withTenant: (fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@workflo/notifications', () => ({ notify: vi.fn() }))

const { buildApp } = await import('../src/app.js')

let app: Awaited<ReturnType<typeof buildApp>>
beforeAll(async () => {
  app = await buildApp()
})
afterEach(() => vi.clearAllMocks())

const post = (payload: unknown) =>
  app.inject({ method: 'POST', url: '/content/contact', payload: payload as object })

describe('POST /content/contact', () => {
  it('persists a valid submission', async () => {
    contactCreate.mockResolvedValue({ id: 'c-1' })
    const res = await post({ name: 'Іван', email: 'ivan@example.com', message: 'Привіт' })
    expect(res.statusCode).toBe(200)
    expect(contactCreate).toHaveBeenCalledOnce()
  })

  it('honeypot field ⇒ 200 but stores nothing', async () => {
    const res = await post({
      name: 'Bot',
      email: 'bot@example.com',
      message: 'spam',
      website: 'http://spam.example',
    })
    expect(res.statusCode).toBe(200)
    expect(contactCreate).not.toHaveBeenCalled()
  })

  it('rejects invalid input with 400', async () => {
    const res = await post({ name: '', email: 'not-an-email', message: '' })
    expect(res.statusCode).toBe(400)
    expect(contactCreate).not.toHaveBeenCalled()
  })
})
