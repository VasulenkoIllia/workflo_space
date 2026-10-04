import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiErrorCode, type VaultField, type VaultResourceType } from '@workflo/types'
import { api } from '@/lib/api'

/** Error code the reveal endpoint returns (HTTP 403) when a step-up grant is required. */
export const STEP_UP_REQUIRED: string = ApiErrorCode.STEP_UP_REQUIRED

// ── Reveal step-up grant (2FA-on-reveal), portal side ────────────────────────────────
// Short-lived password grant cached in memory: one password prompt per 5-min window,
// never persisted. Mirrors the workspace vault lib (17-А).
let revealGrant: { grant: string; expMs: number } | null = null
const SKEW_MS = 5_000

export function setRevealGrant(grant: string, expiresAt: string): void {
  revealGrant = { grant, expMs: new Date(expiresAt).getTime() }
}
export function getRevealGrant(): string | null {
  if (revealGrant && revealGrant.expMs - SKEW_MS > Date.now()) return revealGrant.grant
  revealGrant = null
  return null
}
export function hasValidRevealGrant(): boolean {
  return getRevealGrant() !== null
}

/** Step-up: exchange the client's proof (TOTP code when 2FA is on, password otherwise)
 * for a reveal grant (cached on success). */
export function useVaultStepUp() {
  return useMutation({
    mutationFn: (body: { password?: string; code?: string }) =>
      api.post<{ grant: string; expiresAt: string }>('/portal/vault/step-up', body),
    onSuccess: (r) => setRevealGrant(r.grant, r.expiresAt),
  })
}

/** One secret of the client's company (metadata only — plaintext lives behind /reveal).
 * `mine` — created by the current user (hard-delete allowed only for those). */
export interface PortalCredential {
  id: string
  label: string
  service: string | null
  url: string | null
  username: string | null
  /** 17-Д: key of VAULT_RESOURCE_TYPES; null = legacy freeform row. */
  resourceType: string | null
  /** 17-Д: ordered NON-secret fields of a typed card (secret ones live behind /reveal). */
  publicFields: VaultField[] | null
  notes: string | null
  /** 17-РОТАЦІЯ: optional access expiry (ISO); the cron nags the agency owner near/past it. */
  expiresAt: string | null
  revoked: boolean
  revokedAt: string | null
  createdAt: string
  updatedAt: string
  mine: boolean
}

export interface PortalCredentialInput {
  label: string
  service?: string | null
  url?: string | null
  username?: string | null
  secret: string
  notes?: string | null
}

/** 17-Д typed card create-body (mirrors the backend typedCreateSchema). */
export interface PortalTypedCredentialInput {
  label: string
  resourceType: VaultResourceType
  fields: VaultField[]
  notes?: string | null
}

/** Reveal payload: legacy rows → `secret`, typed cards → `secretFields`. */
export interface RevealResult {
  secret?: string
  secretFields?: VaultField[]
}

export function usePortalCredentials(enabled = true) {
  return useQuery({
    queryKey: ['portal-credentials'],
    queryFn: () => api.get<{ credentials: PortalCredential[] }>('/portal/credentials'),
    enabled,
  })
}

export function useCreatePortalCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: PortalCredentialInput | PortalTypedCredentialInput) =>
      api.post<{ credential: PortalCredential }>('/portal/credentials', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-credentials'] }),
  })
}

export function useRevealPortalCredential() {
  return useMutation({
    mutationFn: (credId: string) =>
      api.post<RevealResult>(`/portal/credentials/${credId}/reveal`, {
        grant: getRevealGrant(),
      }),
  })
}

/** 17-РОТАЦІЯ: set/clear the access term of one secret (resets the reminder window). */
export function useSetPortalCredentialExpiry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ credId, expiresAt }: { credId: string; expiresAt: string | null }) =>
      api.patch(`/portal/credentials/${credId}/expiry`, { expiresAt }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-credentials'] }),
  })
}

export function useRevokePortalCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credId: string) => api.post(`/portal/credentials/${credId}/revoke`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-credentials'] }),
  })
}

export function useDeletePortalCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credId: string) => api.delete(`/portal/credentials/${credId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['portal-credentials'] }),
  })
}

/** One journal entry (17-Б client-facing): WHO from the team and WHEN — no IP/UA. */
export interface PortalCredentialAuditEntry {
  id: string
  action: string
  result: string
  actorName: string | null
  createdAt: string
}

export function usePortalCredentialAudit(credId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['portal-credential-audit', credId],
    queryFn: () =>
      api.get<{ entries: PortalCredentialAuditEntry[] }>(`/portal/credentials/${credId}/audit`),
    enabled: enabled && credId !== '',
  })
}
