import type { Meta, StoryObj } from '@storybook/react'
import { Skeleton } from './Skeleton.js'

const meta = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Skeleton>

export default meta
type Story = StoryObj<typeof meta>

export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
      <Skeleton variant="title" style={{ width: '60%' }} />
      <Skeleton variant="line" />
      <Skeleton variant="line" style={{ width: '80%' }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Skeleton variant="circle" style={{ width: 32, height: 32 }} />
        <Skeleton variant="chip" />
        <Skeleton variant="btn" />
      </div>
    </div>
  ),
}

/** Compose primitives into a row placeholder. */
export const RowPlaceholder: Story = {
  render: () => (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        padding: 14,
        border: '1px solid var(--wf-border)',
        borderRadius: 10,
        width: 360,
      }}
    >
      <Skeleton variant="circle" style={{ width: 32, height: 32 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Skeleton variant="line" style={{ width: '70%' }} />
        <Skeleton variant="line" style={{ width: '40%' }} />
      </div>
    </div>
  ),
}
