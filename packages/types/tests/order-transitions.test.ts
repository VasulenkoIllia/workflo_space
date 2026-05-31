import { describe, expect, it } from 'vitest'
import { ALLOWED_ORDER_TRANSITIONS, canTransitionOrder, OrderInternalStatus } from '../src/index.js'

describe('order state machine (module 02)', () => {
  it('allows valid forward transitions', () => {
    expect(canTransitionOrder(OrderInternalStatus.NEW, OrderInternalStatus.IN_PROGRESS)).toBe(true)
    expect(canTransitionOrder(OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.REVIEW)).toBe(
      true
    )
    expect(canTransitionOrder(OrderInternalStatus.REVIEW, OrderInternalStatus.DONE)).toBe(true)
    // done → revision is the only reopen
    expect(canTransitionOrder(OrderInternalStatus.DONE, OrderInternalStatus.REVISION)).toBe(true)
  })

  it('rejects invalid, same-status and terminal transitions', () => {
    expect(canTransitionOrder(OrderInternalStatus.NEW, OrderInternalStatus.DONE)).toBe(false)
    expect(
      canTransitionOrder(OrderInternalStatus.IN_PROGRESS, OrderInternalStatus.IN_PROGRESS)
    ).toBe(false)
    expect(canTransitionOrder(OrderInternalStatus.DONE, OrderInternalStatus.IN_PROGRESS)).toBe(
      false
    )
    expect(canTransitionOrder(OrderInternalStatus.CANCELLED, OrderInternalStatus.NEW)).toBe(false)
  })

  it('defines transitions for all 9 internal states', () => {
    expect(Object.keys(ALLOWED_ORDER_TRANSITIONS)).toHaveLength(9)
    expect(ALLOWED_ORDER_TRANSITIONS[OrderInternalStatus.CANCELLED]).toEqual([])
  })
})
