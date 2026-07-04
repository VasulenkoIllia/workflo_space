import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { resolveJwtSecret } from '../auth/jwtSecret.js'

/**
 * Google OAuth 2.0 code flow (S9, canon 01-auth §E) — no SDK, two HTTPS calls.
 * Unconfigured (missing env) → callers return 503/hide the button, the rest of
 * the API is unaffected (same pattern as the vault KEK).
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const STATE_TTL_MS = 10 * 60 * 1000

export interface GoogleOauthConfig {
  clientId: string
  clientSecret: string
  callbackUrl: string
}

export function googleOauthConfig(): GoogleOauthConfig | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  const callbackUrl = process.env.GOOGLE_OAUTH_CALLBACK_URL
  if (!clientId || !clientSecret || !callbackUrl) return null
  return { clientId, clientSecret, callbackUrl }
}

/** Which SPA started the flow — the callback must land the user back on it. */
export type OauthApp = 'portal' | 'workspace'

/**
 * CSRF state: HMAC-signed JSON (same signer pattern as the 2FA challenge —
 * NOT a JWT, single-purpose). `link` carries the profileId of the logged-in
 * user who asked to connect Google to their existing account.
 */
export interface OauthState {
  v: 'login' | 'link'
  app: OauthApp
  p?: string // profileId (link intent only)
}

export function signState(state: OauthState): string {
  const body = Buffer.from(
    JSON.stringify({ ...state, exp: Date.now() + STATE_TTL_MS, n: randomBytes(8).toString('hex') })
  ).toString('base64url')
  const mac = createHmac('sha256', resolveJwtSecret()).update(body).digest('base64url')
  return `${body}.${mac}`
}

export function verifyState(raw: string): OauthState | null {
  const [body, mac] = raw.split('.')
  if (!body || !mac) return null
  const expected = createHmac('sha256', resolveJwtSecret()).update(body).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString()) as OauthState & {
      exp: number
    }
    if (parsed.exp < Date.now()) return null
    if (parsed.v !== 'login' && parsed.v !== 'link') return null
    if (parsed.app !== 'portal' && parsed.app !== 'workspace') return null
    return { v: parsed.v, app: parsed.app, p: parsed.p }
  } catch {
    return null
  }
}

export function buildAuthUrl(cfg: GoogleOauthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.callbackUrl,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  })
  return `${AUTH_ENDPOINT}?${params.toString()}`
}

export interface GoogleIdentity {
  providerAccountId: string
  email: string
  emailVerified: boolean
  name: string
  picture: string | null
}

/**
 * Exchange the auth code for tokens and read the identity from the id_token.
 * The id_token arrives over TLS straight from Google's token endpoint, so its
 * payload is trusted without local signature verification (standard practice
 * for the confidential-client code flow).
 */
export async function exchangeCode(
  cfg: GoogleOauthConfig,
  code: string
): Promise<GoogleIdentity | null> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: cfg.callbackUrl,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) return null
  const data = (await res.json()) as { id_token?: string }
  if (!data.id_token) return null

  const segments = data.id_token.split('.')
  if (segments.length !== 3) return null
  try {
    const payload = JSON.parse(Buffer.from(segments[1] as string, 'base64url').toString()) as {
      iss?: string
      aud?: string
      exp?: number
      sub?: string
      email?: string
      email_verified?: boolean
      name?: string
      picture?: string
    }
    // Claim checks (OIDC Core §3.1.3.7) — defense-in-depth atop the direct-TLS
    // exchange: issuer is Google, audience is US, and the token is unexpired.
    const issOk =
      payload.iss === 'accounts.google.com' || payload.iss === 'https://accounts.google.com'
    if (!issOk) return null
    if (payload.aud !== cfg.clientId) return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return null
    if (!payload.sub || !payload.email) return null
    return {
      providerAccountId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email.split('@')[0] ?? 'Google user',
      picture: payload.picture ?? null,
    }
  } catch {
    return null
  }
}
