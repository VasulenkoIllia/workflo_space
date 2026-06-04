import { Link } from 'react-router-dom'
import { AuthShell, AuthHeader, AuthStatus, Button } from '@workflo/ui'

// Full flow (token + strength meter + confirm) lands in C2.
export function ResetPasswordPage() {
  return (
    <AuthShell>
      <AuthHeader title="Новий пароль" sub="// встановіть новий пароль" />
      <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
        Скидання пароля зʼявиться в наступному кроці.
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
