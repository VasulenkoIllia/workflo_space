import type { Meta, StoryObj } from '@storybook/react'
import { Avatar, AvatarStack } from './Avatar.js'

const meta = {
  title: 'Components/Avatar',
  component: Avatar,
  tags: ['autodocs'],
  args: { name: 'Олена Іваненко' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Avatar>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Avatar name="Олена Іваненко" size={22} />
      <Avatar name="Ілля Василенко" size={28} />
      <Avatar name="Олег Петров" size={40} />
    </div>
  ),
}

/** Accent highlights via `style` (e.g. assignee colours) — tokens only. */
export const Colored: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12 }}>
      <Avatar name="Ілля" style={{ background: 'var(--wf-warning)', color: '#fff' }} />
      <Avatar
        name="Марія"
        style={{ background: 'var(--wf-accent-bg)', color: 'var(--wf-on-accent)' }}
      />
      <Avatar name="Олег" />
    </div>
  ),
}

export const Stack: Story = {
  render: () => (
    <AvatarStack>
      <Avatar name="Ілля" style={{ background: 'var(--wf-warning)', color: '#fff' }} />
      <Avatar name="Олег" />
      <Avatar
        name="Марія"
        style={{ background: 'var(--wf-accent-bg)', color: 'var(--wf-on-accent)' }}
      />
      <Avatar initials="+3" />
    </AvatarStack>
  ),
}
