import { describe, expect, it } from 'vitest'

process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!'

const { makeUnsubscribeToken, verifyUnsubscribeToken } = await import('@workflo/notifications')
const { detectBounce } = await import('../src/services/inboundEmail.js')

// S12-05 (хвіст): підписані unsubscribe-токени + DSN/bounce-детект.

describe('unsubscribe token', () => {
  it('roundtrip: make → verify повертає email (lower-case)', () => {
    const t = makeUnsubscribeToken('Client@Example.COM')
    expect(verifyUnsubscribeToken(t)).toBe('client@example.com')
  })

  it('підроблений підпис / битий формат → null', () => {
    const t = makeUnsubscribeToken('client@example.com')
    expect(verifyUnsubscribeToken(t.slice(0, -2) + 'xx')).toBeNull()
    expect(verifyUnsubscribeToken('garbage')).toBeNull()
    expect(verifyUnsubscribeToken('bm90LWFuLWVtYWls.abc')).toBeNull() // без @
  })
})

describe('detectBounce (DSN)', () => {
  it('multipart/report + Final-Recipient у тілі → адреса', () => {
    const parsed = {
      from: { value: [{ address: 'MAILER-DAEMON@mx.example' }] },
      headers: new Map<string, unknown>([
        [
          'content-type',
          { value: 'multipart/report', params: { 'report-type': 'delivery-status' } },
        ],
      ]),
      text: 'Delivery failed.\nFinal-Recipient: rfc822; dead@client.example\nStatus: 5.1.1',
    }
    expect(detectBounce(parsed)).toBe('dead@client.example')
  })

  it('mailer-daemon + X-Failed-Recipients → адреса', () => {
    const parsed = {
      from: { value: [{ address: 'mailer-daemon@googlemail.com' }] },
      headers: new Map<string, unknown>([['x-failed-recipients', 'Bounced@Client.Example']]),
      text: 'could not be delivered',
    }
    expect(detectBounce(parsed)).toBe('bounced@client.example')
  })

  it('звичайний лист → null (не bounce)', () => {
    const parsed = {
      from: { value: [{ address: 'client@example.com' }] },
      headers: new Map<string, unknown>([['content-type', { value: 'text/plain' }]]),
      text: 'звичайне звернення',
    }
    expect(detectBounce(parsed)).toBeNull()
  })
})
