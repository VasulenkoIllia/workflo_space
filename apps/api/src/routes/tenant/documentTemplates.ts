import { prisma, withTenant } from '@workflo/db'
import { type DocumentRenderData, defaultContractSections } from '@workflo/templates'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireOwnerAgency } from '../../auth/tenant.js'
import type { AccessClaims } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { TEMPLATE_VARIABLES } from '../../services/documentTemplates.js'
import { getStorage } from '../../services/storage.js'

/**
 * 06-А: шаблони документів (owner). Один шаблон на тип; нема рядка = системний.
 * contract → {sections:[{h,p[]}]}; інші → {note?, purpose? (лише рахунки)}.
 * + PDF-брендинг агенції: лого (storage) + акцентний hex-колір.
 */
const TEMPLATE_TYPES = [
  'contract',
  'invoice',
  'advance_invoice',
  'completion_act',
  'specification',
  'reconciliation_act',
] as const

const sectionSchema = z.object({
  h: z.string().trim().min(1).max(200),
  p: z.array(z.string().trim().min(1).max(4000)).min(1).max(20),
})
const contractBodySchema = z.object({ sections: z.array(sectionSchema).min(1).max(30) }).strict()
const noteBodySchema = z
  .object({
    note: z.string().trim().max(2000).optional(),
    purpose: z.string().trim().max(600).optional(),
  })
  .strict()
  .refine((b) => b.note !== undefined || b.purpose !== undefined, {
    message: 'Порожній шаблон — видаліть його замість збереження',
  })

function assertOwner(user: AccessClaims): string {
  return requireOwnerAgency(user, 'Шаблони документів змінює лише власник')
}

/** Типовий договір з {{токенами}} — стартова точка редактора. */
function contractDefaultWithTokens(): { h: string; p: string[] }[] {
  const stub: DocumentRenderData = {
    typeLabel: 'Договір',
    number: '{{number}}',
    date: '{{date}}',
    orderTitle: '{{order}}',
    amount: '{{amount}}',
    currency: '',
    issuer: { name: '{{agency}}' },
    recipient: { name: '{{client}}' },
  }
  return defaultContractSections(stub)
}

