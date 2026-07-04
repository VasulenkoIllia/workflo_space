import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Slim reminder for accounts that have not confirmed their email (S9).
 * Login is not blocked — this only nudges, with a one-click resend.
 */
export function EmailVerifyBanner() {
  const { user } = useAuth()
  const resend = useMutation({
    mutationFn: () => api.post<{ sent: true }>('/auth/resend-verification', {}),
    onSuccess: () => toast.success('Лист надіслано — перевірте пошту'),
  })

  if (!user || user.profile.emailVerified !== false) return null

  return (
    <div
      className="wfp-mono"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '8px 14px',
        fontSize: 12,
        borderBottom: '1px solid var(--wf-border)',
        background: 'color-mix(in oklab, var(--wf-accent) 8%, transparent)',
      }}
    >
      <span>
        // підтвердьте email <b>{user.profile.email}</b> — ми надіслали посилання при реєстрації
      </span>
      <button
        type="button"
        className="wfp-link"
        style={{ fontSize: 12 }}
        disabled={resend.isPending}
        onClick={() => resend.mutate()}
      >
        {resend.isPending ? 'надсилаємо…' : 'надіслати ще раз →'}
      </button>
    </div>
  )
}
