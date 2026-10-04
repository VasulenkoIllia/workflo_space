/**
 * SaaS host → tenant resolution seam (SAAS.md F5 / ADR-007). Phase 0 stub: parses
 * the request Host into a candidate agency subdomain (or custom domain) so per-domain
 * white-label routing / branding can hook in later WITHOUT a sweep. NOT wired into
 * routing yet — laid now so the shape exists.
 *
 * Deploy step (infra, not code): a Traefik wildcard router
 *   Host(`{sub:[a-z0-9-]+}.${BASE_DOMAIN}`)
 * so `<agency>.workflo.space` reaches the app. See INFRASTRUCTURE.md.
 */

export function getBaseDomain(): string {
  return process.env.BASE_DOMAIN ?? 'workflo.space'
}

export interface ResolvedTenantHost {
  /** Platform host (the bare domain or a reserved subdomain) — no agency tenant. */
  isPlatform: boolean
  /** Candidate agency subdomain, e.g. `acme` from `acme.workflo.space`. */
  subdomain?: string
  /** A host that isn't under BASE_DOMAIN → resolve via Agency.customDomain (Phase 1). */
  customDomain?: string
}

const RESERVED_SUBDOMAINS = new Set(['', 'www', 'api', 'portal', 'work', 'mail', 'admin'])

/** Resolve a request Host header into a tenant hint. Pure; safe on undefined. */
export function resolveTenantHost(host: string | undefined): ResolvedTenantHost {
  if (!host) return { isPlatform: true }
  const hostname = (host.split(':')[0] ?? '').toLowerCase().trim()
  const base = getBaseDomain().toLowerCase()

  if (hostname === base) return { isPlatform: true }

  if (hostname.endsWith(`.${base}`)) {
    const sub = hostname.slice(0, -(base.length + 1))
    if (RESERVED_SUBDOMAINS.has(sub) || sub.includes('.')) return { isPlatform: true }
    return { isPlatform: false, subdomain: sub }
  }

  // Not under BASE_DOMAIN → a custom domain (Phase 1: look up Agency.customDomain).
  return { isPlatform: false, customDomain: hostname }
}
