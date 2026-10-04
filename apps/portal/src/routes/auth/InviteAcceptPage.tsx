import { useMutation, useQuery } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { AuthShell, AuthHeader, AuthStatus, Button } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'

interface InvitePreview {
  type: 'executor' | 'company_member'
  status: 'pending' | 'used' | 'expired'
  inviterName: string | null
  companyName: string | null
  expiresAt: string
}

export function InviteAcceptPage() {
  const { token = '' } = useParams()
  const { user, reload } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const {
    data: invite,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<InvitePreview>(`/invite/${token}`),
    retry: false,
    enabled: token !== '',
    meta: { suppressGlobalToast: true }, // inline error UI handles failures here
  })

  const accept = useMutation({
    mutationFn: () => api.post(`/invite/${token}/accept`, {}),
    onSuccess: async () => {
      toast.success('Запрошення прийнято')
      try {
        await reload()
      } catch {
        /* accepted server-side; proceed even if the profile refetch hiccups */
      }
      navigate('/orders', { replace: true })
    },
  })

  function renderBody() {
    if (isLoading) return <div className="wfp-field-hint">// завантаження…</div>
    if (isError || !invite) {
      return <div className="wfp-field-hint wfp-field-hint--error">Запрошення не знайдено.</div>
    }
    if (invite.status !== 'pending') {
      return (
        <div className="wfp-field-hint wfp-field-hint--error">
          Запрошення {invite.status === 'used' ? 'вже використано' : 'застаріле'}. Попросіть
          надіслати нове.
        </div>
      )
    }
    if (!user) {
      return (
        <>
          <div className="wfp-field-hint">
            Увійдіть або зареєструйтесь під запрошеним email, щоб приєднатися.
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/login', { state: { from: location.pathname } })}
          >
            Увійти
          </Button>
          <Button variant="ghost" fullWidth onClick={() => navigate('/register')}>
            Зареєструватися
          </Button>
        </>
      )
    }
    return (
      <Button
        variant="primary"
        fullWidth
        loading={accept.isPending}
        onClick={() => accept.mutate()}
      >
        Прийняти запрошення
      </Button>
    )
  }

  return (
    <AuthShell>
      <AuthHeader
        title={invite?.companyName ? `Приєднатися до «${invite.companyName}»` : 'Запрошення'}
        sub={
          invite?.inviterName ? `// ${invite.inviterName} запрошує вас` : '// portal.workflo.space'
        }
      />
      {renderBody()}
      <AuthStatus />
    </AuthShell>
  )
}
