import { prisma, runWithAgency, withTenant } from '@workflo/db'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { resolvePlatformAgencyId } from '../../auth/agency.js'

/** Public contact / lead capture (S7-04). No auth — the landing posts here cross-origin
 * (CORS allowlist in config/origins.ts already covers the landing origins). ContactForm is
 * platform-level (no agencyId / RLS), so plain `prisma` is correct.
 *
 * Anti-spam: a hidden `website` honeypot (bots fill it → we 200 but persist nothing) plus a
 * tight per-IP rate limit. Cloudflare Turnstile verification is a follow-up once the secret is
 * provisioned. Captured leads live in contact_forms.isRead for a future admin inbox.
 *
 * 26-UTM: every submission also best-effort creates a CRM Lead in the platform agency with
 * the visit's first-touch UTM attribution — the message itself is persisted first and never
 * depends on the intake succeeding. */
const utmField = z.string().trim().max(120).optional()
const contactSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Stored in contact_forms.email — but the landing lets people leave a Telegram handle OR an
  // email ("@tg / email"), so we accept any non-trivial contact string, not a strict RFC email.
  email: z.string().trim().min(3).max(200),
  message: z.string().trim().min(1).max(5000),
  source: z.string().max(60).optional(),
  utmSource: utmField,
  utmMedium: utmField,
  utmCampaign: utmField,
  utmTerm: utmField,
  utmContent: utmField,
  page: z.string().trim().max(300).optional(),
  referrer: z.string().trim().max(500).optional(),
  // Honeypot — real users never see/fill this; any value ⇒ treat as a bot.
  website: z.string().optional(),
})

const EMAIL_LIKE = /^\S+@\S+\.\S+$/

type ContactInput = z.infer<typeof contactSchema>

/** Best-effort CRM intake: contact submission → Lead (+created activity) in the platform
 * agency. Failures are logged, never surfaced to the visitor — the ContactForm row is the
 * durable record either way. */
async function intakeLead(input: ContactInput): Promise<string | null> {
  const agencyId = await resolvePlatformAgencyId(prisma)
  const emailLike = EMAIL_LIKE.test(input.email)
  const utm = {
    utmSource: input.utmSource ?? null,
    utmMedium: input.utmMedium ?? null,
    utmCampaign: input.utmCampaign ?? null,
    utmTerm: input.utmTerm ?? null,
    utmContent: input.utmContent ?? null,
  }
  return runWithAgency(agencyId, () =>
    withTenant(async (tx) => {
      const lead = await tx.lead.create({
        data: {
          agency: { connect: { id: agencyId } },
          name: `Заявка з сайту — ${input.name}`,
          contactName: input.name,
          email: emailLike ? input.email : null,
          source: input.source ?? 'website',
          notes: (emailLike ? '' : `Контакт: ${input.email}\n\n`) + input.message,
          ...utm,
        },
        select: { id: true },
      })
      await tx.leadActivity.create({
        data: {
          agencyId,
          leadId: lead.id,
          actorId: null,
          type: 'created',
          metadata: {
            via: 'website',
            source: input.source ?? 'website',
            ...(input.page ? { page: input.page } : {}),
          },
        },
      })
      return lead.id
    })
  )
}

const contentRoutes: FastifyPluginAsync = (fastify) => {
  fastify.post(
    '/content/contact',
    { config: { rateLimit: { max: 5, timeWindow: '10 minutes' } } },
    async (request, reply) => {
      const parsed = contactSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ success: false, error: { message: 'invalid_input' } })
      }
      const input = parsed.data

      // Honeypot tripped → look successful, store nothing.
      if (input.website && input.website.trim().length > 0) {
        return reply.send({ success: true, data: { received: true } })
      }

      let leadId: string | null = null
      try {
        leadId = await intakeLead(input)
      } catch (err) {
        request.log.error({ err }, 'contact→lead intake failed (message still persisted)')
      }

      await prisma.contactForm.create({
        data: {
          name: input.name,
          email: input.email,
          message: input.message,
          source: input.source ?? 'landing',
          utmSource: input.utmSource ?? null,
          utmMedium: input.utmMedium ?? null,
          utmCampaign: input.utmCampaign ?? null,
          utmTerm: input.utmTerm ?? null,
          utmContent: input.utmContent ?? null,
          page: input.page ?? null,
          referrer: input.referrer ?? null,
          leadId,
        },
      })

      return reply.send({ success: true, data: { received: true } })
    }
  )

  return Promise.resolve()
}

export default contentRoutes
