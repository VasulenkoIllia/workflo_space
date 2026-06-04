import type { Meta, StoryObj } from '@storybook/react'
import { Input } from './Input.js'

const meta = {
  title: 'Components/Input',
  component: Input,
  tags: ['autodocs'],
  args: { label: 'Email', placeholder: 'olena@brunky.ua' },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}
export const WithHint: Story = { args: { hint: 'Цей email буде вашим логіном' } }
export const Password: Story = {
  args: { label: 'Пароль', type: 'password', defaultValue: 'secret1234' },
}
export const Error: Story = {
  args: { error: 'Невірний email або пароль. Залишилось 3 спроби.', defaultValue: 'olena@' },
}
export const Stacked: Story = {
  render: (args) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <Input {...args} label="Ім'я" placeholder="Олена" />
      <Input {...args} label="Email" hint="буде логіном" />
      <Input {...args} label="Пароль" type="password" error="мінімум 12 символів" />
    </div>
  ),
}
