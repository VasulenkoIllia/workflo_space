import { prisma, runWithSystemContext } from '@workflo/db'
import type { FastifyBaseLogger } from 'fastify'
import { dispatchNotification } from './notifications.js'

/**
 * S12-05 EMAIL-INBOUND: вхідний лист на спільну support-скриньку → тікет підтримки
 * (або відповідь у наявний тред). Механіка graceful-off, як VAPID/push: без
 * INBOUND_IMAP_* env полінг тихо не запускається — решта системи не залежить.
 *
 * Маршрутизація (`ingestInboundEmail`, чиста від IMAP-I/O — тестується моком):
 *   1. ідемпотентність — Message-ID уже інгестили → skip (повторний полінг безпечний);
 *   2. тредінг — In-Reply-To/References збігається з sourceMessageId наявного
 *      повідомлення → дописуємо у той тікет + reopen (як клієнт-відповідь у порталі);
 *   3. новий тікет — відправника резолвимо email→Profile→CompanyMember→агенція;
 *      невідомий відправник / без компанії → skip (спам/чужі не створюють тікетів).
 *
 * IMAP-полінг (`pollInboundMailbox`) — динамічний import imapflow/mailparser (без
 * env бібліотеки навіть не вантажаться), UNSEEN → parse → ingest → \Seen.
 */

// ── Провайдер-агностична форма листа (тести не залежать від mailparser) ──────────
export interface InboundEmail {
  /** RFC Message-ID — глобально унікальний ключ ідемпотентності + якір тредінгу. */
  messageId: string
  /** Email відправника, нормалізований у lower-case. */
  from: string
  subject: string
  /** Текстове тіло (mailparser `.text`). */
  text: string
  /** Message-ID, на який відповідає лист (null — новий лист). */
  inReplyTo: string | null
  /** Ланцюг тредінгу (References-заголовок). */
  references: string[]
}

export type IngestResult =
  | { status: 'created'; ticketId: string; agencyId: string; subject: string; companyId: string }
  | {
      status: 'appended'
      ticketId: string
      agencyId: string
      subject: string
      companyId: string | null
    }
  | {
      status: 'skipped'
      reason:
        | 'duplicate'
        | 'unknown_sender'
        | 'no_company'
        | 'no_message_id'
        | 'ambiguous_tenant' // audit-H2: відправник у кількох агенціях — не вгадуємо
        | 'wrong_tenant' // audit-H3: відправник не з тенанту цільового треду
    }

const SUBJECT_MAX = 200
const CONTENT_MAX = 10_000
const RE_FWD_PREFIX = /^\s*(re|fwd?|fw)\s*:\s*/i

/** Прибрати каскад Re:/Fwd:-префіксів, обрізати, дефолт для порожньої теми. */
function cleanSubject(raw: string): string {
  let s = raw.trim()
  // повторно, поки є префікси ("Re: Fwd: ...")
  for (let i = 0; i < 10 && RE_FWD_PREFIX.test(s); i += 1) s = s.replace(RE_FWD_PREFIX, '').trim()
  if (s.length === 0) return '(лист без теми)'
  return s.slice(0, SUBJECT_MAX)
}

function cleanBody(raw: string): string {
  const s = raw.trim()
  if (s.length === 0) return '(порожній лист)'
  return s.slice(0, CONTENT_MAX)
}

