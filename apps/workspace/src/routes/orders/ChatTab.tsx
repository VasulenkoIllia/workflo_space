import { toast } from 'sonner'
import { OrderChat } from '@workflo/app-core'
import { useAuth } from '@/contexts/AuthContext'
import { useConversationState, useSetChatOwner, useSetConversationState } from '@/lib/chats'
import { useUploadFile } from '@/lib/orderDetail'
import { useTeam } from '@/lib/payouts'

/**
 * Internal-team chat (03-чат). Thin wrapper over the shared <OrderChat> — the team
 * view enables every capability (owner can edit/delete anyone). The live SSE stream
 * (useCommentStream) is mounted at the page level, not here.
 *
 * 18-хвости: controls bar above the chat — 🔕 mute (per-user; @mention пробиває) and
 * «відповідальний за тред» (18-В; «авто» = перший assignee).
 */
export function ChatTab({ orderId }: { orderId: string }) {
  const { user, isOwner } = useAuth()
  const upload = useUploadFile(orderId)
  const { data: conv } = useConversationState(orderId)
  const setState = useSetConversationState(orderId)
  const setChatOwner = useSetChatOwner(orderId)
  const { data: teamData } = useTeam()
  const members = teamData?.members ?? []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          justifyContent: 'flex-end',
          marginBottom: 8,
          flexWrap: 'wrap',
        }}
      >
        <label
          className="wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-muted)', display: 'flex', gap: 6 }}
        >
          відповідальний:
          <select
            style={{
              background: 'var(--wf-surface)',
              color: 'var(--wf-fg)',
              border: '1px solid var(--wf-border)',
              borderRadius: 'var(--wf-radius)',
              fontSize: 11,
              padding: '2px 6px',
            }}
            value={conv?.chatOwnerId ?? ''}
            disabled={setChatOwner.isPending}
            onChange={(e) => {
              const v = e.target.value
              setChatOwner.mutate(v === '' ? null : v, {
                onSuccess: () => toast.success('Відповідального оновлено'),
              })
            }}
          >
            <option value="">авто (перший виконавець)</option>
            {members.map((m) => (
              <option key={m.profileId} value={m.profileId}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="wfp-link"
          style={{
            fontSize: 12,
            color: conv?.muted ? 'var(--wf-warning, #b45309)' : undefined,
          }}
          title={
            conv?.muted
              ? 'Розмову заглушено — сповіщення про нові повідомлення вимкнені (@згадки приходять)'
              : 'Заглушити сповіщення цієї розмови (@згадки все одно прийдуть)'
          }
          onClick={() =>
            setState.mutate(
              { muted: !(conv?.muted ?? false) },
              {
                onSuccess: () =>
                  toast.success(conv?.muted ? 'Сповіщення увімкнено' : 'Розмову заглушено'),
              }
            )
          }
        >
          {conv?.muted ? '🔕 заглушено' : '🔔 сповіщення'}
        </button>
      </div>

      <OrderChat
        orderId={orderId}
        currentUserId={user?.profile.id ?? ''}
        capabilities={{
          canPin: true,
          canFilterInternal: true,
          canPostInternal: true,
          canEditAnyone: isOwner,
        }}
        upload={upload}
      />
    </div>
  )
}
