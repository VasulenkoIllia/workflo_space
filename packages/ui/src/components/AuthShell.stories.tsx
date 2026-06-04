import type { Meta, StoryObj } from '@storybook/react'
import { AuthShell, AuthHeader, AuthStatus } from './AuthShell.js'
import { Input } from './Input.js'
import { Button } from './Button.js'

const meta = {
  title: 'Shell/AuthShell',
  component: AuthShell,
  parameters: { layout: 'fullscreen' },
  args: { children: null },
} satisfies Meta<typeof AuthShell>

export default meta
type Story = StoryObj<typeof meta>

/** Login card composed from AuthShell + AuthHeader + Input + Button + AuthStatus. */
export const Login: Story = {
  render: () => (
    <div style={{ height: '100vh' }}>
      <AuthShell>
        <AuthHeader title="Вхід у кабінет" sub="// portal.workflo.space" />
        <Input label="Email" defaultValue="olena@brunky.ua" />
        <Input label="Пароль" type="password" defaultValue="secret1234" hint="забули пароль?" />
        <Button variant="primary" fullWidth>
          Увійти
        </Button>
        <div className="wfp-auth-foot">
          немає акаунту?{' '}
          <a href="#" style={{ color: 'var(--wf-accent)' }}>
            зареєструватися →
          </a>
        </div>
        <AuthStatus right="$ v0.1.0 · invite-free" />
      </AuthShell>
    </div>
  ),
}
