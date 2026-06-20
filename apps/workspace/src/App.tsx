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
import { ProfilePage } from '@/routes/profile/ProfilePage'
import { Placeholder } from '@/routes/Placeholder'
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<Placeholder title="Налаштування" />} />

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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
