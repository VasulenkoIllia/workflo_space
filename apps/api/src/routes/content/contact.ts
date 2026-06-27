import { prisma } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

/** Public contact / lead capture (S7-04). No auth — the landing posts here cross-origin
 * (CORS allowlist in config/origins.ts already covers the landing origins). ContactForm is
 * platform-level (no agencyId / RLS), so plain `prisma` is correct.
 *
 * Anti-spam: a hidden `website` honeypot (bots fill it → we 200 but persist nothing) plus a
 * tight per-IP rate limit. Cloudflare Turnstile verification is a follow-up once the secret is
 * provisioned. Captured leads live in contact_forms.isRead for a future admin inbox. */
const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Stored in contact_forms.email — but the landing lets people leave a Telegram handle OR an
  // email ("@tg / email"), so we accept any non-trivial contact string, not a strict RFC email.
  email: z.string().trim().min(3).max(200),
  message: z.string().trim().min(1).max(5000),
  source: z.string().max(60).optional(),
  // Honeypot — real users never see/fill this; any value ⇒ treat as a bot.
  website: z.string().optional(),
})

const contentRoutes: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/content/contact',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const parsed = contactSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { message: 'invalid_input' } })
      }
      const { name, email, message, source, website } = parsed.data

      // Honeypot tripped → look successful, store nothing.
      if (website && website.trim().length > 0) {
        return reply.send({ success: true, data: { received: true } })
      }

      await prisma.contactForm.create({
        data: { name, email, message, source: source ?? 'landing' },
      })

      return reply.send({ success: true, data: { received: true } })
    }
  )

  return Promise.resolve()
}

export default contentRoutes
