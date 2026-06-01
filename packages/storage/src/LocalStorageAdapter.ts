import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import {
  PathTraversalError,
  type StorageAdapter,
  type StoredFile,
  type UploadInput,
} from './StorageAdapter.js'

/**
 * Filesystem-backed storage for the MVP. Every key is resolved under a fixed
 * root and validated so a crafted key (`../../etc/passwd`) can never escape it —
 * defense-in-depth even though keys always originate from a DB column, not the
 * URL. Files are written `0640` (owner rw, group r) per the ops layout.
 */
export class LocalStorageAdapter implements StorageAdapter {
  private readonly root: string

  constructor(rootDir = process.env.UPLOAD_DIR ?? './uploads') {
    this.root = resolve(rootDir)
  }

  /** Resolve a key under the root, refusing any path that escapes it. */
  private safeResolve(key: string): string {
    const absolute = resolve(this.root, key)
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new PathTraversalError(key)
    }
    return absolute
  }

  async upload(input: UploadInput): Promise<StoredFile> {
    const absolute = this.safeResolve(input.key)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, input.buffer, { mode: 0o640 })
    return { key: input.key }
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.safeResolve(key))
  }

  async delete(key: string): Promise<void> {
    await unlink(this.safeResolve(key))
  }
}
