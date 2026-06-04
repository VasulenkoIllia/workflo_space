import { Link } from 'react-router-dom'
import { AuthShell, AuthHeader, AuthStatus, Button } from '@workflo/ui'

// Full 2-step wizard lands in C2.
export function RegisterPage() {
  return (
    <AuthShell>
      <AuthHeader title="Створіть акаунт" sub="// 60 секунд · 0 ₴" />
      <div style={{ fontSize: 13, color: 'var(--wf-fg-muted)' }}>
        Реєстрація зʼявиться в наступному кроці.
      </div>
      <Link to="/login" style={{ display: 'block' }}>
        <Button variant="ghost" fullWidth>
          ← повернутися на вхід
        </Button>
      </Link>
      <AuthStatus left="реєстрація відкрита" />
    </AuthShell>
  )
}
