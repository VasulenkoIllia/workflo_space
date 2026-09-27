// DSN-4: анкета клієнта при створенні замовлення (портал /orders/new) — спільні тип і
// підписи для порталу (форма + деталь) і workspace (картка «Заявка клієнта»).
import { BillingType, ContactChannel, OrderCategory } from '@workflo/types'

/** Те, що API віддає в `order.intake` (GET /orders/:id, POST /orders). */
export interface OrderIntake {
  category: OrderCategory | null
  clientBudget: number | null
  /** null = «обговорити» */
  preferredBilling: BillingType | null
  deadlineFlexible: boolean
  preferredChannel: ContactChannel | null
}

export const ORDER_CATEGORY_LABEL: Record<OrderCategory, string> = {
  [OrderCategory.WEB]: 'Web-додаток',
  [OrderCategory.INTEGRATION]: 'Інтеграція / автоматизація',
  [OrderCategory.BOT]: 'Бот · Telegram / WhatsApp',
  [OrderCategory.AI]: 'AI-агент / ML',
  [OrderCategory.DATA]: 'Парсинг / data scraping',
  [OrderCategory.CRM]: 'CRM / 1С налаштування',
  [OrderCategory.OTHER]: 'Інше',
}

export const CONTACT_CHANNEL_LABEL: Record<ContactChannel, string> = {
  [ContactChannel.SYSTEM]: 'У системі',
  [ContactChannel.TELEGRAM]: 'Telegram',
  [ContactChannel.EMAIL]: 'Email',
  [ContactChannel.PHONE]: 'Телефон',
}

/** Побажання клієнта щодо моделі ціни; null = «обговорити». */
export function preferredBillingLabel(b: BillingType | null): string {
  if (b === BillingType.FIXED) return 'Fixed-price'
  if (b === BillingType.HOURLY) return 'Hourly · t&m'
  return 'Обговорити'
}

/** Чи клієнт узагалі заповнив анкету (legacy/workspace-замовлення — порожня). */
export function hasIntake(i: OrderIntake | null | undefined): i is OrderIntake {
  if (!i) return false
  return (
    i.category != null ||
    i.clientBudget != null ||
    i.preferredBilling != null ||
    i.deadlineFlexible ||
    i.preferredChannel != null
  )
}
