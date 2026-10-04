import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** GET /workspace/services — one catalog service. */
export interface CatalogService {
  id: string
  name: string
  description: string | null
  isActive: boolean
  isRecurring: boolean
  defaultPriceUsd: string | null
  estimatedHours: string | null
  createdAt: string
}

export interface ServiceInput {
  name?: string
  description?: string | null
  defaultPriceUsd?: number | null
  estimatedHours?: number | null
  isRecurring?: boolean
  isActive?: boolean
}

export function useServices() {
  return useQuery({
    queryKey: ['ws-services'],
    queryFn: () => api.get<{ services: CatalogService[] }>('/workspace/services'),
  })
}

export function useSaveService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: ServiceInput & { id?: string }) =>
      id
        ? api.patch<{ service: CatalogService }>(`/workspace/services/${id}`, body)
        : api.post<{ service: CatalogService }>('/workspace/services', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-services'] }),
  })
}

export function useDeleteService() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ deleted: boolean }>(`/workspace/services/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['ws-services'] }),
  })
}

export function num(s: string | null | undefined): number | null {
  return s == null ? null : Number(s)
}
