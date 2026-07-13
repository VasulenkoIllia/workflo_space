import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Skeleton, StatusDot } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useRequisites } from '@/lib/requisites'

/**
 * COV-PRT-1: «Моя компанія» — реальна оглядова сторінка замість Placeholder.
 * Read-only зведення: профіль компанії + реквізити (редагування — у Налаштуваннях)
 * + учасники (керування — на «Учасники»). Нових ендпоінтів не потребує.
 */
interface CompanyMember {
  profileId: string
  name: string
  email: string
  role: 'owner' | 'member'
  joinedAt: string
}

const ROLE_LABEL: Record<string, string> = { owner: 'власник', member: 'учасник' }

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="wfp-side-row">
      <div className="wfp-side-k">{k}</div>
      <div className="wfp-side-v">{v || '—'}</div>
    </div>
  )
}

export function CompanyPage() {
  const { user } = useAuth()
  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const { data: reqData, isLoading: reqLoading } = useRequisites()
  const req = reqData?.requisites
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['portal-company-members'],
    queryFn: () => api.get<{ members: CompanyMember[] }>('/portal/company/members'),
  })
  const members = membersData?.members ?? []

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 4 }}>Моя компанія</div>
      <div
        className="wfp-mono"
        style={{ fontSize: 11, color: 'var(--wf-fg-muted)', marginBottom: 24 }}
      >
        // профіль, реквізити й команда вашої компанії
      </div>

      <Card title="Профіль" style={{ marginBottom: 16 }}>
        <div className="wfp-side">
          <Row k="назва" v={company?.name} />
          <Row k="ваша роль" v={company ? ROLE_LABEL[company.role] : undefined} />
        </div>
      </Card>

      <Card title="Реквізити" style={{ marginBottom: 16 }}>
        {reqLoading ? (
          <Skeleton style={{ height: 120 }} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <StatusDot tone={req?.legalIsComplete ? 'success' : 'warning'} />
              <span style={{ fontSize: 13 }}>
                {req?.legalIsComplete
                  ? 'Реквізити заповнені — документи формуються коректно'
                  : 'Реквізити неповні — заповніть для коректних документів'}
              </span>
            </div>
            <div className="wfp-side">
              <Row k="юр. назва" v={req?.legalName} />
              <Row k="ЄДРПОУ/ІПН" v={req?.taxId} />
              <Row k="адреса" v={req?.legalAddress} />
              <Row k="IBAN" v={req?.iban} />
              <Row k="email для документів" v={req?.documentEmail} />
            </div>
            <div style={{ marginTop: 12 }}>
              <Link to="/settings">
                <Button size="sm" variant="secondary">
                  Редагувати в Налаштуваннях →
                </Button>
              </Link>
            </div>
          </>
        )}
      </Card>

      <Card title={`Учасники · ${members.length}`}>
        {membersLoading ? (
          <Skeleton style={{ height: 80 }} />
        ) : (
          <>
            {members.map((m) => (
              <div
                key={m.profileId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: '1px solid var(--wf-border)',
                  fontSize: 13,
                }}
              >
                <Avatar name={m.name} size={26} />
                <span style={{ flex: 1 }}>{m.name}</span>
                <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
                  {ROLE_LABEL[m.role]}
                </span>
              </div>
            ))}
            <div style={{ marginTop: 12 }}>
              <Link to="/team">
                <Button size="sm" variant="secondary">
                  Керувати учасниками →
                </Button>
              </Link>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
