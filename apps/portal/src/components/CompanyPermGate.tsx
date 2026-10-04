import { Outlet } from 'react-router-dom'
import { EmptyState } from '@workflo/ui'
import { useCompanyAccess } from '@/lib/companyAccess'

/**
 * PORTAL-MEMBER: фінансові розділи (рахунки, гаманець, бонуси, проєкти) — власнику компанії
 * або учаснику з правом «Бачить фінанси». Без права — пояснення замість червоної 403.
 */
export function BillingGate() {
  const { canViewBilling } = useCompanyAccess()
  if (!canViewBilling) {
    return (
      <EmptyState
        glyph="// 403"
        title="Фінанси компанії вам не відкриті"
        description="Рахунки, оплати, гаманець і бонуси бачить власник компанії та учасники з правом «Бачить фінанси». Попросіть власника увімкнути його в розділі «Учасники»."
      />
    )
  }
  return <Outlet />
}
