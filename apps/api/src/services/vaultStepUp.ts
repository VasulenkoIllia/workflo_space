import { prisma } from '@workflo/db'
import { verifyPassword } from '../auth/password.js'
import { isEnabled, verifyChallenge } from './twoFactor.js'

/**
 * TOTP-first step-up for vault reveal (рішення власника 05.07): whoever has TOTP 2FA
 * enabled must prove it with a 6-digit code (or a one-time backup code) — a leaked
 * password alone no longer opens secrets. Accounts without 2FA keep the password
 * fallback. Shared by the workspace and portal step-up endpoints.
 */
export type StepUpFailure = 'code_required' | 'password_required' | 'bad_code' | 'bad_password'
export type StepUpResult =
  | { ok: true; method: 'totp' | 'password' }
  | { ok: false; reason: StepUpFailure }

export async function verifyVaultStepUp(
  profileId: string,
  input: { password?: string; code?: string }
): Promise<StepUpResult> {
  if (await isEnabled(profileId)) {
    // 2FA on → the code is the ONLY accepted proof (no password downgrade).
    if (!input.code) return { ok: false, reason: 'code_required' }
    const outcome = await verifyChallenge(profileId, input.code)
    return outcome === 'ok' ? { ok: true, method: 'totp' } : { ok: false, reason: 'bad_code' }
  }
  if (!input.password) return { ok: false, reason: 'password_required' }
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: { passwordHash: true },
  })
  const ok = profile ? await verifyPassword(input.password, profile.passwordHash) : false
  return ok ? { ok: true, method: 'password' } : { ok: false, reason: 'bad_password' }
}

export const STEP_UP_FAILURE_MESSAGE: Record<
  StepUpFailure,
  { status: 400 | 401; message: string }
> = {
  code_required: { status: 400, message: 'У вас увімкнено 2FA — введіть код автентифікатора' },
  password_required: { status: 400, message: 'Введіть пароль' },
  bad_code: { status: 401, message: 'Невірний код' },
  bad_password: { status: 401, message: 'Невірний пароль' },
}
