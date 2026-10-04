import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './api.js'

/**
 * ANNOUNCEMENTS (07-В), R5 (аудит r6): читацька сторона оголошень — спільна для
 * workspace і portal (банер був byte-identical у двох апках — AR-42 drift).
 * Owner-адмінка (CRUD/статистика) лишається у workspace/lib/announcements.ts.
 */
export interface ActiveAnnouncement {
  id: string
  title: string
  body: string
  createdAt: string
}

export function useActiveAnnouncements() {
  return useQuery({
    queryKey: ['announcements-active'],
    queryFn: () =>
      api
        .get<{ announcements: ActiveAnnouncement[] }>('/announcements/active')
        .then((r) => r.announcements),
    staleTime: 60_000,
  })
}

export function useReadAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post(`/announcements/${id}/read`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['announcements-active'] }),
  })
}

/**
 * Sticky-банер активних оголошень (моя аудиторія, непрочитані).
 * ✕ = read-receipt → банер зникає для цього юзера, owner бачить % прочитань в адмінці.
 */
export function AnnouncementBanner() {
  const { data: items = [] } = useActiveAnnouncements()
  const read = useReadAnnouncement()
  const a = items[0]
  if (!a) return null

  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 10,
        padding: '8px 14px',
        marginBottom: 14,
        border: '1px solid var(--wf-accent)',
        borderRadius: 'var(--wf-radius)',
        background: 'color-mix(in srgb, var(--wf-accent) 8%, transparent)',
      }}
    >
      <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-accent)', flexShrink: 0 }}>
        // оголошення
      </span>
      <span style={{ fontSize: 13, minWidth: 0 }}>
        <strong>{a.title}</strong>
        {' — '}
        {a.body}
      </span>
      <button
        type="button"
        onClick={() => read.mutate(a.id)}
        title="Прочитано"
        style={{
          marginLeft: 'auto',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--wf-fg-muted)',
          fontSize: 14,
          flexShrink: 0,
        }}
      >
        ✕
      </button>
    </div>
  )
}
