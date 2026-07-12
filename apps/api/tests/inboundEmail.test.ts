import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type InboundEmail,
  inboundEmailConfig,
  ingestInboundEmail,
} from '../src/services/inboundEmail.js'

// S12-05: маршрутизація вхідного листа — чиста логіка на db-даблі (без IMAP-I/O).

function makeDb(
  over: {
    dupMessage?: { id: string } | null
    parent?: {
      ticketId: string
      ticket: {
        id: string
        agencyId: string
        subject: string
        companyId: string | null
        status: string
      }
    } | null
    sender?: { id: string } | null
    membership?: { company: { id: string; agencyId: string } } | null
  } = {}
) {
  return {
    ticketMessage: {
      findUnique: vi.fn().mockResolvedValue(over.dupMessage ?? null),
      findFirst: vi.fn().mockResolvedValue(over.parent ?? null),
      create: vi.fn().mockResolvedValue({ id: 'msg-new' }),
    },
    profile: {
      findFirst: vi.fn().mockResolvedValue(over.sender ?? null),
    },
    companyMember: {
      findFirst: vi.fn().mockResolvedValue(over.membership ?? null),
    },
    ticket: {
      create: vi.fn().mockResolvedValue({ id: 'ticket-new' }),
      update: vi.fn().mockResolvedValue({}),
    },
  }
}

const baseEmail = (over: Partial<InboundEmail> = {}): InboundEmail => ({
  messageId: '<abc@mail.example>',
  from: 'Client@Example.com',
  subject: 'Потрібна допомога',
  text: 'Не працює кнопка оплати.',
  inReplyTo: null,
  references: [],
  ...over,
})

describe('inboundEmailConfig (graceful-off)', () => {
  const KEYS = [
    'INBOUND_IMAP_HOST',
    'INBOUND_IMAP_USER',
    'INBOUND_IMAP_PASSWORD',
    'INBOUND_IMAP_PORT',
    'INBOUND_IMAP_SECURE',
    'INBOUND_IMAP_MAILBOX',
  ]
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('без обовʼязкових env → null (фіча вимкнена)', () => {
    expect(inboundEmailConfig()).toBeNull()
    process.env.INBOUND_IMAP_HOST = 'imap.example.com'
    expect(inboundEmailConfig()).toBeNull() // ще нема USER/PASSWORD
  })

  it('з повним набором → конфіг з дефолтами (порт 993, TLS, INBOX)', () => {
    process.env.INBOUND_IMAP_HOST = 'imap.example.com'
    process.env.INBOUND_IMAP_USER = 'support@workflo.space'
    process.env.INBOUND_IMAP_PASSWORD = 'secret'
    expect(inboundEmailConfig()).toEqual({
      host: 'imap.example.com',
      port: 993,
      user: 'support@workflo.space',
      password: 'secret',
      secure: true,
      mailbox: 'INBOX',
    })
    process.env.INBOUND_IMAP_SECURE = 'false'
    process.env.INBOUND_IMAP_MAILBOX = 'Support'
    expect(inboundEmailConfig()).toMatchObject({ secure: false, mailbox: 'Support' })
  })
})

