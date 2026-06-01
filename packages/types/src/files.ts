/**
 * Upload allowlist + limits for the Files module. Shared so the portal/workspace
 * frontends validate before upload and the API enforces the same set.
 *
 * `image/svg+xml` is INTENTIONALLY excluded: an SVG can carry inline <script>
 * that executes if served as image/svg+xml (stored-XSS). Any MIME not in this
 * list → 415 Unsupported Media Type.
 */
export const ALLOWED_FILE_MIME_TYPES = [
  // Images (raster only — no SVG)
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Text
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  // Video
  'video/mp4',
  'video/webm',
] as const

export type AllowedFileMimeType = (typeof ALLOWED_FILE_MIME_TYPES)[number]

export function isAllowedFileMimeType(mime: string): mime is AllowedFileMimeType {
  return (ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(mime)
}

/** 100 MB per order attachment; 20 files per order (module 04 limits). */
export const MAX_ORDER_FILE_BYTES = 100 * 1024 * 1024
export const MAX_FILES_PER_ORDER = 20
