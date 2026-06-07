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

/**
 * Defense-in-depth: verify a file's leading "magic" bytes match the CATEGORY of its
 * DECLARED MIME, so a script renamed with `Content-Type: image/png` is rejected (415).
 * The declared MIME comes from the multipart boundary (client-controlled); this checks
 * the actual bytes. Category-level only — docx/xlsx/pptx are ZIP containers, so they
 * verify as ZIP (PK); text types have no signature (allowed). Serving is already
 * attachment+nosniff, so this hardens what lands on disk (audit 2026-06).
 */
export function magicMatchesMime(bytes: Uint8Array, mime: string): boolean {
  const b = bytes
  const at = (i: number, ...sig: number[]): boolean => sig.every((v, j) => b[i + j] === v)
  switch (mime) {
    case 'text/plain':
    case 'text/csv':
      return true // no reliable binary signature for plain text
    case 'image/png':
      return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
    case 'image/jpeg':
      return at(0, 0xff, 0xd8, 0xff)
    case 'image/gif':
      return at(0, 0x47, 0x49, 0x46, 0x38) // GIF8
    case 'image/webp':
      return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50) // RIFF....WEBP
    case 'application/pdf':
      return at(0, 0x25, 0x50, 0x44, 0x46, 0x2d) // %PDF-
    case 'application/zip':
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      return at(0, 0x50, 0x4b) && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) // PK..
    case 'application/msword':
    case 'application/vnd.ms-excel':
      return at(0, 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1) // OLE compound (legacy)
    case 'video/mp4':
      return at(4, 0x66, 0x74, 0x79, 0x70) // 'ftyp' box at offset 4
    case 'video/webm':
      return at(0, 0x1a, 0x45, 0xdf, 0xa3) // EBML (Matroska/WebM)
    default:
      return true // allowlisted but unmapped → don't block
  }
}

/** 100 MB per order attachment; 20 files per order (module 04 limits). */
export const MAX_ORDER_FILE_BYTES = 100 * 1024 * 1024
export const MAX_FILES_PER_ORDER = 20