// ── Мінімальний структурний контракт до Prisma (щоб ingest тестувався db-даблом) ──
interface IngestDb {
  ticketMessage: {
    findUnique: (args: {
      where: { sourceMessageId: string }
      select: { id: true }
    }) => Promise<{ id: string } | null>
    findFirst: (args: {
      where: { sourceMessageId: { in: string[] } }
      select: {
        ticketId: true
        ticket: {
          select: { id: true; agencyId: true; subject: true; companyId: true; status: true }
        }
      }
    }) => Promise<{
      ticketId: string
      ticket: {
        id: string
        agencyId: string
        subject: string
        companyId: string | null
        status: string
      }
    } | null>
    create: (args: {
      data: Record<string, unknown>
      select: { id: true }
    }) => Promise<{ id: string }>
  }
  profile: {
    findFirst: (args: {
      where: { email: { equals: string; mode: 'insensitive' } }
      select: { id: true }
    }) => Promise<{ id: string } | null>
  }
  companyMember: {
    findMany: (args: {
      where: { profileId: string }
      orderBy: { joinedAt: 'asc' }
      select: { company: { select: { id: true; agencyId: true } } }
    }) => Promise<Array<{ company: { id: string; agencyId: string } }>>
    findFirst: (args: {
      where: { profileId: string; companyId: string }
      select: { id: true }
    }) => Promise<{ id: string } | null>
  }
  agencyMember: {
    findFirst: (args: {
      where: { agencyId: string; profileId: string }
      select: { id: true }
    }) => Promise<{ id: string } | null>
  }
  ticket: {
    create: (args: {
      data: Record<string, unknown>
      select: { id: true }
    }) => Promise<{ id: string }>
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>
  }
}

/**
 * Замаршрутизувати один вхідний лист. Викликати всередині транзакції в system-context;
 * НЕ шле нотифікацій (їх запускає полер після коміту). Ніколи не кидає у happy-path;
 * P2002 на sourceMessageId (гонка полерів) ловить полер як duplicate.
 */
export async function ingestInboundEmail(db: IngestDb, email: InboundEmail): Promise<IngestResult> {
  const messageId = email.messageId.trim()
  if (messageId.length === 0) return { status: 'skipped', reason: 'no_message_id' }

  // 1. Ідемпотентність — цей лист уже інгестили
  const dup = await db.ticketMessage.findUnique({
    where: { sourceMessageId: messageId },
    select: { id: true },
  })
  if (dup) return { status: 'skipped', reason: 'duplicate' }

  const from = email.from.trim().toLowerCase()

  // 2. Тредінг: In-Reply-To / References → sourceMessageId наявного повідомлення
  const candidates = [email.inReplyTo, ...email.references]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((x) => x.trim())
  if (candidates.length > 0) {
    const parent = await db.ticketMessage.findFirst({
      where: { sourceMessageId: { in: candidates } },
      select: {
        ticketId: true,
        ticket: {
          select: { id: true, agencyId: true, subject: true, companyId: true, status: true },
        },
      },
    })
    if (parent) {
      const t = parent.ticket
      // Автор відповіді — той самий Profile за email; фолбек нема, бо authorId FK.
      const sender = await db.profile.findFirst({
        where: { email: { equals: from, mode: 'insensitive' } },
        select: { id: true },
      })
      if (!sender) return { status: 'skipped', reason: 'unknown_sender' }
      // audit-H3: тредінг матчиться за глобально-унікальним Message-ID (крос-тенант),
      // тож перевіряємо, що відправник справді належить тенанту цього тікета —
      // член його компанії АБО staff його агенції. Інакше чужий In-Reply-To міг би
      // впорснути повідомлення в тред іншого тенанта.
      const [inCompany, isStaff] = await Promise.all([
        t.companyId
          ? db.companyMember.findFirst({
              where: { profileId: sender.id, companyId: t.companyId },
              select: { id: true },
            })
          : Promise.resolve(null),
        db.agencyMember.findFirst({
          where: { agencyId: t.agencyId, profileId: sender.id },
          select: { id: true },
        }),
      ])
      if (!inCompany && !isStaff) return { status: 'skipped', reason: 'wrong_tenant' }
      await db.ticketMessage.create({
        data: {
          agencyId: t.agencyId,
          ticketId: t.id,
          authorId: sender.id,
          content: cleanBody(email.text),
          isInternal: false,
          sourceMessageId: messageId,
        },
        select: { id: true },
      })
      // reopen: клієнт відповів → тікет знову «open» (як портальна клієнт-відповідь)
      if (t.status === 'pending' || t.status === 'resolved' || t.status === 'closed') {
        await db.ticket.update({ where: { id: t.id }, data: { status: 'open' } })
      } else {
        await db.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } })
      }
      return {
        status: 'appended',
        ticketId: t.id,
        agencyId: t.agencyId,
        subject: t.subject,
        companyId: t.companyId,
      }
    }
  }

  // 3. Новий тікет — резолв відправника
  const sender = await db.profile.findFirst({
    where: { email: { equals: from, mode: 'insensitive' } },
    select: { id: true },
  })
  if (!sender) return { status: 'skipped', reason: 'unknown_sender' }
  const memberships = await db.companyMember.findMany({
    where: { profileId: sender.id },
    orderBy: { joinedAt: 'asc' },
    select: { company: { select: { id: true, agencyId: true } } },
  })
  if (memberships.length === 0) return { status: 'skipped', reason: 'no_company' }
  // audit-H2: спільна скринька одна на платформу, а Profile.email глобально
  // унікальний — той самий клієнт може бути в компаніях РІЗНИХ агенцій. Тоді лист
  // без явного маркера агенції неможливо однозначно замаршрутизувати → не вгадуємо
  // (інакше вміст листа для агенції B засвітився б команді агенції A).
  const distinctAgencies = new Set(memberships.map((m) => m.company.agencyId))
  if (distinctAgencies.size > 1) return { status: 'skipped', reason: 'ambiguous_tenant' }

  const agencyId = memberships[0]!.company.agencyId
  const companyId = memberships[0]!.company.id
  const subject = cleanSubject(email.subject)

  const ticket = await db.ticket.create({
    data: {
      agencyId,
      companyId,
      openedById: sender.id,
      subject,
      priority: 'normal',
      status: 'open',
      source: 'email',
    },
    select: { id: true },
  })
  await db.ticketMessage.create({
    data: {
      agencyId,
      ticketId: ticket.id,
      authorId: sender.id,
      content: cleanBody(email.text),
      isInternal: false,
      sourceMessageId: messageId,
    },
    select: { id: true },
  })
  return { status: 'created', ticketId: ticket.id, agencyId, subject, companyId }
}

