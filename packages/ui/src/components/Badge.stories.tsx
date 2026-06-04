import type { Meta, StoryObj } from '@storybook/react'
import { Badge } from './Badge.js'

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'paid', tone: 'success' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['default', 'success', 'warning', 'danger', 'muted'],
    },
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Badge>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Tones: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge tone="default">draft</Badge>
      <Badge tone="success">paid</Badge>
      <Badge tone="warning">partial</Badge>
      <Badge tone="danger">unpaid</Badge>
      <Badge tone="muted">archived</Badge>
    </div>
  ),
}
