import { Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from '@/routes/auth/LoginPage'
import { ForgotPasswordPage } from '@/routes/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/routes/auth/ResetPasswordPage'
import { InviteAcceptPage } from '@/routes/auth/InviteAcceptPage'
import { ProtectedRoute, RoleRoute } from '@/components/ProtectedRoute'
import { AppLayout } from '@/layouts/AppLayout'
import { TeamPage } from '@/routes/team/TeamPage'
import { DashboardPage } from '@/routes/dashboard/DashboardPage'
import { OwnerDashboard } from '@/routes/dashboard/OwnerDashboard'
import { OrdersPage } from '@/routes/orders/OrdersPage'
import { OrderDetailPage } from '@/routes/orders/OrderDetailPage'
import { ClientsPage } from '@/routes/clients/ClientsPage'
import { ClientDetailPage } from '@/routes/clients/ClientDetailPage'
import { InboxPage } from '@/routes/inbox/InboxPage'
import { ProfilePage } from '@/routes/profile/ProfilePage'
import { BillingPage } from '@/routes/billing/BillingPage'
import { ProjectsPage } from '@/routes/projects/ProjectsPage'
import { ProjectDetailPage } from '@/routes/projects/ProjectDetailPage'
import { FinancePage } from '@/routes/finance/FinancePage'
import { MarginPage } from '@/routes/margin/MarginPage'
import { ReportsPage } from '@/routes/reports/ReportsPage'
import { PayoutsPage } from '@/routes/payouts/PayoutsPage'
import { ServicesPage } from '@/routes/services/ServicesPage'
import { AdminWalletPage } from '@/routes/adminWallet/AdminWalletPage'
import { SettingsPage } from '@/routes/settings/SettingsPage'
import { useAuth } from '@/contexts/AuthContext'

/** Home is role-aware: owner/manager → operational overview, executor → personal task board. */
function Home() {
  const { isOwner, isManager } = useAuth()
  return isOwner || isManager ? <OwnerDashboard /> : <DashboardPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="/" element={<Home />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/inbox" element={<InboxPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route
          path="/settings"
          element={
            <RoleRoute allow={['owner']}>
              <SettingsPage />
            </RoleRoute>
          }
        />

        {/* Owner-only */}
        <Route
          path="/orders"
          element={
            <RoleRoute allow={['owner', 'manager']}>
              <OrdersPage />
            </RoleRoute>
          }
        />
        <Route
          path="/clients"
          element={
            <RoleRoute allow={['owner', 'manager']}>
              <ClientsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/clients/:id"
          element={
            <RoleRoute allow={['owner', 'manager']}>
              <ClientDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/team"
          element={
            <RoleRoute allow={['owner', 'manager']}>
              <TeamPage />
            </RoleRoute>
          }
        />
        {/* Finance — owner-only (manager is finance-blocked, MOD-4). */}
        <Route
          path="/billing"
          element={
            <RoleRoute allow={['owner']}>
              <BillingPage />
            </RoleRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <RoleRoute allow={['owner']}>
              <ProjectsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <RoleRoute allow={['owner']}>
              <ProjectDetailPage />
            </RoleRoute>
          }
        />
        <Route
          path="/finance"
          element={
            <RoleRoute allow={['owner']}>
              <FinancePage />
            </RoleRoute>
          }
        />
        <Route
          path="/margin"
          element={
            <RoleRoute allow={['owner']}>
              <MarginPage />
            </RoleRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <RoleRoute allow={['owner']}>
              <ReportsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/payouts"
          element={
            <RoleRoute allow={['owner']}>
              <PayoutsPage />
            </RoleRoute>
          }
        />
        <Route
          path="/services"
          element={
            <RoleRoute allow={['owner']}>
              <ServicesPage />
            </RoleRoute>
          }
        />
        <Route
          path="/admin-wallet"
          element={
            <RoleRoute allow={['owner']}>
              <AdminWalletPage />
            </RoleRoute>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
