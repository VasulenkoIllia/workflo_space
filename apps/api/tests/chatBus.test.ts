import { describe, expect, it, vi } from 'vitest'
import { type ChatEvent, publishChatEvent, subscribeChat } from '../src/services/chatBus.js'

const event = (orderId: string, commentId = 'c1'): ChatEvent => ({
  orderId,
  commentId,
  authorId: 'p1',
  isInternal: false,
  createdAt: '2026-05-31T00:00:00.000Z',
})

describe('chatBus', () => {
  it('delivers an event to a subscriber of the same order', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeChat('order-1', handler)
    publishChatEvent(event('order-1'))
    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler.mock.calls[0][0].commentId).toBe('c1')
    unsubscribe()
  })

  it('isolates orders — a subscriber only hears its own order', () => {
    const a = vi.fn()
    const b = vi.fn()
    const ua = subscribeChat('order-A', a)
    const ub = subscribeChat('order-B', b)
    publishChatEvent(event('order-A'))
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).not.toHaveBeenCalled()
    ua()
    ub()
  })

  it('stops delivering after unsubscribe', () => {
    const handler = vi.fn()
    const unsubscribe = subscribeChat('order-1', handler)
    unsubscribe()
    publishChatEvent(event('order-1'))
    expect(handler).not.toHaveBeenCalled()
  })

  it('fans out to multiple subscribers of one order', () => {
    const h1 = vi.fn()
    const h2 = vi.fn()
    const u1 = subscribeChat('order-X', h1)
    const u2 = subscribeChat('order-X', h2)
    publishChatEvent(event('order-X'))
    expect(h1).toHaveBeenCalledTimes(1)
    expect(h2).toHaveBeenCalledTimes(1)
    u1()
    u2()
  })
})
