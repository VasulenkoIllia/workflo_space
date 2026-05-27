import { z } from 'zod'

/**
 * Notification service env config.
 *
 * Split into two: email config is required (templates need it),
 * telegram config is optional — if BOT_TOKEN is missing, the adapter
 * returns `{ status: 'skipped' }` and the resolver continues with email only.
 */

const EmailEnvSchema = z.object({
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .union([z.boolean(), z.string()])
    .transform((v) => (typeof v === 'string' ? v === 'true' : v))
    .default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().email().default('noreply@workflo.space'),
  SMTP_FROM_NAME: z.string().default('Workflo'),
})

const TelegramEnvSchema = z.object({
  BOT_TOKEN: z.string().min(1).optional(),
  BOT_WEBHOOK_SECRET: z.string().min(16).optional(),
})

const ConfigEnvSchema = EmailEnvSchema.merge(TelegramEnvSchema)

export type EmailConfig = z.infer<typeof EmailEnvSchema>
export type TelegramConfig = z.infer<typeof TelegramEnvSchema>
export type NotificationConfig = z.infer<typeof ConfigEnvSchema>

/**
 * Load + validate notification config from process.env (or a passed override).
 * Throws ZodError on missing required SMTP_* — caller is expected to fail-fast
 * at startup. Telegram fields are optional; absence disables that adapter.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): NotificationConfig {
  return ConfigEnvSchema.parse(env)
}

/**
 * Convenience: just the email-relevant subset.
 */
export function loadEmailConfig(env: NodeJS.ProcessEnv = process.env): EmailConfig {
  return EmailEnvSchema.parse(env)
}

/**
 * Convenience: just the telegram-relevant subset.
 */
export function loadTelegramConfig(env: NodeJS.ProcessEnv = process.env): TelegramConfig {
  return TelegramEnvSchema.parse(env)
}
