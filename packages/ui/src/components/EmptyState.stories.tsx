import type { Meta, StoryObj } from '@storybook/react'
import { EmptyState } from './EmptyState.js'
import { Button } from './Button.js'

const meta = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: { title: 'Замовлень немає', description: '// тут зʼявляться ваші замовлення' },
} satisfies Meta<typeof EmptyState>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const WithAction: Story = {
  args: {
    glyph: '¯\\_(ツ)_/¯',
    title: 'Поки порожньо',
    description: 'Створіть перше замовлення, щоб почати.',
    action: (
      <Button variant="primary" style={{ marginTop: 6 }}>
        Нове замовлення
      </Button>
    ),
  },
}
