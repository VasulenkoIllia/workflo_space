import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'won' | 'lost'

/** A CRM lead (module 26). */
export interface Lead {
  id: string
  name: string
  contactName: string | null
  email: string | null
  phone: string | null
  source: string | null
  status: LeadStatus
  estimatedValue: string | null
  currency: string
  notes: string | null
  assigneeId: string | null
  companyId: string | null
  convertedOrderId: string | null
  lostReason: string | null
  position: number
  createdAt: string
  updatedAt: string
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

export function useCreateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: LeadInput) => api.post<{ lead: Lead }>('/workspace/leads', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-leads'] }),
  })
}

export function useUpdateLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<Lead> & { id: string }) =>
      api.patch<{ lead: Lead }>(`/workspace/leads/${id}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-leads'] }),
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
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-leads'] }),
  })
}

export function useDeleteLead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/workspace/leads/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-leads'] }),
  })
}
