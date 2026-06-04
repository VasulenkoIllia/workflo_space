import { Link } from 'react-router-dom'
import { AuthShell, AuthHeader, AuthStatus, Button } from '@workflo/ui'

// Full flow (default + sent + resend timer) lands in C2.
export function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeader title="Забули пароль?" sub="// введіть email — надішлемо посилання" />
      <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
        Відновлення пароля зʼявиться в наступному кроці.
      </div>
      <Link to="/login" style={{ display: 'block' }}>
        <Button variant="ghost" fullWidth>
          ← повернутися на вхід
        </Button>
      </Link>
      <AuthStatus />
    </AuthShell>
  )
}
