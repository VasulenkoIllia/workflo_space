import nodemailer, { type Transporter } from 'nodemailer'
import { loadEmailConfig, type EmailConfig } from '../config.js'

let _transport: Transporter | null = null
let _activeConfig: EmailConfig | null = null

/**
 * Singleton transport. Lazily created so unit tests can stub the env before import.
 * Pass `override` to bypass the singleton (used in tests / multi-tenant SMTP).
 */
export function getMailer(override?: EmailConfig): Transporter {
  if (override) {
    return nodemailer.createTransport({
      host: override.SMTP_HOST,
      port: override.SMTP_PORT,
      secure: override.SMTP_SECURE,
      auth:
        override.SMTP_USER && override.SMTP_PASS
          ? { user: override.SMTP_USER, pass: override.SMTP_PASS }
          : undefined,
    })
  }

  if (_transport && _activeConfig) {
    return _transport
  }

  const cfg = loadEmailConfig()
  _activeConfig = cfg
  _transport = nodemailer.createTransport({
    host: cfg.SMTP_HOST,
    port: cfg.SMTP_PORT,
    secure: cfg.SMTP_SECURE,
    auth: cfg.SMTP_USER && cfg.SMTP_PASS ? { user: cfg.SMTP_USER, pass: cfg.SMTP_PASS } : undefined,
  })
  return _transport
}

/** Reset singleton — exposed for tests so they can re-init with new env. */
export function resetMailer(): void {
  _transport = null
  _activeConfig = null
}

export function getActiveFrom(): { address: string; name: string } {
  const cfg = _activeConfig ?? loadEmailConfig()
  return { address: cfg.SMTP_FROM, name: cfg.SMTP_FROM_NAME }
}

/** Verify SMTP connectivity (uses `transporter.verify` from Nodemailer). */
export async function verifyMailer(): Promise<boolean> {
  const tx = getMailer()
  await tx.verify()
  return true
}
