import type { DocumentRenderData } from '@workflo/templates'

/**
 * 06-А: шаблони документів з {{змінними}} (рішення власника 06.07). Секції договору
 * та примітки/призначення решти типів редагуються власником; підстановка — тут.
 * Невідомий токен лишається як є — чесно видно в PDF, що ключ не розпізнано.
 */

export const TEMPLATE_VARIABLES: { key: string; label: string }[] = [
  { key: 'client', label: 'Назва клієнта (компанія)' },
  { key: 'client_legal', label: 'Юридична назва клієнта' },
  { key: 'agency', label: 'Назва агенції / юр-особи' },
  { key: 'order', label: 'Назва замовлення' },
  { key: 'project', label: 'Назва проєкту' },
  { key: 'amount', label: 'Сума з валютою' },
  { key: 'number', label: 'Номер документа' },
  { key: 'date', label: 'Дата документа' },
  { key: 'contract', label: 'Підстава (Договір № … від …)' },
]

export function substituteVars(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (token, key: string) => vars[key] ?? token)
}

/** Мапа підстановок із уже зібраних даних рендера. */
export function varsFromRenderData(d: DocumentRenderData): Record<string, string> {
  return {
    client: d.recipient.name,
    client_legal: d.recipient.legalName ?? d.recipient.name,
    agency: d.issuer.legalName ?? d.issuer.name,
    order: d.orderTitle,
    project: d.projectName ?? '—',
    amount: `${d.amount} ${d.currency}`,
    number: d.number,
    date: d.date,
    contract: d.contractRef ?? '—',
  }
}

export interface ContractTemplateBody {
  sections: { h: string; p: string[] }[]
}
export interface NoteTemplateBody {
  note?: string
  purpose?: string
}

/**
 * Накладає шаблон агенції на дані рендера (мутує data). contract → секції;
 * інші типи → customNote (+ purpose для рахунків).
 */
export function applyTemplate(data: DocumentRenderData, type: string, body: unknown): void {
  const vars = varsFromRenderData(data)
  if (type === 'contract') {
    const sections = (body as ContractTemplateBody | null)?.sections
    if (Array.isArray(sections) && sections.length > 0) {
      data.contractSections = sections.map((s) => ({
        h: substituteVars(String(s.h ?? ''), vars),
        p: (Array.isArray(s.p) ? s.p : []).map((p) => substituteVars(String(p ?? ''), vars)),
      }))
    }
    return
  }
  const b = body as NoteTemplateBody | null
  if (b?.note) data.customNote = substituteVars(b.note, vars)
  if (b?.purpose && (type === 'invoice' || type === 'advance_invoice')) {
    data.paymentPurpose = substituteVars(b.purpose, vars)
  }
}
