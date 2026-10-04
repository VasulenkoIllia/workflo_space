import { createHash } from 'node:crypto'
import { extname } from 'node:path'

/** Lowercase hex SHA-256 of a buffer (content integrity / dedup key). */
export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/**
 * A safe, lowercased file extension (incl. leading dot) or '' if the name has
 * none / an implausible one. Never trust the raw filename in a storage key.
 */
export function safeExt(filename: string): string {
  const ext = extname(filename).toLowerCase()
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : ''
}

/**
 * Tenant-prefixed storage key for an order attachment:
 *   `agencies/<agencyId>/orders/<orderId>/<fileId><ext>`
 * The opaque `fileId` (not the user filename) is the on-disk name, so two
 * uploads with the same name never collide and the path is injection-free.
 */
export function buildOrderFileKey(
  agencyId: string,
  orderId: string,
  fileId: string,
  ext: string
): string {
  return `agencies/${agencyId}/orders/${orderId}/${fileId}${ext}`
}
