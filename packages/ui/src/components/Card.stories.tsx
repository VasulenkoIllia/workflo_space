import type { Meta, StoryObj } from '@storybook/react'
import { Card } from './Card.js'
import { Badge } from './Badge.js'

const meta = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
  args: { title: 'Фінанси', aux: 'ORD-2412', style: { width: 320 } },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Card>

export default meta
type Story = StoryObj<typeof meta>

export const WithHeader: Story = {
  render: (args) => (
    <Card {...args}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
        <span>Оцінка</span>
        <span className="wfp-mono">$4 200</span>
      </div>
    </Card>
  ),
}

export const WithActions: Story = {
  args: { title: 'Документи', actions: <Badge tone="muted">12</Badge> },
  render: (args) => (
    <Card {...args}>
      <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Список документів…</div>
    </Card>
  ),
}

export const Plain: Story = {
  args: { title: undefined, aux: undefined },
  render: (args) => <Card {...args}>Картка без заголовка.</Card>,
}
