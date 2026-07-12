import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * 24 Calendar (workspace) — зустрічі + агрегований view (події+дедлайни замовлень).
 * timezone IANA per-event; рендер у tz події. Створює команда, запрошені accept/decline.
 */
export interface CalendarAttendeeDto {
  profileId: string
  response: 'pending' | 'accepted' | 'declined'
  respondedAt: string | null
  profile: { id: string; name: string }
}
export interface CalendarEventDto {
  id: string
  title: string
  description: string | null
  type: 'internal_meeting' | 'client_meeting'
  startsAt: string
  endsAt: string
  timezone: string
  location: string | null
  meetingUrl: string | null
  companyId: string | null
  createdById: string
  cancelledAt: string | null
  company: { id: string; name: string } | null
  attendees: CalendarAttendeeDto[]
}
export interface CalendarViewItem {
  kind: 'meeting' | 'deadline'
  id: string
  title: string
  at: string
  type?: string
  companyName?: string | null
  orderId?: string
}

export function useCalendarView(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', 'view', from, to],
    queryFn: () =>
      api
        .get<{
          items: CalendarViewItem[]
        }>(`/calendar/view?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then((r) => r.items),
  })
}

/** S13-05 (хвіст): погоджена відсутність команди у вікні календаря. */
export interface CalendarLeaveDto {
  id: string
  type: 'vacation' | 'sick' | 'dayoff' | 'unpaid'
  startDate: string
  endDate: string
  days: number
  profile: { id: string; name: string }
}

export function useCalendarEvents(from: string, to: string) {
  return useQuery({
    queryKey: ['calendar', 'events', from, to],
    queryFn: () =>
      api.get<{ events: CalendarEventDto[]; leaves: CalendarLeaveDto[] }>(
        `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
  })
}

export interface CreateEventInput {
  title: string
  description?: string
  type: 'internal_meeting' | 'client_meeting'
  startsAt: string
  endsAt: string
  timezone?: string
  location?: string
  meetingUrl?: string
  companyId?: string | null
  attendeeIds: string[]
}

export function useCreateEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateEventInput) => api.post<{ id: string }>('/calendar/events', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useCancelEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/calendar/events/${id}/cancel`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}

export function useRespondEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'accepted' | 'declined' }) =>
      api.post(`/calendar/events/${id}/respond`, { response }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar'] }),
  })
}
