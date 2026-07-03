import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { PrismaClient } from '@workflo/db'
import type { FastifyReply } from 'fastify'

/**
 * High-entropy opaque token (256 bits, base64url) for invites / password-reset.
 * Stronger than Prisma's `@default(uuid())` (122-bit, structured) for single-use
 * security tokens that grant account access or role promotion (audit 31.05).
 */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url')
}

export const REFRESH_COOKIE_NAME = 'refresh_token'
export const REFRESH_COOKIE_PATH = '/auth/refresh'
const REFRESH_TTL_DAYS = 30

/**
 * Per-member permission flags (stored in CompanyMember.permissions JSON).
 * Defaults live in CONCEPT_v2; owner implicitly has all of them. Members get
 * only what the owner grants. Read by can() — see ADR-002 / audit D1.
 */
export interface CompanyPermissions {
  can_create_tasks?: boolean
  can_view_all_tasks?: boolean
  can_view_billing?: boolean
  can_approve_estimates?: boolean
  can_invite_members?: boolean
}

export interface Membership {
  companyId: string
  role: 'owner' | 'member'
  permissions?: CompanyPermissions
}

/**
 * Narrow a Prisma `Json` value to CompanyPermissions. Only a plain object counts;
 * a non-object JSON (string/number/array/null) → undefined, so permission flags
 * read as `false` rather than a truthy coincidence (audit 31.05).
 */
export function coercePermissions(json: unknown): CompanyPermissions | undefined {
  return json !== null && typeof json === 'object' && !Array.isArray(json)
    ? (json as CompanyPermissions)
    : undefined
}

/**
 * Agency (tenant) membership for internal team — owner/executor of an agency
 * (ADR-004). Clients are NOT agency members; their tenant is derived from their
 * active company's agencyId. Drives the can() tenant-guard.
 */
/** Agency team role (20-А, MOD-4). `manager` sits between owner and executor: it sees
 *  orders/chats/clients but NOT finance/settings (enforced in `can()`). */
export type AgencyRole = 'owner' | 'manager' | 'executor'

export interface AgencyMembership {
  agencyId: string
  role: AgencyRole
}

/**
 * Access-token claims. Kept small (15m TTL) — `activeCompanyId` is the company
 * the user is currently operating in; `memberships` lets the client render the
 * company switcher without an extra round-trip. See modules/01-auth.md.
 */
export interface AccessClaims {
  sub: string
  email: string
  role: 'owner' | 'executor' | 'client'
  activeAgencyId: string | null
  activeCompanyId: string | null
  agencyMemberships: AgencyMembership[]
  memberships: Membership[]
  /** Session id = refresh-token familyId (S9-02); lets /auth/sessions mark «current». */
  sid?: string | null
}

/**
 * Internal team = staff of any agency (executor OR owner). Source of truth for
 * "staff vs client" — replaces the global `Profile.role === 'executor'` check,
 * which wrongly locked agency OWNERS out of team features (audit C-2). Derived
 * from agency memberships, so it also handles a person who is both a client (of
 * a company) and staff (of an agency). `Profile.role` stays a UI hint only.
 */
export function isInternalTeam(user: Pick<AccessClaims, 'agencyMemberships'>): boolean {
  return (user.agencyMemberships?.length ?? 0) > 0
}

/** The user's team role in a specific agency (20-А, MOD-4), or null if not a member. */
export function agencyRole(
  user: Pick<AccessClaims, 'agencyMemberships'>,
  agencyId: string | undefined
): AgencyRole | null {
  if (!agencyId) return null
  return user.agencyMemberships?.find((m) => m.agencyId === agencyId)?.role ?? null
}

/** True iff the user is a `manager` (not owner/executor) of the given agency (MOD-4). */
export function isAgencyManager(
  user: Pick<AccessClaims, 'agencyMemberships'>,
  agencyId: string | undefined
): boolean {
  return agencyRole(user, agencyId) === 'manager'
}

export function buildAccessClaims(params: {
  profileId: string
  email: string
  role: 'owner' | 'executor' | 'client'
  activeAgencyId: string | null
  activeCompanyId: string | null
  agencyMemberships: AgencyMembership[]
  memberships: Membership[]
  sid?: string | null
}): AccessClaims {
  return {
    sub: params.profileId,
    email: params.email,
    role: params.role,
    activeAgencyId: params.activeAgencyId,
    activeCompanyId: params.activeCompanyId,
    agencyMemberships: params.agencyMemberships,
    memberships: params.memberships,
    sid: params.sid ?? null,
  }
}

/**
 * AR-31 (audit 2026-06-11): refresh tokens are stored as sha256 hex digests, never
 * raw — a DB dump/backup leak must not yield live session tokens. The raw value
 * lives only in the httpOnly cookie; every DB lookup hashes first. sha256 (not
 * bcrypt) is correct here: the input is 256 bits of entropy, so brute-force is
 * infeasible and the lookup stays index-friendly.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

/** Device/session metadata stored on the refresh row (S9-02 sessions list). */
export interface SessionMeta {
  userAgent?: string | null
  ip?: string | null
  /** Carried across rotations — omit on a fresh login (a new family starts). */
  familyId?: string
  /** Original sign-in time; carried across rotations. Defaults to now. */
  firstIssuedAt?: Date
}

/**
 * Create an opaque refresh token row and return its RAW value (the DB stores only
 * the sha256 digest — AR-31). Opaque (not a JWT) so it can be revoked server-side
 * via refresh_tokens.revokedAt.
 * Accepts a tx client so it can run inside the registration transaction.
 */
export async function issueRefreshToken(
  tx: Pick<PrismaClient, 'refreshToken'>,
  profileId: string,
  meta: SessionMeta = {}
): Promise<{ token: string; expiresAt: Date; familyId: string }> {
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000)
  // High-entropy opaque token (256 bits). base64url so it's cookie-safe.
  const token = randomBytes(32).toString('base64url')
  const familyId = meta.familyId ?? randomUUID()
  await tx.refreshToken.create({
    data: {
      profileId,
      token: hashRefreshToken(token),
      expiresAt,
      familyId,
      userAgent: meta.userAgent ?? null,
      ip: meta.ip ?? null,
      firstIssuedAt: meta.firstIssuedAt ?? new Date(),
    },
  })
  return { token, expiresAt, familyId }
}

function cookieDomain(): string | undefined {
  // In production cookies are shared across *.workflo.space subdomains.
  return process.env.COOKIE_DOMAIN || undefined
}

/** Set the refresh cookie per ADR-001 (SameSite=Lax, Path=/auth/refresh). */
export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'lax',
    path: REFRESH_COOKIE_PATH,
    domain: cookieDomain(),
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60,
    signed: false,
  })
}

/** Clear the refresh cookie (logout). Must match path+domain used to set it. */
export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    domain: cookieDomain(),
  })
}
