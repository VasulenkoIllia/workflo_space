import { describe, expect, it } from 'vitest'
import {
  assertSameTenant,
  requireActiveAgency,
  tenantData,
  tenantWhere,
} from '../src/auth/tenant.js'

const user = {
  activeAgencyId: 'A',
  agencyMemberships: [{ agencyId: 'A', role: 'executor' as const }],
}

describe('tenant helpers (ADR-004)', () => {
  it('tenantWhere merges the agency filter', () => {
    expect(tenantWhere('A', { internalStatus: 'new' })).toEqual({
      internalStatus: 'new',
      agencyId: 'A',
    })
    expect(tenantWhere('A')).toEqual({ agencyId: 'A' })
  })

  it('tenantData stamps the agency on create payloads', () => {
    expect(tenantData('A', { title: 'x' })).toEqual({ title: 'x', agencyId: 'A' })
  })

  it('requireActiveAgency returns the tenant or throws', () => {
    expect(requireActiveAgency(user)).toBe('A')
    expect(() => requireActiveAgency({ activeAgencyId: null, agencyMemberships: [] })).toThrow()
  })

  it('assertSameTenant allows same tenant, denies cross-tenant and null', () => {
    expect(() => assertSameTenant(user, 'A')).not.toThrow()
    expect(() => assertSameTenant(user, 'B')).toThrow()
    expect(() => assertSameTenant(user, null)).toThrow()
  })

  it('assertSameTenant accepts any of the user agency memberships', () => {
    const multi = {
      activeAgencyId: 'A',
      agencyMemberships: [
        { agencyId: 'A', role: 'executor' as const },
        { agencyId: 'C', role: 'owner' as const },
      ],
    }
    expect(() => assertSameTenant(multi, 'C')).not.toThrow()
  })
})
