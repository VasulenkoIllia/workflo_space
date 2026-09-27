import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  PERMISSIONS,
  PERMISSION_ROLES,
  clampLevel,
  resolvePermissions,
  type PermissionKey,
  type PermissionLevel,
  type PermissionRole,
} from '@workflo/types'
import { Card, EmptyState, Skeleton } from '@workflo/ui'
import { Select } from '@/components/Select'
import {
  LEVEL_LABEL,
  ROLE_LABEL,
  useSetMemberPermission,
  usePermissionsAdmin,
  useSetRolePermission,
  type PermissionsState,
} from '@/lib/permissions'

/**
 * PERM-6 (design-v2 workspace-admin.jsx «Permissions»): матриця ролей (менеджер · тімлід ·
 * виконавець) + персональні права людини. Власник — завжди все (не редагується). Дефолти
 * каталогу — @workflo/types; тут лише відхилення (зміна → рядок, «↺» — повернути дефолт).
 * Керує лише власник агенції (бек теж — owner-only).
 */

const selectStyle = {
  height: 30,
  padding: '0 6px',
  background: 'var(--wf-bg)',
  color: 'var(--wf-fg)',
  border: '1px solid var(--wf-border)',
  borderRadius: 6,
  font: 'inherit',
  fontSize: 12,
  maxWidth: 130,
} as const

const LEVEL_TONE: Record<PermissionLevel, string> = {
  none: 'var(--wf-fg-subtle)',
  own: 'var(--wf-fg-secondary)',
  team: 'var(--wf-warning)',
  all: 'var(--wf-accent)',
}

const AREAS = [...new Set(PERMISSIONS.map((p) => p.area))]

function roleMatrix(state: PermissionsState | undefined) {
  const out = {} as Record<PermissionRole, Record<string, PermissionLevel>>
  for (const r of PERMISSION_ROLES) out[r] = {}
  for (const o of state?.roleOverrides ?? []) out[o.role][o.permission] = o.level
  return out
}

export function PermissionsTab() {
  const { data, isLoading, isError } = usePermissionsAdmin()
  const [view, setView] = useState<'roles' | 'people'>('roles')

  if (isLoading) return <Skeleton style={{ height: 320 }} />
  if (isError || !data) {
    return (
      <EmptyState
        glyph="// 403"
        title="Права доступу налаштовує власник"
        description="Матрицю ролей і персональні права змінює лише власник агенції."
      />
    )
  }

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div
        style={{
          padding: '12px 16px',
          border: '1px solid color-mix(in oklab, var(--wf-accent) 24%, var(--wf-border))',
          background: 'color-mix(in oklab, var(--wf-accent) 5%, transparent)',
          borderRadius: 8,
          fontSize: 12.5,
          color: 'var(--wf-fg-secondary)',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: 'var(--wf-fg)' }}>Як працює:</strong> власник має всі права завжди.
        Для ролей діють дефолти (менеджер — без фінансів; тімлід — свій підрозділ; виконавець — своя
        робота). Змінюйте рядки матриці для всієї ролі або дайте/заберіть право конкретній людині.{' '}
        <span className="wfp-mono" style={{ fontSize: 11 }}>
          своє = лише призначене · підрозділ = підрозділ тімліда · усе = вся агенція
        </span>
      </div>

      <div className="wff-seg" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'roles'}
          className="wff-seg-opt"
          data-on={view === 'roles' || undefined}
          onClick={() => setView('roles')}
        >
          Ролі
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'people'}
          className="wff-seg-opt"
          data-on={view === 'people' || undefined}
          onClick={() => setView('people')}
        >
          Люди
        </button>
      </div>

      {view === 'roles' ? <RoleMatrix state={data} /> : <PeoplePermissions state={data} />}
    </div>
  )
}

