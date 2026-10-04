import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const orderFindUnique = vi.fn()
const fileCount = vi.fn()
const fileCreate = vi.fn()
const fileFindUnique = vi.fn()
const fileFindMany = vi.fn()
const fileUpdate = vi.fn()
const auditLogCreate = vi.fn()

const storageUpload = vi.fn()
const storageRead = vi.fn()
const storageDelete = vi.fn()

vi.mock('@workflo/db', () => {
  const prisma = {
    order: { findUnique: orderFindUnique },
    orderFile: {
      count: fileCount,
      create: fileCreate,
      findUnique: fileFindUnique,
      findMany: fileFindMany,
      update: fileUpdate,
    },
    auditLog: { create: auditLogCreate },
  }
  return {
    prisma,
    // Reads/single writes are wrapped in withTenant() (RLS seam); run the callback
    // against the same mocked client so the route's tx.* calls hit these mocks.
    withTenant: (fn: (tx: unknown) => unknown) => fn(prisma),
    Prisma: {},
  }
})

vi.mock('../src/services/storage.js', () => ({
  getStorage: () => ({ upload: storageUpload, read: storageRead, delete: storageDelete }),
}))

const { buildApp } = await import('../src/app.js')

const CLIENT = {
  sub: 'profile-1',
  email: 'u@e.com',
  role: 'client' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: 'company-1',
  agencyMemberships: [] as Array<{ agencyId: string; role: 'owner' | 'executor' }>,
  memberships: [{ companyId: 'company-1', role: 'owner' as const }],
}
const EXECUTOR = {
  sub: 'exec-1',
  email: 'e@e.com',
  role: 'executor' as const,
  activeAgencyId: 'agency-1',
  activeCompanyId: null,
  agencyMemberships: [{ agencyId: 'agency-1', role: 'executor' as const }],
  memberships: [] as Array<{ companyId: string; role: 'owner' | 'member' }>,
}

function authed(claims: unknown) {
  const app = buildApp()
  return app.ready().then(() => ({ app, token: app.jwt.sign(claims as object) }))
}

/** Build a minimal multipart/form-data body with one file part. */
function multipart(filename: string, contentType: string, content: string) {
  const boundary = '----wftestboundary'
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
        `Content-Type: ${contentType}\r\n\r\n`
    ),
    Buffer.from(content),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
  return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } }
}

const order = { id: 'order-1', agencyId: 'agency-1', companyId: 'company-1', deletedAt: null }
const fileRow = {
  id: 'file-1',
  orderId: 'order-1',
  uploadedBy: 'exec-1',
  filename: 'doc.pdf',
  storedAs: 'agencies/agency-1/orders/order-1/file-1.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 5,
  sha256: 'abc',
  createdAt: new Date('2026-05-31T00:00:00Z'),
  deletedAt: null,
}

