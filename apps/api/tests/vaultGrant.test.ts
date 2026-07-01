import { describe, expect, it } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const { issueRevealGrant, verifyRevealGrant } = await import('../src/services/vaultGrant.js')

describe('vaultGrant — step-up reveal grant', () => {
  it('round-trips a fresh grant for the same profile', () => {
    const { grant } = issueRevealGrant('p1')
    expect(verifyRevealGrant(grant, 'p1')).toBe(true)
  })

  it('rejects a grant minted for another profile', () => {
    const { grant } = issueRevealGrant('p1')
    expect(verifyRevealGrant(grant, 'p2')).toBe(false)
  })

  it('rejects an expired grant', () => {
    const past = 1_000_000
    const { grant } = issueRevealGrant('p1', past)
    expect(verifyRevealGrant(grant, 'p1', past + 6 * 60 * 1000)).toBe(false)
  })

  it('rejects a tampered MAC', () => {
    const { grant } = issueRevealGrant('p1')
    const parts = grant.split('|')
    const tampered = `${parts[0]}|${parts[1]}|${'0'.repeat(parts[2].length)}`
    expect(verifyRevealGrant(tampered, 'p1')).toBe(false)
  })

  it('rejects a tampered expiry (extending the window)', () => {
    const { grant } = issueRevealGrant('p1', 1_000_000)
    const parts = grant.split('|')
    const forged = `${parts[0]}|${9_999_999_999_999}|${parts[2]}`
    expect(verifyRevealGrant(forged, 'p1')).toBe(false)
  })

  it('rejects empty/garbage input', () => {
    expect(verifyRevealGrant(undefined, 'p1')).toBe(false)
    expect(verifyRevealGrant('', 'p1')).toBe(false)
    expect(verifyRevealGrant('not-a-grant', 'p1')).toBe(false)
  })
})
