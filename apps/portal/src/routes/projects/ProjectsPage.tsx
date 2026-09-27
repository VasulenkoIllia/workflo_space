import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Icon, Modal, Skeleton, StatusDot, type StatusTone } from '@workflo/ui'
import { ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { type ClientProject, usePortalProjectEstimate, usePortalProjects } from '@/lib/projects'

// DSN-5 (design-v2 portal-client-p1.jsx PortalServiceProjects): KPI-ряд + картки-проєкти +
// модалка деталей + hours-bar поточного циклу. Дані — реальні умови проєкту (billing terms);
// «що входить» = позиції кошторису проєкту. Опису/юр-особи в клієнтському DTO свідомо нема.

const MODEL_META: Record<
  ClientProject['billingModel'],
  { label: string; tone: StatusTone; hint: string }
> = {
  fixed_monthly_advance: { label: 'Абонплата', tone: 'accent', hint: 'фікс/міс + пул годин' },
  hourly_prepaid: { label: 'Погодинно · аванс', tone: 'neutral', hint: 'передоплата годин' },
  hourly_postpaid: { label: 'Погодинно · факт', tone: 'neutral', hint: 'оплата за фактом' },
}
const CYCLE_LABEL: Record<ClientProject['billingCycle'], string> = {
  monthly_day_n: 'щомісяця',
  weekly_day_x: 'щотижня',
  manual: 'вручну',
}

const money = (v: string | number | null, cur: string) =>
  v == null ? '—' : `${Number(v).toLocaleString('uk-UA')} ${cur}`

function price(p: ClientProject): { big: string; small: string } {
  if (p.billingModel === 'fixed_monthly_advance') {
    return {
      big: money(p.abonAmount, p.currency),
      small: p.billingCycle === 'weekly_day_x' ? 'на тиждень' : 'на місяць',
    }
  }
  return { big: money(p.clientHourlyRate, p.currency), small: 'за годину' }
}

/** Дата продовження = кінець ПОТОЧНОГО циклу (API вже котить протухлий якір уперед);
 * null — ручний цикл без якоря. */
const renewal = (p: ClientProject): string | null => (p.nextCycleAt ? p.cycle.to : null)

/** % використання пулу годин (null — пулу нема). */
function poolPct(p: ClientProject): number | null {
  const cap = p.includedHoursCap ? Number(p.includedHoursCap) : null
  if (!cap) return null
  return Math.round((p.cycle.hoursUsed / cap) * 100)
}

export function ProjectsPage() {
  const { data, isLoading, isError, error } = usePortalProjects()
  const [open, setOpen] = useState<ClientProject | null>(null)
  const projects = data?.projects ?? []
  const active = projects.filter((p) => p.active)
  const forbidden = error instanceof ApiError && error.status === 403

  // KPI: абонплата по валютах (проєкти можуть бути в різних валютах — не сумуємо різне)
  const retainerByCur = new Map<string, number>()
  for (const p of active) {
    if (p.billingModel === 'fixed_monthly_advance' && p.abonAmount) {
      retainerByCur.set(p.currency, (retainerByCur.get(p.currency) ?? 0) + Number(p.abonAmount))
    }
  }
  const retainer = [...retainerByCur.entries()].map(([c, v]) => money(v, c)).join(' + ') || '—'
  const pooled = active.filter((p) => p.includedHoursCap)
  const hoursUsed = pooled.reduce((a, p) => a + p.cycle.hoursUsed, 0)
  const hoursCap = pooled.reduce((a, p) => a + Number(p.includedHoursCap), 0)
  const next = active
    .filter((p) => renewal(p))
    .sort((a, b) => (renewal(a) ?? '').localeCompare(renewal(b) ?? ''))[0]

  return (
    <div>
      <div className="wfp-ph">
        <div className="wfp-ph-l">
          <h1 className="wfp-ph-h1">Проєкти</h1>
          <div className="wfp-ph-sub">
            // сервісні контракти й проєкти · натисніть картку для деталей
          </div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton style={{ height: 240 }} />
      ) : forbidden ? (
        <EmptyState
          glyph="// 403"
          title="Умови проєктів бачить власник компанії"
          description="Фінансові умови співпраці доступні власнику компанії або учаснику з доступом до білінгу."
        />
      ) : isError ? (
        <EmptyState
          glyph="// помилка"
          title="Не вдалося завантажити проєкти"
          description="Оновіть сторінку. Якщо повториться — напишіть у підтримку."
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="Проєктів ще немає"
          description="Коли агенція налаштує фінансовий проєкт для вашої компанії, він зʼявиться тут."
        />
      ) : (
        <>
          <div className="wfp-stats">
            <Stat k="активні проєкти" v={String(active.length)} sub="абонплата · погодинно" />
            <Stat k="абонплата за цикл" v={retainer} sub="з пулом годин" accent />
            <Stat
              k="годин цього циклу"
              v={hoursCap > 0 ? `${round(hoursUsed)} / ${round(hoursCap)}` : '—'}
              sub={
                hoursCap > 0
                  ? `лишилось ${round(Math.max(hoursCap - hoursUsed, 0))}`
                  : 'пулу годин нема'
              }
            />
            <Stat
              k="наступне продовження"
              v={next ? formatDate(renewal(next)) : '—'}
              sub={next ? next.name : 'цикл вручну'}
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 12,
              marginTop: 8,
            }}
          >
            {projects.map((p) => (
              <ProjectCard key={p.id} p={p} onOpen={() => setOpen(p)} />
            ))}
          </div>

          <div
            style={{
              marginTop: 16,
              fontSize: 12,
              color: 'var(--wf-fg-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
            }}
          >
            <Icon name="receipt" size={13} />
            Рахунки, борг та оплати — у розділі{' '}
            <Link to="/billing" className="wfp-link">
              «Рахунки й борг»
            </Link>
            .
          </div>
        </>
      )}

      {open && <ProjectDetailModal p={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

const round = (n: number) => Math.round(n * 10) / 10

function Stat({ k, v, sub, accent }: { k: string; v: string; sub: string; accent?: boolean }) {
  return (
    <div className="wfp-stat">
      <span className="wfp-stat-k">{k}</span>
      <span className={`wfp-stat-v${accent ? ' wfp-stat-v--accent' : ''}`}>{v}</span>
      <span className="wfp-stat-sub">{sub}</span>
    </div>
  )
}

function HoursBar({ p, height }: { p: ClientProject; height: number }) {
  const pct = poolPct(p)
  if (pct == null) return null
  return (
    <div
      style={{
        height,
        borderRadius: height / 2,
        background: 'var(--wf-border)',
        overflow: 'hidden',
      }}
      role="progressbar"
      aria-valuenow={Math.min(pct, 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          background: pct > 85 ? 'var(--wf-warning)' : 'var(--wf-accent)',
        }}
      />
    </div>
  )
}

function ProjectCard({ p, onOpen }: { p: ClientProject; onOpen: () => void }) {
  const meta = MODEL_META[p.billingModel]
  const pr = price(p)
  const pct = poolPct(p)
  return (
    <button
      type="button"
      className="wfsp-card"
      onClick={onOpen}
      style={{ opacity: p.active ? 1 : 0.6 }}
    >
      <div className="wfsp-card-top">
        <span className="wfp-order-status">
          <StatusDot tone={meta.tone} /> {meta.label}
        </span>
        <Icon name="chevronRight" size={13} />
      </div>
      <div className="wfsp-card-name">{p.name}</div>
      <div className="wfp-mono wfsp-card-code">
        {p.type ? `${p.type} · ` : ''}
        {p.active ? `цикл ${CYCLE_LABEL[p.billingCycle]}` : 'неактивний'}
      </div>
      <div className="wfsp-card-price">
        <span className="wfsp-card-price-v">{pr.big}</span>
        <span className="wfsp-card-price-s">{pr.small}</span>
      </div>
      {pct != null ? (
        <div className="wfsp-card-foot">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 11,
              color: 'var(--wf-fg-muted)',
              marginBottom: 4,
            }}
          >
            <span>години цього циклу</span>
            <span className="wfp-mono">
              {round(p.cycle.hoursUsed)}/{Number(p.includedHoursCap)}
            </span>
          </div>
          <HoursBar p={p} height={5} />
        </div>
      ) : (
        <div
          className="wfsp-card-foot wfp-mono"
          style={{ fontSize: 11, color: 'var(--wf-fg-subtle)' }}
        >
          {p.billingModel === 'fixed_monthly_advance'
            ? 'фіксована сума за цикл'
            : `${meta.hint} · ${round(p.cycle.hoursUsed)} год за цикл`}
        </div>
      )}
    </button>
  )
}

