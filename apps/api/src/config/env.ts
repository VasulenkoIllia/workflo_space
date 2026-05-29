import { z } from 'zod'

const productionEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Email is required in prod — welcome / password-reset / billing emails
  // (CRITICAL_EVENTS per ADR-003) must be deliverable.
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  // Portal URL is embedded in the welcome email CTA.
  APP_PORTAL_URL: z.string().url('APP_PORTAL_URL must be a valid URL'),
})

export function validateRuntimeEnv() {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const result = productionEnvSchema.safeParse({
    DATABASE_URL: process.env.DATABASE_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    SMTP_HOST: process.env.SMTP_HOST,
    APP_PORTAL_URL: process.env.APP_PORTAL_URL,
  })

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ')
    throw new Error(`Invalid production environment: ${details}`)
  }
}
