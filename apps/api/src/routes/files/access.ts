import { withTenant } from '@workflo/db'
import { ApiErrorCode, AppError } from '@workflo/types'
import type { FastifyRequest } from 'fastify'
import { type OrderAccess, requireOrderParticipant } from '../orders/access.js'

export const FILE_META_SELECT = {
  id: true,
  filename: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  uploadedBy: true,
  createdAt: true,
} as const

export interface FileRow {
  id: string
  orderId: string
  uploadedBy: string
  filename: string
  storedAs: string
  mimeType: string
  sizeBytes: number
  sha256: string
  createdAt: Date
  deletedAt: Date | null
}

export interface FileWithAccess {
  file: FileRow
  access: OrderAccess
}

/**
 * Load a file and authorize the caller through its order (the file inherits the
 * order's tenant + participant rules — module 04 `canAccessFile`). 404 for a
 * missing / soft-deleted file BEFORE the order check, so a deleted file is
 * indistinguishable from a never-existing one.
 */
export async function requireFileAccess(
  request: FastifyRequest,
  fileId: string
): Promise<FileWithAccess> {
  const file = await withTenant((tx) =>
    tx.orderFile.findUnique({
      where: { id: fileId },
      select: {
        id: true,
        orderId: true,
        uploadedBy: true,
        filename: true,
        storedAs: true,
        mimeType: true,
        sizeBytes: true,
        sha256: true,
        createdAt: true,
        deletedAt: true,
      },
    })
  )
  if (!file || file.deletedAt) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл не знайдено', 404)
  }
  const access = await requireOrderParticipant(request, file.orderId)
  return { file, access }
}
