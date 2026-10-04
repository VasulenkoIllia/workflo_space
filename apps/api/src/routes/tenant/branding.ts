import type { FastifyPluginAsync } from 'fastify'
import { resolveTenantHost } from '../../saas/hostTenant.js'

/**
 * GET /tenant/branding — public host→tenant branding resolution for the white-label
 * frontends (SAAS_CONFIG.md / SAAS.md F5/E3). The portal/workspace bootstrap fetches
 * this BEFORE first paint and applies `branding.tokens` to `.wfp-root` (anti-FOUC),
 * so each agency's subdomain/custom-domain renders its own brand.
 *
 * Phase 0 (now): resolves the Host into a tenant hint and returns the DEFAULT brand —
 * the seam exists so enabling per-agency branding later (look up Agency by
 * subdomain/customDomain → accent/tokens/logo) is a handler change, not a frontend sweep.
 */
const DEFAULT_BRANDING = {
  name: 'Workflo',
  /** AccentKey preset for ThemeProvider. */
  accent: 'lime' as const,
  /** Logo URL (null → wordmark). */
  logoUrl: null as string | null,
  /** Raw --wf-* token overrides (neutrals/fonts). Empty = design defaults. */
  tokens: {} as Record<string, string>,
}

const tenantBrandingRoute: FastifyPluginAsync = (fastify) => {
  fastify.get(
    '/tenant/branding',
    { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const tenant = resolveTenantHost(request.headers.host)
      // Phase 1: if !tenant.isPlatform → load Agency by subdomain/customDomain and
      // return its accent + token overrides + logo. For now, the default brand.
      return reply
        .header('Cache-Control', 'public, max-age=60')
        .send({ success: true, data: { tenant, branding: DEFAULT_BRANDING } })
    }
  )

  return Promise.resolve()
}

export default tenantBrandingRoute