describe('POST /orders/:id/files', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  it('executor uploads a pdf → 201, tenant-prefixed key + sha256', async () => {
    orderFindUnique.mockResolvedValue(order)
    fileCount.mockResolvedValue(0)
    fileCreate.mockResolvedValue({ id: 'file-1', filename: 'doc.pdf' })
    storageUpload.mockResolvedValue({ key: 'k' })
    const { app, token } = await authed(EXECUTOR)
    const mp = multipart('doc.pdf', 'application/pdf', '%PDF-') // valid PDF magic, 5 bytes
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}`, ...mp.headers },
      payload: mp.body,
    })
    expect(res.statusCode).toBe(201)
    const key = storageUpload.mock.calls[0][0].key as string
    expect(key).toMatch(/^agencies\/agency-1\/orders\/order-1\/.+\.pdf$/)
    const data = fileCreate.mock.calls[0][0].data
    expect(data.agency).toEqual({ connect: { id: 'agency-1' } })
    expect(typeof data.sha256).toBe('string')
    expect(data.sizeBytes).toBe(5)
    await app.close()
  })

  it('rejects a disallowed MIME (svg) → 415', async () => {
    orderFindUnique.mockResolvedValue(order)
    const { app, token } = await authed(EXECUTOR)
    const mp = multipart('x.svg', 'image/svg+xml', '<svg/>')
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}`, ...mp.headers },
      payload: mp.body,
    })
    expect(res.statusCode).toBe(415)
    expect(storageUpload).not.toHaveBeenCalled()
    await app.close()
  })

  it('rejects content whose magic bytes do not match the declared MIME → 415', async () => {
    orderFindUnique.mockResolvedValue(order)
    fileCount.mockResolvedValue(0)
    const { app, token } = await authed(EXECUTOR)
    // declared image/png but the bytes are plain text → magic mismatch
    const mp = multipart('fake.png', 'image/png', 'hello not a png')
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}`, ...mp.headers },
      payload: mp.body,
    })
    expect(res.statusCode).toBe(415)
    expect(storageUpload).not.toHaveBeenCalled()
    await app.close()
  })

  it('409 when the order already has the max files', async () => {
    orderFindUnique.mockResolvedValue(order)
    fileCount.mockResolvedValue(20)
    const { app, token } = await authed(EXECUTOR)
    const mp = multipart('doc.pdf', 'application/pdf', 'hello')
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}`, ...mp.headers },
      payload: mp.body,
    })
    expect(res.statusCode).toBe(409)
    expect(storageUpload).not.toHaveBeenCalled()
    await app.close()
  })

  it('404 for an unknown order', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(EXECUTOR)
    const mp = multipart('doc.pdf', 'application/pdf', 'hello')
    const res = await app.inject({
      method: 'POST',
      url: '/orders/nope/files',
      headers: { authorization: `Bearer ${token}`, ...mp.headers },
      payload: mp.body,
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('401 without a token', async () => {
    const app = buildApp()
    await app.ready()
    const mp = multipart('doc.pdf', 'application/pdf', 'hello')
    const res = await app.inject({
      method: 'POST',
      url: '/orders/order-1/files',
      headers: mp.headers,
      payload: mp.body,
    })
    expect(res.statusCode).toBe(401)
    await app.close()
  })
})

describe('GET /orders/:id/files', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('executor lists order files', async () => {
    orderFindUnique.mockResolvedValue(order)
    fileFindMany.mockResolvedValue([{ id: 'file-1', filename: 'doc.pdf' }])
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().data.files).toHaveLength(1)
    expect(fileFindMany.mock.calls[0][0].where.deletedAt).toBeNull()
    await app.close()
  })

  it('404 when a client lists another company order', async () => {
    orderFindUnique.mockResolvedValue({ ...order, companyId: 'company-OTHER' })
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('client file list excludes internal-note attachments (leak guard)', async () => {
    orderFindUnique.mockResolvedValue(order) // client is a participant of this order
    fileFindMany.mockResolvedValue([])
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'GET',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    // клієнт бачить лише звичайні файли або вкладення публічних повідомлень
    expect(fileFindMany.mock.calls[0][0].where.OR).toEqual([
      { commentId: null },
      { comment: { isInternal: false } },
    ])
    await app.close()
  })

  it('team file list is unfiltered (sees internal-note attachments)', async () => {
    orderFindUnique.mockResolvedValue(order)
    fileFindMany.mockResolvedValue([])
    const { app, token } = await authed(EXECUTOR)
    await app.inject({
      method: 'GET',
      url: '/orders/order-1/files',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(fileFindMany.mock.calls[0][0].where.OR).toBeUndefined()
    await app.close()
  })
})

describe('GET /files/:id + content', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.clearAllMocks())

  it('returns metadata (no storedAs leaked)', async () => {
    fileFindUnique.mockResolvedValue(fileRow)
    orderFindUnique.mockResolvedValue(order)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/files/file-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    const f = res.json().data.file
    expect(f.id).toBe('file-1')
    expect(f.storedAs).toBeUndefined()
    await app.close()
  })

  it('serves binary with attachment disposition + nosniff', async () => {
    fileFindUnique.mockResolvedValue(fileRow)
    orderFindUnique.mockResolvedValue(order)
    storageRead.mockResolvedValue(Buffer.from('PDFDATA'))
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/files/file-1/content',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.headers['content-disposition']).toContain('attachment')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.body).toBe('PDFDATA')
    await app.close()
  })

  it('404 for an unknown file', async () => {
    fileFindUnique.mockResolvedValue(null)
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/files/nope',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(404)
    await app.close()
  })

  it('403 cross-tenant (file order in another agency)', async () => {
    fileFindUnique.mockResolvedValue(fileRow)
    orderFindUnique.mockResolvedValue({ ...order, agencyId: 'agency-OTHER' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/files/file-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    await app.close()
  })

  it('404 when a client opens an internal-note attachment (leak guard)', async () => {
    // File linked to a team-only note: the client is a participant of the order but
    // must not see (metadata) or download (content) the internal attachment.
    fileFindUnique.mockResolvedValue({ ...fileRow, comment: { isInternal: true } })
    orderFindUnique.mockResolvedValue(order) // client is a participant of order-1
    storageRead.mockResolvedValue(Buffer.from('SECRET'))
    const { app, token } = await authed(CLIENT)

    const meta = await app.inject({
      method: 'GET',
      url: '/files/file-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(meta.statusCode).toBe(404)

    const content = await app.inject({
      method: 'GET',
      url: '/files/file-1/content',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(content.statusCode).toBe(404)
    expect(storageRead).not.toHaveBeenCalled() // never even read the blob
    await app.close()
  })

  it('internal-note attachment IS visible to the team (executor 200)', async () => {
    fileFindUnique.mockResolvedValue({ ...fileRow, comment: { isInternal: true } })
    orderFindUnique.mockResolvedValue(order)
    storageRead.mockResolvedValue(Buffer.from('DATA'))
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'GET',
      url: '/files/file-1/content',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    await app.close()
  })
})

describe('DELETE /files/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auditLogCreate.mockResolvedValue({})
  })
  afterEach(() => vi.clearAllMocks())

  it('uploader soft-deletes their file', async () => {
    fileFindUnique.mockResolvedValue(fileRow) // uploadedBy exec-1
    orderFindUnique.mockResolvedValue(order)
    fileUpdate.mockResolvedValue({ id: 'file-1' })
    const { app, token } = await authed(EXECUTOR)
    const res = await app.inject({
      method: 'DELETE',
      url: '/files/file-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(200)
    expect(fileUpdate.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date)
    await app.close()
  })

  it('client who is not the uploader cannot delete (403)', async () => {
    // file uploaded by exec-1; client is a participant but not the uploader
    fileFindUnique.mockResolvedValue({ ...fileRow, uploadedBy: 'exec-1' })
    orderFindUnique.mockResolvedValue(order)
    const { app, token } = await authed(CLIENT)
    const res = await app.inject({
      method: 'DELETE',
      url: '/files/file-1',
      headers: { authorization: `Bearer ${token}` },
    })
    expect(res.statusCode).toBe(403)
    expect(fileUpdate).not.toHaveBeenCalled()
    await app.close()
  })
})
