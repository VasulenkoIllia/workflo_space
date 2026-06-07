import { z } from 'zod'

const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long')

export const loginSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
})

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  displayName: z.string().min(2),
  companyName: z.string().min(2),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
})

/** Switch the session's active agency (ADR-004 multi-agency staffer). */
export const switchAgencySchema = z.object({
  agencyId: z.string().uuid(),
})
