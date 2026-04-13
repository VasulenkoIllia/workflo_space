import { mkdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { StorageAdapter, StoredFile, UploadInput } from './StorageAdapter.js'

export class LocalStorageAdapter implements StorageAdapter {
  constructor(private readonly rootDir = process.env.UPLOAD_DIR ?? './uploads') {}

  async upload(input: UploadInput): Promise<StoredFile> {
    const absolute = resolve(this.rootDir, input.key)
    await mkdir(dirname(absolute), { recursive: true })
    await writeFile(absolute, input.buffer)

    return { key: input.key }
  }

  async delete(key: string): Promise<void> {
    const absolute = resolve(this.rootDir, key)
    await unlink(absolute)
  }
}
