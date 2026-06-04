import type { Meta, StoryObj } from '@storybook/react'
import { StatusDot, type StatusTone } from './StatusDot.js'

const meta = {
  title: 'Components/StatusDot',
  component: StatusDot,
  tags: ['autodocs'],
  args: { tone: 'accent' },
  argTypes: {
    tone: {
      control: 'inline-radio',
      options: ['accent', 'success', 'warning', 'danger', 'muted', 'neutral'],
    },
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusDot>

export default meta
type Story = StoryObj<typeof meta>

export const Playground: Story = {}

export const Tones: Story = {
  render: () => {
    const tones: StatusTone[] = ['accent', 'success', 'warning', 'danger', 'muted', 'neutral']
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
        {tones.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <StatusDot tone={t} />
            <span className="wfp-mono">{t}</span>
          </span>
        ))}
      </div>
    )
  },
}
