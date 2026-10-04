import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/** 24 Calendar (портал) — зустрічі, куди клієнта запросили; accept/decline. */
export interface PortalMeeting {
  id: string
  title: string
  description: string | null
  type: 'internal_meeting' | 'client_meeting'
  startsAt: string
  endsAt: string
  timezone: string
  location: string | null
  meetingUrl: string | null
  createdById: string
  company: { id: string; name: string } | null
  attendees: {
    profileId: string
    response: 'pending' | 'accepted' | 'declined'
    profile: { id: string; name: string }
  }[]
}

export function useMyMeetings() {
  const from = new Date().toISOString()
  const to = new Date(Date.now() + 90 * 86_400_000).toISOString()
  return useQuery({
    queryKey: ['calendar', 'my-meetings'],
    queryFn: () =>
      api
        .get<{
          events: PortalMeeting[]
        }>(`/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
        .then((r) => r.events),
  })
}

export function useRespondMeeting() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, response }: { id: string; response: 'accepted' | 'declined' }) =>
      api.post(`/calendar/events/${id}/respond`, { response }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['calendar', 'my-meetings'] }),
  })
}
