import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/routes/auth/LoginPage'
import { RegisterPage } from '@/routes/auth/RegisterPage'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { OrdersPage } from '@/routes/orders/OrdersPage'
import { OrderDetailPage } from '@/routes/orders/OrderDetailPage'
import { InviteAcceptPage } from '@/routes/auth/InviteAcceptPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'
import { TeamPage } from '@/routes/team/TeamPage'
import { BillingPage } from '@/routes/billing/BillingPage'
import { WalletPage } from '@/routes/wallet/WalletPage'
import { LoyaltyPage } from '@/routes/loyalty/LoyaltyPage'
import { Placeholder } from '@/routes/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/new" element={<Placeholder title="Нове замовлення" />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/documents" element={<Placeholder title="Документи" />} />
        <Route path="/loyalty" element={<LoyaltyPage />} />
        <Route path="/referrals" element={<Placeholder title="Реферали" />} />
        <Route path="/team" element={<TeamPage />} />
        <Route path="/support" element={<Placeholder title="Підтримка" />} />
        <Route path="/settings" element={<SettingsPage />} />
        {/* design-v2 PORTAL_NAV destinations — Placeholder until their feature wave */}
        <Route path="/inbox" element={<Placeholder title="Інбокс" />} />
        <Route path="/projects" element={<Placeholder title="Проєкти" />} />
        <Route path="/company" element={<Placeholder title="Моя компанія" />} />
        <Route path="/secrets" element={<Placeholder title="Секрети" />} />
        <Route path="/settings/integrations" element={<Placeholder title="Інтеграції" />} />
        <Route path="/" element={<Navigate to="/orders" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}
