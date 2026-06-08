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

/**
 * Executor invite acceptance for the workspace. Accept requires an authenticated
 * session whose email matches the invite (enforced server-side).
 *
 * NB: a brand-new executor without an account can't self-register here yet — the
 * register flow creates an owner+company, which is wrong for an executor. Inviting
 * users who already have an account is the supported path; standalone executor
 * onboarding (register → profile only) is a later auth-sprint item.
 */
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
      navigate('/', { replace: true })
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
    if (invite.type !== 'executor') {
      // A company_member invite would create a CompanyMember (not an AgencyMember)
      // and leave the user gated out of the workspace — reject it here, not silently.
      return (
        <div className="wfp-field-hint wfp-field-hint--error">
          Це запрошення для клієнтського порталу, не для кабінету команди.
        </div>
      )
    }
    if (!user) {
      return (
        <>
          <div className="wfp-field-hint">
            Увійдіть під запрошеним email, щоб приєднатися до команди.
          </div>
          <Button
            variant="primary"
            fullWidth
            onClick={() => navigate('/login', { state: { from: location.pathname } })}
          >
            Увійти
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
        Приєднатися до команди
      </Button>
    )
  }

  return (
    <AuthShell>
      <AuthHeader
        title={
          invite?.companyName ? `Приєднатися до «${invite.companyName}»` : 'Запрошення в команду'
        }
        sub={
          invite?.inviterName ? `// ${invite.inviterName} запрошує вас` : '// work.workflo.space'
        }
      />
      {renderBody()}
      <AuthStatus />
    </AuthShell>
  )
}
