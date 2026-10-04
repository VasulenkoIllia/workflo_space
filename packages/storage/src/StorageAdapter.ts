export interface StoredFile {
  key: string
  url?: string
}

export interface UploadInput {
  key: string
  buffer: Buffer
  contentType: string
}

export interface StorageAdapter {
  upload(input: UploadInput): Promise<StoredFile>
  read(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}

/** Thrown when a resolved key escapes the storage root (defense-in-depth). */
export class PathTraversalError extends Error {
  readonly code = 'path_traversal_blocked'
  constructor(key: string) {
    super(`path_traversal_blocked: ${key}`)
    this.name = 'PathTraversalError'
  }
}
