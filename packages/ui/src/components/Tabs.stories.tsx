import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { Tabs } from './Tabs.js'

const meta = {
  title: 'Components/Tabs',
  component: Tabs,
  tags: ['autodocs'],
  args: { items: [], value: '', onChange: () => {} },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Tabs>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    const [tab, setTab] = useState('chat')
    return (
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { id: 'chat', label: 'Чат', badge: 5 },
          { id: 'files', label: 'Файли', badge: 2 },
          { id: 'docs', label: 'Документи', badge: 1 },
        ]}
        right={<span style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>Activity →</span>}
      />
    )
  },
}
