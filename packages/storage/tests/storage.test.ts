import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  buildOrderFileKey,
  LocalStorageAdapter,
  PathTraversalError,
  safeExt,
  sha256Hex,
} from '../src/index.js'

describe('LocalStorageAdapter', () => {
  let root: string
  let storage: LocalStorageAdapter

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'wf-storage-'))
    storage = new LocalStorageAdapter(root)
  })
  afterEach(() => rmSync(root, { recursive: true, force: true }))

  it('round-trips upload → read → delete', async () => {
    const key = 'agencies/a1/orders/o1/f1.txt'
    const buffer = Buffer.from('hello world')
    await storage.upload({ key, buffer, contentType: 'text/plain' })

    const read = await storage.read(key)
    expect(read.equals(buffer)).toBe(true)

    await storage.delete(key)
    await expect(storage.read(key)).rejects.toThrow() // ENOENT after delete
  })

  it('blocks path traversal on read', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toBeInstanceOf(PathTraversalError)
  })

  it('blocks path traversal on upload', async () => {
    await expect(
      storage.upload({ key: '../escape.txt', buffer: Buffer.from('x'), contentType: 'text/plain' })
    ).rejects.toBeInstanceOf(PathTraversalError)
  })

  it('blocks path traversal on delete', async () => {
    await expect(storage.delete('../../x')).rejects.toBeInstanceOf(PathTraversalError)
  })

  it('allows nested keys inside the root', async () => {
    const key = 'agencies/a1/orders/o1/deep/nested/f.bin'
    await storage.upload({ key, buffer: Buffer.from([1, 2, 3]), contentType: 'application/octet' })
    expect((await storage.read(key)).length).toBe(3)
  })
})

describe('storage helpers', () => {
  it('sha256Hex is deterministic + 64 hex chars', () => {
    const a = sha256Hex(Buffer.from('abc'))
    expect(a).toBe(sha256Hex(Buffer.from('abc')))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(sha256Hex(Buffer.from('abd')))
  })

  it('buildOrderFileKey is tenant-prefixed', () => {
    expect(buildOrderFileKey('a1', 'o1', 'f1', '.pdf')).toBe('agencies/a1/orders/o1/f1.pdf')
    expect(buildOrderFileKey('a1', 'o1', 'f1', '')).toBe('agencies/a1/orders/o1/f1')
  })

  it('safeExt lowercases valid extensions and rejects junk', () => {
    expect(safeExt('Report.PDF')).toBe('.pdf')
    expect(safeExt('archive.tar.gz')).toBe('.gz')
    expect(safeExt('noext')).toBe('')
    expect(safeExt('weird.name.')).toBe('')
    expect(safeExt('evil.<script>')).toBe('')
  })
})
