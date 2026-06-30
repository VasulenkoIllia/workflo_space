import { Outlet } from 'react-router-dom'
import { EmptyState } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Portal screens that need an active client company (billing / wallet / loyalty / referrals /
 * orders). When the signed-in account isn't linked to a company — e.g. an agency owner who
 * also opened the portal — those endpoints 400. Instead of a red error, show a soft empty
 * state (фінд.#4). A real client with a company but no data still passes through to the
 * page's own empty states.
 */
export function CompanyGate() {
  const { user } = useAuth()
  if (!user?.activeCompanyId) {
    return (
      <EmptyState
        glyph="// 🏢"
        title="Акаунт не привʼязаний до компанії"
        description="Ці розділи доступні клієнтам компанії. Якщо вас щойно запросили — прийміть запрошення з листа; або попросіть вашу агенцію привʼязати акаунт до компанії."
      />
    )
  }
  return <Outlet />
}
