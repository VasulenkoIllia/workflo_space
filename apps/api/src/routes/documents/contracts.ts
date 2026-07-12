import { randomUUID } from 'node:crypto'
import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireActiveAgency } from '../../auth/tenant.js'
import { isAgencyManager, isInternalTeam } from '../../auth/tokens.js'
import { writeAuditAsync } from '../../services/audit.js'
import { getStorage } from '../../services/storage.js'
import { DOC_SELECT } from './shared.js'

/**
 * R2 (аудит r6, розбиття documents.ts): ЗОВНІШНІ договори (06-ДОГОВІР-2) —
 * реєстрація підписаного поза системою договору + віддача його файла.
 */
const contractsRoute: FastifyPluginAsync = (fastify) => {
  // ── 06-ДОГОВІР-2: реєстрація ЗОВНІШНЬОГО договору (підписаний поза системою) ──
  // Owner/executor (не manager — фінартефакт): власний номер + дата підписання +
  // підписант + файл (multipart, PDF) АБО посилання. Створюється одразу accepted.
  fastify.post<{ Params: { companyId: string } }>(
    '/workspace/companies/:companyId/contracts/external',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const agencyId = requireActiveAgency(user)
      if (!isInternalTeam(user) || isAgencyManager(user, agencyId)) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Доступ лише для команди', 403)
      }
      const company = await withTenant((tx) =>
        tx.company.findFirst({
          where: { id: request.params.companyId, agencyId },
          select: { id: true },
        })
      )
      if (!company) throw new AppError(ApiErrorCode.NOT_FOUND, 'Компанію не знайдено', 404)

      // multipart (файл + поля) або чистий JSON (без файла)
      let fields: Record<string, unknown>
      let fileBuffer: Buffer | null = null
      if (request.isMultipart()) {
        const part = await request.file()
        if (part) {
          if (part.mimetype !== 'application/pdf') {
            throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Файл договору — лише PDF', 415)
          }
          fileBuffer = await part.toBuffer()
          fields = Object.fromEntries(
            Object.entries(part.fields).map(([k, v]) => [
              k,
              (v as { value?: unknown }).value ?? undefined,
            ])
          )
        } else {
          fields = {}
        }
      } else {
        fields = (request.body ?? {}) as Record<string, unknown>
      }

      const input = z
        .object({
          number: z.string().trim().min(1).max(60),
          contractDate: z.coerce.date(),
          signerName: z.string().trim().min(3).max(120),
          externalUrl: z.string().trim().url().max(500).optional(),
        })
        .parse(fields)

      const docId = randomUUID()
      let storedAs: string | null = null
      if (fileBuffer) {
        storedAs = `${agencyId}/contracts/${docId}.pdf`
        await getStorage().upload({
          key: storedAs,
          buffer: fileBuffer,
          contentType: 'application/pdf',
        })
      }

      let document
      try {
        document = await withTenant((tx) =>
          tx.document.create({
            data: {
              id: docId,
              agency: { connect: { id: agencyId } },
              type: 'contract',
              number: input.number,
              company: { connect: { id: company.id } },
              status: 'accepted',
              signedExternally: true,
              contractDate: input.contractDate,
              acceptedAt: input.contractDate,
              acceptedByName: input.signerName,
              ...(storedAs ? { storedAs } : {}),
              ...(input.externalUrl ? { externalUrl: input.externalUrl } : {}),
              createdBy: { connect: { id: user.sub } },
            },
            select: {
              ...DOC_SELECT,
              signedExternally: true,
              contractDate: true,
              externalUrl: true,
            },
          })
        )
      } catch (err) {
        if (storedAs)
          await getStorage()
            .delete(storedAs)
            .catch(() => undefined)
        if ((err as { code?: string }).code === 'P2002') {
          throw new AppError(
            ApiErrorCode.CONFLICT,
            `Договір з номером «${input.number}» у цієї компанії вже є`,
            409
          )
        }
        throw err
      }

      writeAuditAsync(request.log, {
        actorId: user.sub,
        agencyId,
        action: 'documents.external_contract_registered',
        resourceType: 'document',
        resourceId: document.id,
        result: 'allowed',
        metadata: { number: input.number, companyId: company.id, hasFile: !!storedAs },
      })
      return reply.status(201).send({ success: true, data: { document } })
    }
  )

  // ── 06-ДОГОВІР-2: віддати збережений файл договору (storedAs) ─────────────────
  fastify.get<{ Params: { docId: string } }>(
    '/documents/:docId/file',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const user = request.user
      const doc = await withTenant((tx) =>
        tx.document.findFirst({
          where: { id: request.params.docId, storedAs: { not: null } },
          select: { number: true, storedAs: true, agencyId: true, companyId: true },
        })
      )
      if (!doc?.storedAs) throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл не знайдено', 404)
      const isTeam =
        isInternalTeam(user) &&
        user.agencyMemberships.some((m) => m.agencyId === doc.agencyId) &&
        !isAgencyManager(user, doc.agencyId)
      const isCompanyClient = user.memberships.some((m) => m.companyId === doc.companyId)
      if (!isTeam && !isCompanyClient) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Немає доступу до документа', 403)
      }
      const buffer = await getStorage().read(doc.storedAs)
      // Зовнішні номери містять не-ASCII («№ 8/2026») — у header лише ASCII-safe
      // fallback + RFC 5987 filename* з повним номером.
      const safeName = doc.number.replace(/[^\w.-]+/g, '_') || 'contract'
      return reply
        .header('Content-Type', 'application/pdf')
        .header(
          'Content-Disposition',
          `inline; filename="${safeName}.pdf"; filename*=UTF-8''${encodeURIComponent(doc.number)}.pdf`
        )
        .send(buffer)
    }
  )

  return Promise.resolve()
}

export default contractsRoute
