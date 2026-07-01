import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiErrorCode } from '@workflo/types'
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
    mutationFn: (body: CredentialInput) =>
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
      api.post<{ secret: string }>(`/workspace/clients/${companyId}/credentials/${credId}/reveal`, {
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
