import { z } from 'zod'

// Only these are truly fatal — the API cannot run without them. They match the
// vars docker-compose enforces with `:?` (DATABASE_URL_STAGING/JWT_SECRET_STAGING).
const requiredProductionEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
})

// Recommended but NOT fatal: missing these degrades a feature but must never
// crash the API at boot.
//   - SMTP_HOST: notify() surfaces SMTP failures as { status: 'failed' } (no throw)
//   - PORTAL_URL: email CTA links fall back to https://portal.workflo.space
//   - CORS_ALLOWED_ORIGINS: falls back to the workflo prod defaults (config/origins.ts);
//     set it for any non-default deployment so CORS + the /auth/refresh CSRF guard match
//   - SENTRY_DSN: error monitoring stays off until set (observability/sentry.ts)
//   - CREDENTIALS_KEK_BASE64: 32-byte base64 KEK for the credentials vault (module 17). Absent →
//     vault endpoints 503 (feature off); the rest of the API is unaffected. Generate with
//     `openssl rand -base64 32`.
const RECOMMENDED_PRODUCTION_VARS = [
  'SMTP_HOST',
  'PORTAL_URL',
  'CORS_ALLOWED_ORIGINS',
  'SENTRY_DSN',
  'CREDENTIALS_KEK_BASE64',
] as const

export function validateRuntimeEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const result = requiredProductionEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
  })

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid production environment: ${details}`)
  }

  const missing = RECOMMENDED_PRODUCTION_VARS.filter((name) => !process.env[name])
  if (missing.length > 0) {
    process.stderr.write(
      `[env] WARN missing recommended vars (features degraded, not fatal): ${missing.join(', ')}\n`
    )
  }
}
