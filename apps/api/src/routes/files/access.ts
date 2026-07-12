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
  // S10-06ч: наявність webp-прев'ю. Сам ключ у відповідь не віддаємо (внутрішній
  // storage-key) — лише прапорець hasThumb через serializeFileMeta.
  thumbKey: true,
} as const

/** DTO-серіалізація: прапорець прев'ю замість внутрішнього storage-ключа. */
export function serializeFileMeta<T extends { thumbKey: string | null }>(
  row: T
): Omit<T, 'thumbKey'> & { hasThumb: boolean } {
  const { thumbKey, ...rest } = row
  return { ...rest, hasThumb: thumbKey != null }
}

export interface FileRow {
  id: string
  orderId: string
  uploadedBy: string
  filename: string
  storedAs: string
  mimeType: string
  sizeBytes: number
  sha256: string
  thumbKey: string | null
  createdAt: Date
  deletedAt: Date | null
  // 03-чат leak-гард: файл, прив'язаний до internal-нотатки, лишається team-only —
  // клієнт не бачить ні повідомлення, ні його вкладення (null = звичайний файл табу).
  comment: { isInternal: boolean } | null
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
        thumbKey: true,
        createdAt: true,
        deletedAt: true,
        // leak-гард: чи це вкладення internal-нотатки (тоді клієнт його не бачить).
        comment: { select: { isInternal: true } },
      },
    })
  )
  if (!file || file.deletedAt) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл не знайдено', 404)
  }
  const access = await requireOrderParticipant(request, file.orderId)
  // 03-чат: вкладення командної нотатки — team-only. Клієнт (не-internal учасник)
  // отримує той самий 404, що й для неіснуючого файлу (без визнання існування).
  if (!access.isInternal && file.comment?.isInternal) {
    throw new AppError(ApiErrorCode.NOT_FOUND, 'Файл не знайдено', 404)
  }
  return { file, access }
}
