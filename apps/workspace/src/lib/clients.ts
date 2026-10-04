import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CompanyPermissionKey } from '@workflo/types'
import { api } from '@/lib/api'
import { useCompanies } from './projects'

/** GET /workspace/clients/:id/members — client (company) member roster (28-Б «Люди»).
 * Internal-non-manager on the backend → gate the query with `enabled`. */
export interface ClientMember {
  profileId: string
  name: string
  email: string
  role: string
  joinedAt: string
  /** PORTAL-MEMBER: прапорці учасника (власник компанії має все). */
  permissions?: Partial<Record<CompanyPermissionKey, boolean>>
}

export function useClientMembers(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['client-members', companyId],
    queryFn: () => api.get<{ members: ClientMember[] }>(`/workspace/clients/${companyId}/members`),
    enabled: companyId !== '' && enabled,
  })
}

/** GET /workspace/clients/:id/activity — агрегований timeline (28-Б «Активність»).
 * Об'єднує події замовлень + платежі + документи клієнта. Internal-non-manager. */
export interface ClientActivityItem {
  id: string
  kind: 'order' | 'payment' | 'document'
  at: string
  title: string
  orderId: string | null
  actorName: string | null
}

export function useClientActivity(companyId: string, enabled = true) {
  return useQuery({
    queryKey: ['client-activity', companyId],
    queryFn: () =>
      api
        .get<{ items: ClientActivityItem[] }>(`/workspace/clients/${companyId}/activity`)
        .then((r) => r.items),
    enabled: companyId !== '' && enabled,
  })
}

/** PATCH role — agency owner only (28-Б). Backend refuses demoting the last owner (409). */
export function useUpdateClientMemberRole(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ profileId, role }: { profileId: string; role: 'owner' | 'member' }) =>
      api.patch(`/workspace/clients/${companyId}/members/${profileId}`, { role }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-members', companyId] }),
  })
}

/** POST invite — agency owner adds a member to a client company on-behalf (28-Б).
 * Sends a portal invite email; the row appears once the invitee accepts. */
export function useInviteClientMember(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      api.post<{ inviteId: string; email: string; expiresAt: string }>(
        `/workspace/clients/${companyId}/members/invite`,
        { email }
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-members', companyId] }),
  })
}

/** POST reset-password — agency owner triggers a reset email for a locked-out client member
 * (28-Б). The agency never sees/sets the password; the member completes it from their inbox. */
export function useResetClientMemberPassword(companyId: string) {
  return useMutation({
    mutationFn: (profileId: string) =>
      api.post(`/workspace/clients/${companyId}/members/${profileId}/reset-password`, {}),
  })
}

/** PORTAL-MEMBER: агенція (clients.manage) вмикає учаснику компанії права порталу. */
export function useSetClientMemberPermission(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { profileId: string; key: CompanyPermissionKey; on: boolean }) =>
      api.patch(`/workspace/clients/${companyId}/members/${v.profileId}/permissions`, {
        [v.key]: v.on,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-members', companyId] }),
  })
}

/**
 * CORE-FLOWS (D4): агенція заводить компанію-клієнта (clients.manage). Контакт (опційно)
 * запрошується в портал — перший, хто прийме, стає власником компанії.
 */
export function useCreateClient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { name: string; currency?: string; contactEmail?: string }) => {
      const { company } = await api.post<{ company: { id: string; name: string } }>(
        '/workspace/companies',
        { name: v.name, ...(v.currency ? { currency: v.currency } : {}) }
      )
      let invited = false
      if (v.contactEmail) {
        try {
          await api.post(`/workspace/clients/${company.id}/members/invite`, {
            email: v.contactEmail,
          })
          invited = true
        } catch {
          invited = false // компанію створено; запросити можна з картки «Люди»
        }
      }
      return { company, invited }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['companies'] })
      void qc.invalidateQueries({ queryKey: ['ws-orders'] })
    },
  })
}

/** DELETE member — agency owner only. Backend refuses removing the last owner (409). */
export function useRemoveClientMember(companyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) =>
      api.delete(`/workspace/clients/${companyId}/members/${profileId}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-members', companyId] }),
  })
}

/**
 * Client (company) row: the agency's company registry (GET /workspace/companies —
 * real names + loyalty tier) enriched with order activity derived from the orders
 * list. Rich profile fields still pending backend (LTV / debt / industry / last
 * contact → clients module 28).
 */
export interface ClientRow {
  companyId: string
  name: string
  loyaltyTier: string | null
  total: number
  active: number
  /** null — без billing.view (сум не показуємо). */
  totalValue: number | null
  debt: number | null
  lastActivityAt: string | null
}

export interface ClientRisk {
  id: 'debt' | 'stale' | 'churn'
  tone: 'bad' | 'warn' | 'muted'
  label: string
  hint: string
}

const DAY_MS = 86_400_000
/** Тиша довше за це при відкритих замовленнях — привід зателефонувати. */
export const STALE_DAYS = 14

/**
 * DSN-7 (design-v2 workspace-clients.jsx · 28-Г): прапорці ризику з РЕАЛЬНИХ агрегатів —
 * борг (з billing.view), тиша по відкритих замовленнях, ризик відтоку (1 замовлення, тір new).
 */
export function clientRisks(c: ClientRow, now = Date.now()): ClientRisk[] {
  const r: ClientRisk[] = []
  if (c.debt != null && c.debt > 0) {
    r.push({
      id: 'debt',
      tone: 'warn',
      label: `борг ${Math.round(c.debt).toLocaleString('uk-UA')}`,
      hint: 'неоплачені замовлення',
    })
  }
  if (c.active > 0 && c.lastActivityAt) {
    const days = Math.floor((now - new Date(c.lastActivityAt).getTime()) / DAY_MS)
    if (days >= STALE_DAYS) {
      r.push({
        id: 'stale',
        tone: days >= 30 ? 'bad' : 'warn',
        label: `тиша ${days}д`,
        hint: 'по відкритих замовленнях давно не було руху',
      })
    }
  }
  // рівно одне (завершене) замовлення й нічого відкритого; новий клієнт без замовлень — не ризик
  if (c.total === 1 && (c.loyaltyTier === 'new' || c.loyaltyTier == null) && c.active === 0) {
    r.push({ id: 'churn', tone: 'muted', label: 'ризик відтоку', hint: 'одне замовлення й тиша' })
  }
  return r
}

/** Реєстр клієнтів агенції з агрегатами бекенду (GET /workspace/companies). */
export function useClients(enabled = true) {
  const companies = useCompanies(enabled)
  const clients = useMemo<ClientRow[]>(
    () =>
      (companies.data?.companies ?? [])
        .map((c) => ({
          companyId: c.id,
          name: c.name,
          loyaltyTier: c.loyaltyTier,
          total: c.ordersTotal ?? 0,
          active: c.ordersActive ?? 0,
          totalValue: c.totalValue ?? null,
          debt: c.debt ?? null,
          lastActivityAt: c.lastActivityAt ?? null,
        }))
        .sort((a, b) => b.active - a.active || b.total - a.total),
    [companies.data]
  )
  return {
    clients,
    isLoading: companies.isLoading,
    isError: companies.isError,
    refetch: companies.refetch,
  }
}
