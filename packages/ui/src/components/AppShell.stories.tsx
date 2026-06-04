import type { Meta, StoryObj } from '@storybook/react'
import { AppShell } from './AppShell.js'
import { Sidebar, type SidebarNavEntry } from './Sidebar.js'
import { Topbar } from './Topbar.js'
import { Icon } from './Icon.js'
import { Card } from './Card.js'
import { Badge } from './Badge.js'
import { Button } from './Button.js'

const NAV: SidebarNavEntry[] = [
  {
    id: 'inbox',
    label: 'Інбокс',
    icon: <Icon name="inbox" />,
    badge: '5',
    badgeAccent: true,
    href: '/inbox',
  },
  { id: 'orders', label: 'Замовлення', icon: <Icon name="list" />, badge: '2', href: '/orders' },
  { id: 'billing', label: 'Фінанси', icon: <Icon name="receipt" />, href: '/billing' },
  { id: 'wallet', label: 'Гаманець', icon: <Icon name="coins" />, href: '/wallet' },
  {
    id: 'documents',
    label: 'Документи',
    icon: <Icon name="file" />,
    badge: '12',
    href: '/documents',
  },
  { group: 'Команда' },
  { id: 'team', label: 'Учасники', icon: <Icon name="users" />, badge: '4', href: '/team' },
  { id: 'settings', label: 'Налаштування', icon: <Icon name="settings" />, href: '/settings' },
]

const footer = (
  <div className="wfp-sb-foot">
    <div className="wfp-sb-company">
      <div className="wfp-sb-company-avatar">Ф</div>
      <div className="wfp-sb-company-meta">
        <div className="wfp-sb-company-name">ТОВ «Брунки»</div>
        <div className="wfp-sb-company-role">
          <span>owner</span>
          <span>·</span>
          <span className="wfp-sb-company-role-tier">regular</span>
        </div>
      </div>
      <span className="wfp-sb-company-chev">
        <Icon name="chevron" size={14} />
      </span>
    </div>
  </div>
)

const meta = {
  title: 'Shell/AppShell',
  component: AppShell,
  parameters: { layout: 'fullscreen' },
  args: { sidebar: null, children: null },
} satisfies Meta<typeof AppShell>

export default meta
type Story = StoryObj<typeof meta>

function Demo(args: { aesthetic: 'A' | 'B'; density: 'comfortable' | 'compact' }) {
  return (
    <div style={{ height: '100vh' }}>
      <AppShell
        kind="portal"
        aesthetic={args.aesthetic}
        density={args.density}
        windowTitle="portal.workflo.space — bash · 1440×900"
        statusBarRight={<span>/orders · 14:32</span>}
        sidebar={
          <Sidebar
            nav={NAV}
            active="orders"
            aesthetic={args.aesthetic}
            sub="portal"
            footer={footer}
          />
        }
        topbar={
          <Topbar
            crumbs={['Кабінет', 'Замовлення']}
            avatar="ІВ"
            onSearch={() => {}}
            onBell={() => {}}
            bellDot
            actions={
              <Button variant="primary" size="sm" leftIcon={<Icon name="plus" size={14} />}>
                Нове
              </Button>
            }
          />
        }
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 18,
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 600 }}>Замовлення</div>
            <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
              // 3 активних · 2 потребують дії
            </div>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <Card title="Активні" aux="3">
            <span className="wfp-mono" style={{ fontSize: 24, fontWeight: 600 }}>
              3
            </span>
          </Card>
          <Card title="До оплати" aux="$1 550">
            <Badge tone="warning">очікує</Badge>
          </Card>
          <Card title="Готово" aux="2">
            <Badge tone="success">paid</Badge>
          </Card>
        </div>
      </AppShell>
    </div>
  )
}

/** Terminal aesthetic (A) — macOS window chrome with `[ ]` brackets on CTAs. */
export const Terminal: Story = { render: () => <Demo aesthetic="A" density="comfortable" /> }

/** Studio aesthetic (B) — clean, no chrome. */
export const Studio: Story = { render: () => <Demo aesthetic="B" density="comfortable" /> }
