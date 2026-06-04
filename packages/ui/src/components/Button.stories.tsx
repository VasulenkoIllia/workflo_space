import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button.js'

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
)
const ArrowIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const meta = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          'Дія-кнопка дизайн-системи. Рендерить родину `.wfp-btn`; під термінальною естетикою (предок `.wfp-aesA`) автоматично обгортається в `[ … ]`. Колір — лише з токенів `--wf-*`. Перемикай Theme / Accent / Aesthetic у тулбарі.',
      },
    },
  },
  args: {
    children: 'Зберегти',
    variant: 'secondary',
    size: 'md',
    loading: false,
    fullWidth: false,
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['primary', 'secondary', 'ghost', 'danger'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    loading: { control: 'boolean' },
    fullWidth: { control: 'boolean' },
    leftIcon: { control: false },
    rightIcon: { control: false },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

/** Interactive — drive every prop from the Controls panel. */
export const Playground: Story = {}

export const Primary: Story = { args: { variant: 'primary', children: 'Створити замовлення' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Скасувати' } }
export const Ghost: Story = { args: { variant: 'ghost', children: 'Деталі' } }
export const Danger: Story = { args: { variant: 'danger', children: 'Видалити' } }

/** All variants side by side. */
export const Variants: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Button {...args} variant="primary">
        Primary
      </Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
      <Button {...args} variant="danger">
        Danger
      </Button>
    </div>
  ),
}

/** Three sizes. */
export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args} size="sm">
        Small
      </Button>
      <Button {...args} size="md">
        Medium
      </Button>
    </div>
  ),
  args: { variant: 'primary' },
}

/** Loading and disabled states. */
export const States: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args}>Default</Button>
      <Button {...args} loading>
        Завантаження…
      </Button>
      <Button {...args} disabled>
        Disabled
      </Button>
    </div>
  ),
  args: { variant: 'primary' },
}

/** With leading / trailing icons. */
export const WithIcons: Story = {
  render: (args) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args} variant="primary" leftIcon={<PlusIcon />}>
        Нове замовлення
      </Button>
      <Button {...args} variant="secondary" rightIcon={<ArrowIcon />}>
        Далі
      </Button>
    </div>
  ),
}

/** Stretches to the container width. */
export const FullWidth: Story = {
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <Button {...args} variant="primary" fullWidth>
        Увійти
      </Button>
    </div>
  ),
}
