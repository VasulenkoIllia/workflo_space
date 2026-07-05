import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiErrorCode, type VaultField, type VaultResourceType } from '@workflo/types'
import { api } from '@/lib/api'

/** Error code the reveal endpoint returns (HTTP 403) when a step-up grant is required.
 * Bound to the shared enum so it can't drift from the API. */
export const STEP_UP_REQUIRED: string = ApiErrorCode.STEP_UP_REQUIRED

// ── Reveal step-up grant (2FA-on-reveal) ────────────────────────────────────────────
// A short-lived password grant, shared in-memory across both vault surfaces so the owner
// isn't re-prompted for every secret within the 5-min window. Never persisted.
let revealGrant: { grant: string; expMs: number } | null = null
const SKEW_MS = 5_000 // treat as expired a bit early to avoid a server-side reject race

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

/** Step-up: exchange the owner's password for a reveal grant (stored in-memory on success). */
export function useVaultStepUp() {
  return useMutation({
    mutationFn: (password: string) =>
      api.post<{ grant: string; expiresAt: string }>('/workspace/vault/step-up', { password }),
    onSuccess: (r) => setRevealGrant(r.grant, r.expiresAt),
  })
}

/** Credentials Vault (module 17) — agency-side. Metadata only; the secret value is revealed
 * one-shot via a dedicated endpoint (never cached). Owner-only on the backend. */
export interface Credential {
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
  revoked: boolean
  revokedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CredentialInput {
  label: string
  service?: string | null
  url?: string | null
  username?: string | null
  secret: string
  notes?: string | null
}

/** 17-Д typed card create-body (mirrors the backend typedCreateSchema). */
export interface TypedCredentialInput {
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

export function useCredentials(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['client-credentials', companyId],
    queryFn: () =>
      api.get<{ credentials: Credential[] }>(`/workspace/clients/${companyId}/credentials`),
    enabled: companyId !== '' && enabled,
  })
}

export function useCreateCredential(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CredentialInput | TypedCredentialInput) =>
      api.post<{ credential: Credential }>(`/workspace/clients/${companyId}/credentials`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-credentials', companyId] }),
  })
}

/** One entry of a secret's access journal (17-Б, owner-facing). */
export interface CredentialAuditEntry {
  id: string
  action: string
  result: string
  actorId: string | null
  actorName: string | null
  ip: string | null
  createdAt: string
}

/** Access journal for one secret — «хто і коли відкривав/змінював». Lazy (enabled on expand). */
export function useCredentialAudit(companyId: string, credId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['client-credential-audit', companyId, credId],
    queryFn: () =>
      api.get<{ entries: CredentialAuditEntry[] }>(
        `/workspace/clients/${companyId}/credentials/${credId}/audit`
      ),
    enabled: enabled && companyId !== '' && credId !== '',
  })
}

export function useRevokeCredential(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credId: string) =>
      api.post(`/workspace/clients/${companyId}/credentials/${credId}/revoke`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-credentials', companyId] }),
  })
}

export function useDeleteCredential(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (credId: string) =>
      api.delete(`/workspace/clients/${companyId}/credentials/${credId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-credentials', companyId] }),
  })
}

// ── 17-SHARE: executor access grants (owner-managed) ─────────────────────────────────
/** One active grant: either a point share (credentialId) or a whole-client share (companyId). */
export interface VaultShare {
  id: string
  credentialId: string | null
  companyId: string | null
  executorId: string
  grantedById: string
  createdAt: string
}

export function useVaultShares(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['vault-shares', companyId],
    queryFn: () =>
      api.get<{ shares: VaultShare[] }>(`/workspace/vault/shares?companyId=${companyId}`),
    enabled: enabled && companyId !== '',
  })
}

export function useGrantShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { executorId: string; credentialId?: string; companyId?: string }) =>
      api.post<{ share: VaultShare }>('/workspace/vault/shares', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vault-shares'] }),
  })
}

export function useRevokeShare() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (shareId: string) => api.delete(`/workspace/vault/shares/${shareId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vault-shares'] }),
  })
}

// ── Global vault (17-ГЛОБАЛ): all secrets across the agency's clients ────────────────
export interface GlobalCredential extends Credential {
  companyId: string
  companyName: string
}

export function useGlobalVault() {
  return useQuery({
    queryKey: ['ws-vault'],
    queryFn: () => api.get<{ credentials: GlobalCredential[] }>('/workspace/vault'),
  })
}

/** Reveal from the global list — routes back to the per-company endpoint. Not cached. */
export function useRevealGlobal() {
  return useMutation({
    mutationFn: ({ companyId, credId }: { companyId: string; credId: string }) =>
      api.post<RevealResult>(`/workspace/clients/${companyId}/credentials/${credId}/reveal`, {
        grant: getRevealGrant(),
      }),
  })
}

export function useRevokeGlobal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, credId }: { companyId: string; credId: string }) =>
      api.post(`/workspace/clients/${companyId}/credentials/${credId}/revoke`, {}),
    onSuccess: (_r, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ['ws-vault'] })
      void qc.invalidateQueries({ queryKey: ['client-credentials', companyId] })
    },
  })
}

export function useDeleteGlobal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ companyId, credId }: { companyId: string; credId: string }) =>
      api.delete(`/workspace/clients/${companyId}/credentials/${credId}`),
    onSuccess: (_r, { companyId }) => {
      void qc.invalidateQueries({ queryKey: ['ws-vault'] })
      void qc.invalidateQueries({ queryKey: ['client-credentials', companyId] })
    },
  })
}
