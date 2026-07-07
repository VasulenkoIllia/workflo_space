import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * 02-Б НОМЕНКЛАТУРА: довідник офіційних позицій «згідно КВЕД» — обирається на
 * замовленні/проекті, її назва друкується в рахунках/актах. vatRate — закладене
 * на майбутнє поле (ПДВ поки не рахується). Кошторис замовлення: к-сть × ціна,
 * Σ автоматично стає сумою замовлення; друкується у специфікації.
 */
export interface NomenclatureItem {
  id: string
  name: string
  code: string | null
  vatRate: string | null
  isActive: boolean
  updatedAt: string
}

export interface OrderEstimateLine {
  id?: string
  serviceId: string | null
  name: string
  qty: number
  unitPrice: number
}

export function useNomenclature(enabled = true) {
  return useQuery({
    queryKey: ['nomenclature'],
    queryFn: () => api.get<{ items: NomenclatureItem[] }>('/workspace/nomenclature'),
    enabled,
  })
}

export function useCreateNomenclature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { name: string; code?: string | null; vatRate?: number | null }) =>
      api.post('/workspace/nomenclature', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['nomenclature'] }),
  })
}

export function useDeleteNomenclature() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ outcome: 'deleted' | 'deactivated' }>(`/workspace/nomenclature/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['nomenclature'] }),
  })
}

export function useOrderEstimate(orderId: string, enabled = true) {
  return useQuery({
    queryKey: ['order-estimate', orderId],
    queryFn: () =>
      api.get<{
        lines: (OrderEstimateLine & { qty: string; unitPrice: string })[]
        total: string
      }>(`/orders/${orderId}/estimate`),
    enabled,
  })
}

export function useSaveOrderEstimate(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (lines: OrderEstimateLine[]) =>
      api.put(`/orders/${orderId}/estimate`, {
        lines: lines.map((l) => ({
          ...(l.serviceId ? { serviceId: l.serviceId } : {}),
          name: l.name,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['order-estimate', orderId] })
      void qc.invalidateQueries({ queryKey: ['order', orderId] })
    },
  })
}

export function useSetProjectNomenclature(projectId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (nomenclatureId: string | null) =>
      api.patch(`/workspace/projects/${projectId}`, { nomenclatureId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['projects'] }),
  })
}