// ── IMAP-конфіг з env (graceful-off) ────────────────────────────────────────────
export interface InboundEmailConfig {
  host: string
  port: number
  user: string
  password: string
  secure: boolean
  mailbox: string
}

/** null → фіча вимкнена (нема обовʼязкових env). Обовʼязкові: HOST, USER, PASSWORD. */
export function inboundEmailConfig(): InboundEmailConfig | null {
  const host = process.env.INBOUND_IMAP_HOST
  const user = process.env.INBOUND_IMAP_USER
  const password = process.env.INBOUND_IMAP_PASSWORD
  if (!host || !user || !password) return null
  const port = Number(process.env.INBOUND_IMAP_PORT ?? '993')
  return {
    host,
    port: Number.isFinite(port) && port > 0 ? port : 993,
    user,
    password,
    secure: process.env.INBOUND_IMAP_SECURE !== 'false', // дефолт TLS
    mailbox: process.env.INBOUND_IMAP_MAILBOX ?? 'INBOX',
  }
}

export interface InboundPollSummary {
  configured: boolean
  processed: number
  created: number
  appended: number
  skipped: number
}

/** Сповістити команду про новий/оновлений email-тікет (поза транзакцією, fire-and-forget). */
async function notifyTeamOfInbound(
  logger: FastifyBaseLogger,
  result: Extract<IngestResult, { status: 'created' | 'appended' }>
): Promise<void> {
  const staff = await prisma.agencyMember.findMany({
    where: { agencyId: result.agencyId, role: { in: ['owner', 'manager', 'executor'] } },
    select: { profileId: true },
  })
  const isNew = result.status === 'created'
  for (const s of staff) {
    dispatchNotification(logger, {
      profileId: s.profileId,
      event: isNew ? 'support.new_ticket' : 'support.ticket_reply',
      vars: { subject: result.subject, ticketId: result.ticketId },
      inApp: {
        title: isNew ? 'Новий тікет з email' : 'Клієнт відповів (email)',
        body: result.subject,
      },
    })
  }
}