function RoleMatrix({ state }: { state: PermissionsState }) {
  const set = useSetRolePermission()
  const overrides = useMemo(() => roleMatrix(state), [state])

  const change = (role: PermissionRole, key: PermissionKey, def: PermissionLevel, v: string) => {
    const level = v as PermissionLevel
    set.mutate(
      { role, permission: key, level: level === def ? null : level },
      { onSuccess: () => toast.success(`${ROLE_LABEL[role]}: право оновлено`) }
    )
  }

  return (
    <div
      style={{
        border: '1px solid var(--wf-border)',
        borderRadius: 8,
        overflowX: 'auto',
        background: 'var(--wf-bg)',
      }}
    >
      <table className="wfp-perm-table" style={{ minWidth: 680 }}>
        <thead>
          <tr>
            <th style={{ width: '40%' }}>Право</th>
            <th style={{ color: 'var(--wf-accent)' }}>Власник</th>
            {PERMISSION_ROLES.map((r) => (
              <th key={r}>{ROLE_LABEL[r]}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {AREAS.map((area) => (
            <FragmentArea key={area} area={area}>
              {PERMISSIONS.filter((p) => p.area === area).map((p) => (
                <tr key={p.key}>
                  <td>
                    <div>{p.label}</div>
                    {'hint' in p && p.hint ? (
                      <div
                        className="wfp-mono"
                        style={{ fontSize: 10, color: 'var(--wf-fg-subtle)' }}
                      >
                        {p.hint}
                      </div>
                    ) : null}
                  </td>
                  <td>
                    <span className="wfp-mono" style={{ fontSize: 11, color: LEVEL_TONE.all }}>
                      усе
                    </span>
                  </td>
                  {PERMISSION_ROLES.map((r) => {
                    const def = p.defaults[r]
                    const cur = overrides[r][p.key] ?? def
                    const changed = overrides[r][p.key] != null && overrides[r][p.key] !== def
                    return (
                      <td key={r}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <select
                            aria-label={`${ROLE_LABEL[r]}: ${p.label}`}
                            value={cur}
                            disabled={set.isPending}
                            onChange={(e) => change(r, p.key, def, e.target.value)}
                            style={{
                              ...selectStyle,
                              color: LEVEL_TONE[cur],
                              borderColor: changed ? 'var(--wf-accent)' : 'var(--wf-border)',
                            }}
                          >
                            {p.levels.map((l) => (
                              <option key={l} value={l}>
                                {LEVEL_LABEL[l]}
                              </option>
                            ))}
                          </select>
                          {changed && (
                            <button
                              type="button"
                              className="wfp-link"
                              title={`Повернути дефолт: ${LEVEL_LABEL[def]}`}
                              onClick={() => change(r, p.key, def, def)}
                              style={{ fontSize: 12 }}
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </FragmentArea>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function FragmentArea({ area, children }: { area: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td className="wfp-perm-area" colSpan={5}>
          // {area}
        </td>
      </tr>
      {children}
    </>
  )
}

function PeoplePermissions({ state }: { state: PermissionsState }) {
  const set = useSetMemberPermission()
  const people = state.members.filter((m) => m.role !== 'owner')
  const [pid, setPid] = useState(people[0]?.profileId ?? '')
  const person = people.find((m) => m.profileId === pid)

  if (people.length === 0) {
    return (
      <EmptyState
        title="Поки нема кого налаштовувати"
        description="Запросіть менеджерів і виконавців — тут можна буде видати або забрати окремі права."
      />
    )
  }

  // Ефективні права ролі цієї людини (матриця агенції) — база для «як у ролі»
  const roleBase = person
    ? resolvePermissions({
        agencyRole: person.role,
        isLead: person.isLead,
        roleRows: state.roleOverrides,
        memberRows: [],
      })
    : null
  const personal = new Map(person?.overrides.map((o) => [o.permission, o.level]) ?? [])
  const roleName = person
    ? person.role === 'manager'
      ? 'менеджер'
      : person.isLead
        ? 'тімлід'
        : 'виконавець'
    : ''

  return (
    <Card title="Персональні права" aux={person ? `роль: ${roleName}` : undefined}>
      <div style={{ maxWidth: 360, marginBottom: 14 }}>
        <Select
          label="Людина"
          value={pid}
          onChange={setPid}
          options={people.map((m) => ({
            value: m.profileId,
            label: `${m.name} · ${m.role === 'manager' ? 'менеджер' : m.isLead ? 'тімлід' : 'виконавець'}`,
          }))}
        />
      </div>
      {person && roleBase && (
        <table className="wfp-perm-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th style={{ width: '50%' }}>Право</th>
              <th>Як у ролі</th>
              <th>Персонально</th>
            </tr>
          </thead>
          <tbody>
            {AREAS.map((area) => (
              <FragmentArea key={area} area={area}>
                {PERMISSIONS.filter((p) => p.area === area).map((p) => {
                  const own = personal.get(p.key)
                  const base = roleBase[p.key]
                  return (
                    <tr key={p.key}>
                      <td>{p.label}</td>
                      <td>
                        <span
                          className="wfp-mono"
                          style={{ fontSize: 11, color: LEVEL_TONE[base] }}
                        >
                          {LEVEL_LABEL[base]}
                        </span>
                      </td>
                      <td>
                        <select
                          aria-label={`${person.name}: ${p.label}`}
                          value={own ?? ''}
                          disabled={set.isPending}
                          onChange={(e) =>
                            set.mutate(
                              {
                                profileId: person.profileId,
                                permission: p.key,
                                level:
                                  e.target.value === ''
                                    ? null
                                    : clampLevel(p.key, e.target.value as PermissionLevel),
                              },
                              { onSuccess: () => toast.success('Персональне право оновлено') }
                            )
                          }
                          style={{
                            ...selectStyle,
                            color: own ? LEVEL_TONE[own] : 'var(--wf-fg-muted)',
                            borderColor: own ? 'var(--wf-accent)' : 'var(--wf-border)',
                          }}
                        >
                          <option value="">як у ролі</option>
                          {p.levels.map((l) => (
                            <option key={l} value={l}>
                              {LEVEL_LABEL[l]}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </FragmentArea>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  )
}