describe('ingestInboundEmail — новий тікет', () => {
  it('відомий відправник з компанією → створює email-тікет', async () => {
    const db = makeDb({
      sender: { id: 'profile-1' },
      membership: { company: { id: 'company-1', agencyId: 'agency-1' } },
    })
    const r = await ingestInboundEmail(db, baseEmail())
    expect(r).toEqual({
      status: 'created',
      ticketId: 'ticket-new',
      agencyId: 'agency-1',
      subject: 'Потрібна допомога',
      companyId: 'company-1',
    })
    expect(db.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agencyId: 'agency-1',
          companyId: 'company-1',
          openedById: 'profile-1',
          source: 'email',
          status: 'open',
        }),
      })
    )
    // перше повідомлення несе Message-ID для ідемпотентності
    expect(db.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sourceMessageId: '<abc@mail.example>',
          authorId: 'profile-1',
        }),
      })
    )
  })

  it('email матчиться case-insensitive (from нормалізується у lower-case)', async () => {
    const db = makeDb({
      sender: { id: 'profile-1' },
      membership: { company: { id: 'company-1', agencyId: 'agency-1' } },
    })
    await ingestInboundEmail(db, baseEmail({ from: 'Client@Example.COM' }))
    expect(db.profile.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: { equals: 'client@example.com', mode: 'insensitive' } },
      })
    )
  })

  it('Re:/Fwd:-префікси прибираються з теми тікета', async () => {
    const db = makeDb({
      sender: { id: 'profile-1' },
      membership: { company: { id: 'company-1', agencyId: 'agency-1' } },
    })
    await ingestInboundEmail(db, baseEmail({ subject: 'Re: Fwd: Рахунок №5' }))
    expect(db.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subject: 'Рахунок №5' }) })
    )
  })

  it('порожнє тіло/тема → плейсхолдери, тікет усе одно створюється', async () => {
    const db = makeDb({
      sender: { id: 'profile-1' },
      membership: { company: { id: 'company-1', agencyId: 'agency-1' } },
    })
    await ingestInboundEmail(db, baseEmail({ subject: '   ', text: '' }))
    expect(db.ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ subject: '(лист без теми)' }) })
    )
    expect(db.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ content: '(порожній лист)' }) })
    )
  })
})

describe('ingestInboundEmail — тредінг і skip', () => {
  it('In-Reply-To збігається → дописує у тред + reopen (resolved → open)', async () => {
    const db = makeDb({
      parent: {
        ticketId: 'ticket-42',
        ticket: {
          id: 'ticket-42',
          agencyId: 'agency-1',
          subject: 'Стара тема',
          companyId: 'company-1',
          status: 'resolved',
        },
      },
      sender: { id: 'profile-1' },
    })
    const r = await ingestInboundEmail(
      db,
      baseEmail({ messageId: '<reply@mail>', inReplyTo: '<abc@mail.example>' })
    )
    expect(r).toMatchObject({ status: 'appended', ticketId: 'ticket-42' })
    expect(db.ticketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ ticketId: 'ticket-42', sourceMessageId: '<reply@mail>' }),
      })
    )
    expect(db.ticket.update).toHaveBeenCalledWith({
      where: { id: 'ticket-42' },
      data: { status: 'open' },
    })
    // новий тікет не створюється
    expect(db.ticket.create).not.toHaveBeenCalled()
  })

  it('дублікат Message-ID → skip duplicate, нічого не пишемо', async () => {
    const db = makeDb({ dupMessage: { id: 'existing' } })
    const r = await ingestInboundEmail(db, baseEmail())
    expect(r).toEqual({ status: 'skipped', reason: 'duplicate' })
    expect(db.ticket.create).not.toHaveBeenCalled()
    expect(db.ticketMessage.create).not.toHaveBeenCalled()
  })

  it('невідомий відправник → skip unknown_sender', async () => {
    const db = makeDb({ sender: null })
    const r = await ingestInboundEmail(db, baseEmail())
    expect(r).toEqual({ status: 'skipped', reason: 'unknown_sender' })
    expect(db.ticket.create).not.toHaveBeenCalled()
  })

  it('відправник без компанії → skip no_company', async () => {
    const db = makeDb({ sender: { id: 'profile-1' }, membership: null })
    const r = await ingestInboundEmail(db, baseEmail())
    expect(r).toEqual({ status: 'skipped', reason: 'no_company' })
    expect(db.ticket.create).not.toHaveBeenCalled()
  })

  it('порожній Message-ID → skip no_message_id', async () => {
    const db = makeDb({ sender: { id: 'profile-1' } })
    const r = await ingestInboundEmail(db, baseEmail({ messageId: '   ' }))
    expect(r).toEqual({ status: 'skipped', reason: 'no_message_id' })
  })
})