function ProjectDetailModal({ p, onClose }: { p: ClientProject; onClose: () => void }) {
  const navigate = useNavigate()
  const meta = MODEL_META[p.billingModel]
  const pr = price(p)
  const pct = poolPct(p)
  const estimate = usePortalProjectEstimate(p.id)
  const cap = p.includedHoursCap ? Number(p.includedHoursCap) : null
  const KV = ({ k, v }: { k: string; v: string }) => (
    <div className="wfsp-kv">
      <span className="wfsp-kv-k">{k}</span>
      <span className="wfsp-kv-v">{v}</span>
    </div>
  )
  return (
    <Modal
      open
      onClose={onClose}
      title={p.name}
      aux={p.type ?? undefined}
      footer={
        <Button
          variant="primary"
          leftIcon={<Icon name="receipt" size={13} />}
          onClick={() => {
            onClose()
            navigate('/billing')
          }}
        >
          Рахунки й оплати
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span className="wfp-order-status">
            <StatusDot tone={meta.tone} /> {meta.label}
          </span>
          <span className="wfp-order-status">
            <StatusDot tone={p.active ? 'success' : 'muted'} />{' '}
            {p.active ? 'активний' : 'неактивний'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
            padding: '14px 0',
            borderTop: '1px solid var(--wf-border)',
            borderBottom: '1px solid var(--wf-border)',
          }}
        >
          <span className="wfp-mono" style={{ fontSize: 28, fontWeight: 700 }}>
            {pr.big}
          </span>
          <span style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>{pr.small}</span>
        </div>

        {pct != null && cap != null && (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--wf-fg-muted)',
                marginBottom: 6,
                gap: 12,
              }}
            >
              <span>години цього циклу</span>
              <span className="wfp-mono">
                {round(p.cycle.hoursUsed)} / {cap} год · лишилось{' '}
                {round(Math.max(cap - p.cycle.hoursUsed, 0))}
              </span>
            </div>
            <HoursBar p={p} height={7} />
            {pct > 100 && (
              <div className="wfp-field-hint" style={{ marginTop: 6, color: 'var(--wf-warning)' }}>
                понад пул — додаткові години за ставкою {money(p.clientHourlyRate, p.currency)}/год
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '0 18px',
          }}
        >
          <KV k="модель" v={meta.label} />
          <KV k="цикл" v={CYCLE_LABEL[p.billingCycle]} />
          <KV k="початок" v={formatDate(p.createdAt)} />
          <KV k="продовження" v={renewal(p) ? formatDate(renewal(p)) : 'без строку'} />
          <KV k="поточний цикл" v={`${formatDate(p.cycle.from)} – ${formatDate(p.cycle.to)}`} />
          {cap != null && <KV k="пул годин" v={`${cap} год / цикл`} />}
          {p.clientHourlyRate && (
            <KV k="ставка" v={`${money(p.clientHourlyRate, p.currency)}/год`} />
          )}
          {p.paymentTermsDays != null && (
            <KV k="оплата" v={`${p.paymentTermsDays} дн. після рахунку`} />
          )}
        </div>

        <div>
          <div
            className="wfp-mono"
            style={{
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: 'var(--wf-fg-muted)',
              marginBottom: 9,
            }}
          >
            що входить
          </div>
          {estimate.isLoading ? (
            <Skeleton style={{ height: 60 }} />
          ) : (estimate.data?.lines.length ?? 0) === 0 ? (
            <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-subtle)' }}>
              // позиції ще не деталізовані — уточніть у менеджера
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {estimate.data?.lines.map((l) => (
                <div
                  key={l.id}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13 }}
                >
                  <span
                    style={{ color: 'var(--wf-success)', marginTop: 2, display: 'inline-flex' }}
                  >
                    <Icon name="check" size={13} />
                  </span>
                  <span style={{ flex: 1 }}>{l.name}</span>
                  <span
                    className="wfp-mono"
                    style={{ fontSize: 11.5, color: 'var(--wf-fg-muted)' }}
                  >
                    {Number(l.hours)} год
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
