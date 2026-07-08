import type { ExpenseCategory } from '@/lib/finance'

/** Single source of truth for expense-category display (label + donut/chart color). Shared by the
 * dashboard donut, the /finance screen, and any future category breakdown. */
export const EXPENSE_CAT: Record<ExpenseCategory, { label: string; color: string }> = {
  infrastructure: { label: 'Інфраструктура', color: '#22D3EE' },
  software: { label: 'ПЗ / підписки', color: '#A78BFA' },
  salary: { label: 'Зарплата', color: '#C5F82A' },
  contractor: { label: 'Підрядники', color: '#FB923C' },
  rent: { label: 'Оренда', color: '#F472B6' },
  tax: { label: 'Податки', color: '#F87171' },
  marketing: { label: 'Маркетинг', color: '#38BDF8' },
  other: { label: 'Інше', color: '#94A3B8' },
}

// Синтетичні P&L-статті (не користувацькі expense-категорії): собівартість погодинної праці.
const PNL_SYNTHETIC: Record<string, { label: string; color: string }> = {
  labor_hourly: { label: 'Погодинна праця', color: '#FBBF24' },
}

export function catLabel(c: string): string {
  return EXPENSE_CAT[c as ExpenseCategory]?.label ?? PNL_SYNTHETIC[c]?.label ?? c
}
export function catColor(c: string): string {
  return EXPENSE_CAT[c as ExpenseCategory]?.color ?? PNL_SYNTHETIC[c]?.color ?? '#94A3B8'
}
