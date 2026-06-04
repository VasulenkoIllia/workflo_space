import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/routes/auth/LoginPage'
import { RegisterPage } from '@/routes/auth/RegisterPage'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { OrdersPage } from '@/routes/orders/OrdersPage'
import { Placeholder } from '@/routes/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/billing" element={<Placeholder title="Фінанси" />} />
        <Route path="/wallet" element={<Placeholder title="Гаманець" />} />
        <Route path="/documents" element={<Placeholder title="Документи" />} />
        <Route path="/loyalty" element={<Placeholder title="Лояльність" />} />
        <Route path="/referrals" element={<Placeholder title="Реферали" />} />
        <Route path="/team" element={<Placeholder title="Учасники" />} />
        <Route path="/support" element={<Placeholder title="Підтримка" />} />
        <Route path="/settings" element={<Placeholder title="Налаштування" />} />
        <Route path="/" element={<Navigate to="/orders" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}