const documentTemplatesRoute: FastifyPluginAsync = (fastify) => {
  // ── Шаблони: список overrides + довідка змінних + типовий договір ─────────────
  fastify.get(
    '/workspace/agency/document-templates',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const templates = await withTenant((tx) =>
        tx.documentTemplate.findMany({
          where: { agencyId },
          select: { type: true, body: true, updatedAt: true },
        })
      )
      return reply.send({
        success: true,
        data: {
          templates,
          variables: TEMPLATE_VARIABLES,
          contractDefault: contractDefaultWithTokens(),
        },
      })
    }
  )

  fastify.put<{ Params: { type: string } }>(
    '/workspace/agency/document-templates/:type',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const type = request.params.type as (typeof TEMPLATE_TYPES)[number]
      if (!TEMPLATE_TYPES.includes(type)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Невідомий тип документа', 400)
      }
      const body =
        type === 'contract'
          ? contractBodySchema.parse(request.body)
          : noteBodySchema.parse(request.body)

      const template = await withTenant((tx) =>
        tx.documentTemplate.upsert({
          where: { agencyId_type: { agencyId, type } },
          create: { agencyId, type, body, updatedById: request.user.sub },
          update: { body, updatedById: request.user.sub },
          select: { type: true, body: true, updatedAt: true },
        })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.document_template_updated',
        resourceType: 'document_template',
        resourceId: type,
        result: 'allowed',
        metadata: { type },
      })
      return reply.send({ success: true, data: { template } })
    }
  )

  fastify.delete<{ Params: { type: string } }>(
    '/workspace/agency/document-templates/:type',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      await withTenant((tx) =>
        tx.documentTemplate.deleteMany({ where: { agencyId, type: request.params.type as never } })
      )
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.document_template_reset',
        resourceType: 'document_template',
        resourceId: request.params.type,
        result: 'allowed',
        metadata: {},
      })
      return reply.send({ success: true, data: { reset: true } })
    }
  )

  // ── PDF-брендинг: лого + акцент ───────────────────────────────────────────────
  fastify.get(
    '/workspace/agency/pdf-branding',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { pdfLogoKey: true, pdfAccentColor: true },
      })
      return reply.send({
        success: true,
        data: { hasLogo: !!agency?.pdfLogoKey, accentColor: agency?.pdfAccentColor ?? null },
      })
    }
  )

  // PUT: multipart (лого PNG/JPEG + accentColor) або JSON (лише accentColor / зняти лого)
  fastify.put(
    '/workspace/agency/pdf-branding',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)

      let accentColor: string | null | undefined
      let removeLogo = false
      let logoBuffer: Buffer | null = null
      let logoMime = ''
      if (request.isMultipart()) {
        const part = await request.file()
        if (part) {
          if (!['image/png', 'image/jpeg'].includes(part.mimetype)) {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Лого — лише PNG або JPEG', 415)
          }
          logoBuffer = await part.toBuffer()
          if (logoBuffer.length > 512 * 1024) {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Лого завелике (макс. 512 КБ)', 413)
          }
          logoMime = part.mimetype
          const fields = part.fields as Record<string, { value?: unknown } | undefined>
          accentColor = fields.accentColor?.value as string | undefined
        }
      } else {
        const body = z
          .object({
            accentColor: z
              .string()
              .regex(/^#[0-9a-fA-F]{6}$/, 'Колір — hex формату #RRGGBB')
              .nullable()
              .optional(),
            removeLogo: z.boolean().optional(),
          })
          .strict()
          .parse(request.body ?? {})
        accentColor = body.accentColor
        removeLogo = body.removeLogo ?? false
      }
      if (accentColor !== undefined && accentColor !== null) {
        if (!/^#[0-9a-fA-F]{6}$/.test(accentColor)) {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Колір — hex формату #RRGGBB', 400)
        }
      }

      const current = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { pdfLogoKey: true },
      })

      let pdfLogoKey = current?.pdfLogoKey ?? null
      if (logoBuffer) {
        pdfLogoKey = `${agencyId}/branding/logo.${logoMime === 'image/png' ? 'png' : 'jpg'}`
        await getStorage().upload({ key: pdfLogoKey, buffer: logoBuffer, contentType: logoMime })
      } else if (removeLogo && pdfLogoKey) {
        await getStorage()
          .delete(pdfLogoKey)
          .catch(() => undefined)
        pdfLogoKey = null
      }

      const agency = await prisma.agency.update({
        where: { id: agencyId },
        data: {
          pdfLogoKey,
          ...(accentColor !== undefined ? { pdfAccentColor: accentColor } : {}),
        },
        select: { pdfLogoKey: true, pdfAccentColor: true },
      })
      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId,
        action: 'agency.pdf_branding_updated',
        resourceType: 'agency',
        resourceId: agencyId,
        result: 'allowed',
        metadata: { hasLogo: !!agency.pdfLogoKey, accentColor: agency.pdfAccentColor },
      })
      return reply.send({
        success: true,
        data: { hasLogo: !!agency.pdfLogoKey, accentColor: agency.pdfAccentColor },
      })
    }
  )

  // Прев'ю лого для settings-картки
  fastify.get(
    '/workspace/agency/pdf-branding/logo',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const agencyId = assertOwner(request.user)
      const agency = await prisma.agency.findUnique({
        where: { id: agencyId },
        select: { pdfLogoKey: true },
      })
      if (!agency?.pdfLogoKey) throw new AppError(ApiErrorCode.NOT_FOUND, 'Лого не задано', 404)
      const buffer = await getStorage().read(agency.pdfLogoKey)
      return reply
        .header('Content-Type', agency.pdfLogoKey.endsWith('.png') ? 'image/png' : 'image/jpeg')
        .send(buffer)
    }
  )

  return Promise.resolve()
}

export default documentTemplatesRoute
