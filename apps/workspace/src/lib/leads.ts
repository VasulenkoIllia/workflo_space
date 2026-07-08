import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'
export type LeadStageKind = 'open' | 'won' | 'lost'

/** ХВІСТ-4: кастомна стадія воронки (per-agency). */
export interface LeadStage {
  id: string
  name: string
  kind: LeadStageKind
  position: number
}

/** A CRM lead (module 26). */
export interface Lead {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  source: string | null
  status: LeadStatus
  stageId: string | null
  stage: LeadStage | null
  estimatedValue: string | null
  currency: string
  notes: string | null
  assigneeId: string | null
  companyId: string | null
  convertedOrderId: string | null
  lostReason: string | null
  position: number
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  createdAt: string
  updatedAt: string
}

/** One journal entry of the lead timeline (26-ТАЙМЛАЙН). actorId null = website intake. */
export interface LeadActivity {
  id: string
  actorId: string | null
  type: 'created' | 'stage_changed' | 'assigned' | 'updated' | 'converted' | (string & {})
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface LeadInput {
  name: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  estimatedValue?: number | null
  notes?: string | null
}

export function useLeads(status?: LeadStatus) {
  return useQuery({
    queryKey: ['ws-leads', status ?? 'all'],
    queryFn: () =>
      api.get<{ leads: Lead[] }>(`/workspace/leads${status ? `?status=${status}` : ''}`),
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['ws-lead', id],
    queryFn: () => api.get<{ lead: Lead }>(`/workspace/leads/${id}`).then((r) => r.lead),
    enabled: id !== '',
  })
}

export function useLeadActivity(id: string) {
  return useQuery({
    queryKey: ['ws-lead-activity', id],
    queryFn: () =>
      api
        .get<{ activities: LeadActivity[] }>(`/workspace/leads/${id}/activity`)
        .then((r) => r.activities),
    enabled: id !== '',
  })
}

function invalidateLeads(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['ws-leads'] })
  void qc.invalidateQueries({ queryKey: ['ws-lead'] })
  void qc.invalidateQueries({ queryKey: ['ws-lead-activity'] })
}

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LeadInput) => api.post<{ lead: Lead }>('/workspace/leads', body),
    onSuccess: () => invalidateLeads(qc),
  })
}

/** Fields the update endpoint accepts (mirrors the backend .strict() schema; no `won` here —
 * that goes through convert). estimatedValue is sent as a number. */
export interface LeadUpdateInput {
  id: string
  name?: string
  contactName?: string | null
  email?: string | null
  phone?: string | null
  source?: string | null
  status?: Exclude<LeadStatus, 'won'>
  stageId?: string
  estimatedValue?: number | null
  notes?: string | null
  assigneeId?: string | null
  lostReason?: string | null
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: LeadUpdateInput) =>
      api.patch<{ lead: Lead }>(`/workspace/leads/${id}`, body),
    onSuccess: () => invalidateLeads(qc),
  })
}

export function useConvertLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, companyId, title }: { id: string; companyId: string; title?: string }) =>
      api.post<{ lead: Lead; orderId: string }>(`/workspace/leads/${id}/convert`, {
        companyId,
        ...(title ? { title } : {}),
      }),
    onSuccess: () => invalidateLeads(qc),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/leads/${id}`),
    onSuccess: () => invalidateLeads(qc),
  })
}

// ── ХВІСТ-4: кастомні стадії воронки ──────────────────────────────────────────
export function useLeadStages() {
  return useQuery({
    queryKey: ['ws-lead-stages'],
    queryFn: () => api.get<{ stages: LeadStage[] }>('/workspace/lead-stages').then((r) => r.stages),
  })
}

function invalidateStages(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['ws-lead-stages'] })
  void qc.invalidateQueries({ queryKey: ['ws-leads'] })
}

export function useCreateLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.post<{ stage: LeadStage }>('/workspace/lead-stages', { name }),
    onSuccess: () => invalidateStages(qc),
  })
}

export function useUpdateLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; name?: string; position?: number }) =>
      api.patch<{ stage: LeadStage }>(`/workspace/lead-stages/${id}`, body),
    onSuccess: () => invalidateStages(qc),
  })
}

export function useDeleteLeadStage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/lead-stages/${id}`),
    onSuccess: () => invalidateStages(qc),
  })
}
