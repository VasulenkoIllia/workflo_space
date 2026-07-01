import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

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

/** Reveal one secret. Deliberately NOT cached — returns the plaintext for one-shot display. */
export function useRevealCredential(companyId: string) {
  return useMutation({
    mutationFn: (credId: string) =>
      api.post<{ secret: string }>(
        `/workspace/clients/${companyId}/credentials/${credId}/reveal`,
        {}
      ),
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
      api.post<{ secret: string }>(
        `/workspace/clients/${companyId}/credentials/${credId}/reveal`,
        {}
      ),
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
