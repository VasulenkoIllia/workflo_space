import { useAuth } from '@/contexts/AuthContext'

/**
 * PORTAL-MEMBER: що може поточний користувач в активній компанії. Власник — усе; учасник —
 * за прапорцями, які вмикає власник (Учасники) або агенція (картка клієнта). Бекенд гейтить
 * те саме через `can()` — тут лише не показуємо кнопок/розділів, що впадуть 403.
 */
export function useCompanyAccess() {
  const { user } = useAuth()
  const company = user?.companies.find((c) => c.id === user.activeCompanyId) ?? user?.companies[0]
  const isOwner = company?.role === 'owner'
  const p = company?.permissions ?? {}
  const canViewBilling = isOwner || p.can_view_billing === true
  const canApprove = isOwner || p.can_approve_estimates === true
  return {
    company,
    isOwner,
    canViewBilling,
    canApprove,
    canInvite: isOwner || p.can_invite_members === true,
    /** Суми замовлень/кошторисів (бек маскує так само — clientSeesMoney). */
    seesMoney: canViewBilling || canApprove,
  }
}
