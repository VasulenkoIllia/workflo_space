import { afterEach, describe, expect, it } from 'vitest'
import { resolveTenantHost } from '../src/saas/hostTenant.js'

describe('resolveTenantHost (SaaS F5 stub)', () => {
  afterEach(() => {
    delete process.env.BASE_DOMAIN
  })

  it('bare base domain → platform', () => {
    expect(resolveTenantHost('workflo.space')).toEqual({ isPlatform: true })
  })

  it('reserved subdomains → platform', () => {
    for (const h of ['www.workflo.space', 'api.workflo.space', 'work.workflo.space']) {
      expect(resolveTenantHost(h).isPlatform).toBe(true)
    }
  })

  it('agency subdomain → tenant hint', () => {
    expect(resolveTenantHost('acme.workflo.space')).toEqual({
      isPlatform: false,
      subdomain: 'acme',
    })
  })

  it('strips port + is case-insensitive', () => {
    expect(resolveTenantHost('Acme.Workflo.Space:443')).toEqual({
      isPlatform: false,
      subdomain: 'acme',
    })
  })

  it('host outside BASE_DOMAIN → custom domain', () => {
    expect(resolveTenantHost('crm.acme.com')).toEqual({
      isPlatform: false,
      customDomain: 'crm.acme.com',
    })
  })

  it('undefined host → platform (safe)', () => {
    expect(resolveTenantHost(undefined)).toEqual({ isPlatform: true })
  })

  it('honours BASE_DOMAIN override', () => {
    process.env.BASE_DOMAIN = 'agency.io'
    expect(resolveTenantHost('acme.agency.io')).toEqual({ isPlatform: false, subdomain: 'acme' })
    expect(resolveTenantHost('acme.workflo.space').customDomain).toBe('acme.workflo.space')
  })
})
