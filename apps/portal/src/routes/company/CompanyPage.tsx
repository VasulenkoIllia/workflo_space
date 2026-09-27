import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Card, Skeleton } from '@workflo/ui'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { RequisitesSection } from './RequisitesSection'

/**
 * COV-PRT-1 + DEDUP C10: «Моя компанія» — дім компанії: профіль + реквізити (форма —
 * власнику) + учасники (керування правами — на «Учасники»).
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
  // PORTAL-MEMBER: юр-дані (IBAN, ЄДРПОУ) — лише власнику компанії
  const isOwner = company?.role === 'owner'
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

      {/* DEDUP C10: форма реквізитів — тут (власник); учаснику — пояснення */}
      {isOwner ? (
        <RequisitesSection />
      ) : (
        <Card title="Реквізити" style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--wf-fg-secondary)' }}>
            Реквізити компанії бачить і змінює власник компанії.
          </div>
        </Card>
      )}

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
