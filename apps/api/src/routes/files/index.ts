import { randomUUID } from 'node:crypto'
import '@fastify/multipart'
import { prisma } from '@workflo/db'
import { ApiErrorCode, AppError, isAllowedFileMimeType, MAX_FILES_PER_ORDER } from '@workflo/types'
import { buildOrderFileKey, safeExt, sha256Hex } from '@workflo/storage'
import type { FastifyPluginAsync } from 'fastify'
import { assertWithinQuota } from '../../saas/limits.js'
import { writeAuditAsync } from '../../services/audit.js'
import { getStorage } from '../../services/storage.js'
import { requireOrderParticipant } from '../orders/access.js'
import { FILE_META_SELECT, requireFileAccess } from './access.js'

/** RFC 5987 Content-Disposition; always `attachment` (no inline render → no stored-XSS). */
function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
}

const fileRoutes: FastifyPluginAsync = (fastify) => {
  // ── Upload (multipart, one file) ─────────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    '/orders/:id/files',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)

      const part = await request.file()
      if (!part) throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Файл відсутній', 400)
      if (!isAllowedFileMimeType(part.mimetype)) {
        throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Тип файлу не дозволено', 415)
      }

      const existing = await prisma.orderFile.count({
        where: { orderId: access.orderId, deletedAt: null },
      })
      if (existing >= MAX_FILES_PER_ORDER) {
        throw new AppError(
          ApiErrorCode.CONFLICT,
          `Ліміт ${MAX_FILES_PER_ORDER} файлів на замовлення`,
          409
        )
      }

      let buffer: Buffer
      try {
        buffer = await part.toBuffer()
      } catch (err) {
        if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') {
          throw new AppError(ApiErrorCode.VALIDATION_ERROR, 'Файл перевищує ліміт розміру', 413)
        }
        throw err
      }

      // F2: storage quota seam (no-op Phase 0; checks plan bytes in Phase 1).
      await assertWithinQuota(access.agencyId, 'storage', buffer.length)

      const fileId = randomUUID()
      const key = buildOrderFileKey(access.agencyId, access.orderId, fileId, safeExt(part.filename))
      await getStorage().upload({ key, buffer, contentType: part.mimetype })

      let file
      try {
        file = await prisma.orderFile.create({
          data: {
            id: fileId,
            agency: { connect: { id: access.agencyId } },
            order: { connect: { id: access.orderId } },
            uploader: { connect: { id: request.user.sub } },
            filename: part.filename,
            storedAs: key,
            mimeType: part.mimetype,
            sizeBytes: buffer.length,
            sha256: sha256Hex(buffer),
          },
          select: FILE_META_SELECT,
        })
      } catch (err) {
        // DB insert failed after the blob landed → remove the orphan blob.
        await getStorage()
          .delete(key)
          .catch(() => undefined)
        throw err
      }

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId: access.agencyId,
        action: 'order.file_uploaded',
        resourceType: 'order',
        resourceId: access.orderId,
        result: 'allowed',
        metadata: { fileId, sizeBytes: buffer.length, mimeType: part.mimetype },
      })

      return reply.status(201).send({ success: true, data: { file } })
    }
  )

  // ── List an order's files ────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/orders/:id/files',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const access = await requireOrderParticipant(request, request.params.id)
      const files = await prisma.orderFile.findMany({
        where: { orderId: access.orderId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        select: FILE_META_SELECT,
      })
      return reply.send({ success: true, data: { files } })
    }
  )

  // ── File metadata ────────────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    '/files/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { file } = await requireFileAccess(request, request.params.id)
      return reply.send({
        success: true,
        data: {
          file: {
            id: file.id,
            filename: file.filename,
            mimeType: file.mimeType,
            sizeBytes: file.sizeBytes,
            sha256: file.sha256,
            uploadedBy: file.uploadedBy,
            createdAt: file.createdAt,
          },
        },
      })
    }
  )

  // ── Serve binary content (access-checked, forced download) ───────────────
  fastify.get<{ Params: { id: string } }>(
    '/files/:id/content',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { file } = await requireFileAccess(request, request.params.id)

      let buffer: Buffer
      try {
        // `storedAs` is a DB value, never user input; the adapter still guards traversal.
        buffer = await getStorage().read(file.storedAs)
      } catch (err) {
        request.log.error({ err, fileId: file.id }, 'file blob read failed')
        throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл недоступний', 404)
      }

      return reply
        .header('Content-Type', file.mimeType)
        .header('Content-Disposition', attachmentDisposition(file.filename))
        .header('X-Content-Type-Options', 'nosniff')
        .header('Cache-Control', 'private, no-store')
        .send(buffer)
    }
  )

  // ── Soft delete (uploader or internal team) ──────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    '/files/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { file, access } = await requireFileAccess(request, request.params.id)
      if (!access.isInternal && file.uploadedBy !== request.user.sub) {
        throw new AppError(ApiErrorCode.FORBIDDEN, 'Видаляти може лише автор або команда', 403)
      }

      await prisma.orderFile.update({
        where: { id: file.id },
        data: { deletedAt: new Date() },
      })

      writeAuditAsync(request.log, {
        actorId: request.user.sub,
        agencyId: access.agencyId,
        action: 'order.file_deleted',
        resourceType: 'order',
        resourceId: file.orderId,
        result: 'allowed',
        metadata: { fileId: file.id },
      })

      return reply.send({ success: true, data: { id: file.id } })
    }
  )

  return Promise.resolve()
}

export default fileRoutes
