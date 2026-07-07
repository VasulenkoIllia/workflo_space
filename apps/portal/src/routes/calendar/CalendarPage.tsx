import { Button, Card, EmptyState, Skeleton } from '@workflo/ui'
import { toast } from 'sonner'
import { useMyMeetings, useRespondMeeting, type PortalMeeting } from '@/lib/calendar'
import { useAuth } from '@/contexts/AuthContext'

const RESP_LABEL: Record<string, string> = {
  pending: 'очікує відповіді',
  accepted: 'прийнято',
  declined: 'відхилено',
}

export function CalendarPage() {
  const { data: meetings, isLoading } = useMyMeetings()

  return (
    <div>
      <div style={{ fontSize: 28, fontWeight: 600 }}>Зустрічі</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 18 }}
      >
        // заплановані зустрічі з командою
      </div>
      {isLoading ? (
        <Skeleton style={{ height: 160 }} />
      ) : (meetings ?? []).length === 0 ? (
        <EmptyState
          title="Зустрічей немає"
          description="Команда запросить вас — зустрічі зʼявляться тут."
        />
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {(meetings ?? []).map((m) => (
            <MeetingCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function MeetingCard({ m }: { m: PortalMeeting }) {
  const respond = useRespondMeeting()
  const { user } = useAuth()
  const mine = m.attendees.find((a) => a.profileId === user?.profile.id)
  return (
    <Card
      title={m.title}
      aux={new Date(m.startsAt).toLocaleString('uk-UA', { timeZone: m.timezone })}
    >
      <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          {new Date(m.startsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}{' '}
          – {new Date(m.endsAt).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}{' '}
          · {m.timezone}
        </div>
        {m.location && (
          <div>
            <span style={{ color: 'var(--wf-fg-secondary)' }}>Локація: </span>
            {m.location}
          </div>
        )}
        {m.meetingUrl && (
          <div>
            <a href={m.meetingUrl} target="_blank" rel="noreferrer" className="wfp-link">
              Приєднатися до дзвінка →
            </a>
          </div>
        )}
        {m.description && <div style={{ whiteSpace: 'pre-wrap' }}>{m.description}</div>}
        {mine && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 4,
            }}
          >
            <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              ваша відповідь: {RESP_LABEL[mine.response]}
            </span>
            {mine.response !== 'accepted' && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={respond.isPending}
                  onClick={() =>
                    respond.mutate(
                      { id: m.id, response: 'declined' },
                      { onSuccess: () => toast.success('Відхилено') }
                    )
                  }
                >
                  Відхилити
                </Button>
                <Button
                  size="sm"
                  variant="primary"
                  loading={respond.isPending}
                  onClick={() =>
                    respond.mutate(
                      { id: m.id, response: 'accepted' },
                      { onSuccess: () => toast.success('Прийнято') }
                    )
                  }
                >
                  Прийняти
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
