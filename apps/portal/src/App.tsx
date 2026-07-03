import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/routes/auth/LoginPage'
import { RegisterPage } from '@/routes/auth/RegisterPage'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { CompanyGate } from '@/components/CompanyGate'
import { AppLayout } from '@/layouts/AppLayout'
import { OrdersPage } from '@/routes/orders/OrdersPage'
import { OrderDetailPage } from '@/routes/orders/OrderDetailPage'
import { InviteAcceptPage } from '@/routes/auth/InviteAcceptPage'
import { VerifyEmailPage } from '@/routes/auth/VerifyEmailPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'
import { TeamPage } from '@/routes/team/TeamPage'
import { BillingPage } from '@/routes/billing/BillingPage'
import { WalletPage } from '@/routes/wallet/WalletPage'
import { LoyaltyPage } from '@/routes/loyalty/LoyaltyPage'
import { ReferralsPage } from '@/routes/referrals/ReferralsPage'
import { OrderCreatePage } from '@/routes/orders/OrderCreatePage'
import { InboxPage } from '@/routes/inbox/InboxPage'
import { ProjectsPage } from '@/routes/projects/ProjectsPage'
import { Placeholder } from '@/routes/Placeholder'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/invite/:token" element={<InviteAcceptPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {/* Company-scoped screens — gated so a no-company account gets a soft empty state
            (фінд.#4) instead of a 400. */}
        <Route element={<CompanyGate />}>
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/new" element={<OrderCreatePage />} />
          <Route path="/orders/:id" element={<OrderDetailPage />} />
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/referrals" element={<ReferralsPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
        </Route>
        <Route path="/documents" element={<Placeholder title="Документи" />} />
        <Route path="/support" element={<Placeholder title="Підтримка" />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        {/* design-v2 PORTAL_NAV destinations — Placeholder until their feature wave */}
        <Route path="/company" element={<Placeholder title="Моя компанія" />} />
        <Route path="/secrets" element={<Placeholder title="Секрети" />} />
        <Route path="/settings/integrations" element={<Placeholder title="Інтеграції" />} />
        <Route path="/" element={<Navigate to="/orders" replace />} />
      </Route>

      <Route path="*" element={<Navigate to="/orders" replace />} />
    </Routes>
  )
}
