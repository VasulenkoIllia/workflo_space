import type { Transporter } from 'nodemailer'
import { getMailer, getActiveFrom } from '../email/mailer.js'

export interface EmailAttachment {
  filename: string
  content: Buffer | string
  contentType?: string
}

export interface EmailPayload {
  to: string
  subject: string
  html: string
  /** Optional From override; defaults to SMTP_FROM_NAME <SMTP_FROM>. */
  from?: { name: string; address: string }
  /** 06-SEND: вкладення (PDF документа тощо) — прокидаються в nodemailer як є. */
  attachments?: EmailAttachment[]
  /** S12-05: додаткові SMTP-заголовки (List-Unsubscribe тощо). */
  headers?: Record<string, string>
}

/**
 * Minimal subset of Nodemailer's SentMessageInfo we actually read.
 * Avoid pulling the full typing surface so consumers don't need to install nodemailer types.
 */
export interface RawSentInfo {
  accepted: ReadonlyArray<string>
  rejected: ReadonlyArray<string>
  messageId?: string
  response?: string
}

export type EmailSendResult =
  | { status: 'sent'; messageId?: string; response?: string }
  | { status: 'rejected'; reason: 'address_rejected'; rejectedAddresses: ReadonlyArray<string> }
  | { status: 'failed'; reason: 'transport_error'; error: string }

export interface SendEmailOpts {
  /** Override transport — for tests / multi-tenant SMTP routing. */
  transport?: Transporter
}

export async function sendEmail(
  payload: EmailPayload,
  opts: SendEmailOpts = {}
): Promise<EmailSendResult> {
  // Resolve transport + From inside try/catch so a misconfigured SMTP env
  // (missing SMTP_HOST etc.) surfaces as a 'failed' result rather than
  // throwing — notify() relies on this never throwing.
  try {
    const tx = opts.transport ?? getMailer()
    const from =
      payload.from ??
      (() => {
        const f = getActiveFrom()
        return { name: f.name, address: f.address }
      })()

    const info = (await tx.sendMail({
      from: { name: from.name, address: from.address },
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.attachments?.length ? { attachments: payload.attachments } : {}),
      ...(payload.headers ? { headers: payload.headers } : {}),
    })) as RawSentInfo

    if (info.rejected && info.rejected.length > 0) {
      return {
        status: 'rejected',
        reason: 'address_rejected',
        rejectedAddresses: info.rejected,
      }
    }

    return {
      status: 'sent',
      messageId: info.messageId,
      response: info.response,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 'failed', reason: 'transport_error', error: message }
  }
}
