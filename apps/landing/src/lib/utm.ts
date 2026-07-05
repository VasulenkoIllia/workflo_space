/** 26-UTM: first-touch attribution for contact→lead intake. Captured once per browser
 * tab (sessionStorage) on the first page that carries utm_* params — later client-side
 * navigation keeps it, later utm-less visits don't overwrite it. Sent along with both
 * contact forms so the CRM lead lands with its source attached. */

const KEY = 'wf-utm'
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const

export interface UtmPayload {
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmTerm?: string
  utmContent?: string
  page?: string
  referrer?: string
}

const clip = (v: string, max: number) => v.slice(0, max)

/** Read utm_* off the current URL and persist first-touch. Safe to call on every page. */
export function captureUtm(): void {
  try {
    if (sessionStorage.getItem(KEY) !== null) return
    const params = new URLSearchParams(window.location.search)
    const hasUtm = UTM_KEYS.some((k) => (params.get(k) ?? '').trim() !== '')
    const referrer = document.referrer.trim()
    if (!hasUtm && referrer === '') return
    const payload: UtmPayload = {
      page: clip(window.location.pathname, 300),
      ...(referrer !== '' ? { referrer: clip(referrer, 500) } : {}),
    }
    const map: Record<(typeof UTM_KEYS)[number], keyof UtmPayload> = {
      utm_source: 'utmSource',
      utm_medium: 'utmMedium',
      utm_campaign: 'utmCampaign',
      utm_term: 'utmTerm',
      utm_content: 'utmContent',
    }
    for (const k of UTM_KEYS) {
      const v = (params.get(k) ?? '').trim()
      if (v !== '') payload[map[k]] = clip(v, 120)
    }
    sessionStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // sessionStorage unavailable (privacy mode) — attribution is best-effort
  }
}

/** Attribution captured for this tab, {} when none. Spread into the contact POST body. */
export function getUtm(): UtmPayload {
  try {
    const raw = sessionStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as UtmPayload) : {}
  } catch {
    return {}
  }
}