/**
 * Один прохід полінгу support-скриньки. Без env — миттєвий no-op. Читає UNSEEN,
 * парсить, інгестить у system-context-транзакції, помічає \Seen (навіть skip —
 * щоб не крутити той самий лист вічно; власник бачить оригінал у самій скриньці).
 * Ніколи не кидає — усе логується; краш полінгу не має валити воркер-процес.
 */
export async function pollInboundMailbox(logger: FastifyBaseLogger): Promise<InboundPollSummary> {
  const cfg = inboundEmailConfig()
  const summary: InboundPollSummary = {
    configured: cfg !== null,
    processed: 0,
    created: 0,
    appended: 0,
    skipped: 0,
  }
  if (!cfg) return summary

  // Динамічний import: якщо фіча вимкнена — важкі бібліотеки навіть не вантажаться.
  const { ImapFlow } = await import('imapflow')
  const { simpleParser } = await import('mailparser')

  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.password },
    logger: false,
  })

  await client.connect()
  const lock = await client.getMailboxLock(cfg.mailbox)
  try {
    for await (const msg of client.fetch({ seen: false }, { uid: true, source: true })) {
      summary.processed += 1
      try {
        const parsed = await simpleParser(msg.source as Buffer)
        const email = toInboundEmail(parsed)
        if (email) {
          let result: IngestResult
          try {
            result = await runWithSystemContext(() =>
              prisma.$transaction((tx) => ingestInboundEmail(tx as unknown as IngestDb, email))
            )
          } catch (err) {
            // Гонка полерів / повторна вставка того самого Message-ID
            if ((err as { code?: string }).code === 'P2002') {
              result = { status: 'skipped', reason: 'duplicate' }
            } else {
              throw err
            }
          }
          if (result.status === 'created') summary.created += 1
          else if (result.status === 'appended') summary.appended += 1
          else summary.skipped += 1
          if (result.status === 'created' || result.status === 'appended') {
            await runWithSystemContext(() => notifyTeamOfInbound(logger, result))
          } else {
            logger.info(
              { reason: result.reason, from: email.from },
              'inboundEmail: message skipped'
            )
          }
        } else {
          summary.skipped += 1
          logger.warn('inboundEmail: message unparseable (no messageId/from)')
        }
      } catch (err) {
        summary.skipped += 1
        logger.error({ err }, 'inboundEmail: failed to process message')
      }
      // Позначаємо оброблене прочитаним у будь-якому разі (skip теж) — щоб не крутити.
      try {
        await client.messageFlagsAdd(msg.uid, ['\\Seen'], { uid: true })
      } catch (err) {
        logger.error({ err, uid: msg.uid }, 'inboundEmail: failed to mark \\Seen')
      }
    }
  } finally {
    lock.release()
    await client.logout()
  }
  return summary
}

// mailparser ParsedMail → провайдер-агностична форма. `unknown`-вхід, бо тип
// вантажиться лише в рантаймі динамічним import.
function toInboundEmail(parsed: unknown): InboundEmail | null {
  const p = parsed as {
    messageId?: string
    subject?: string
    text?: string
    inReplyTo?: string
    references?: string | string[]
    from?: { value?: Array<{ address?: string }> }
  }
  const messageId = p.messageId?.trim()
  const from = p.from?.value?.[0]?.address?.trim().toLowerCase()
  if (!messageId || !from) return null
  const refs = p.references
  const references = (Array.isArray(refs) ? refs : refs ? [refs] : [])
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
  return {
    messageId,
    from,
    subject: (p.subject ?? '').trim(),
    text: (p.text ?? '').trim(),
    inReplyTo: p.inReplyTo?.trim() ?? null,
    references,
  }
}
