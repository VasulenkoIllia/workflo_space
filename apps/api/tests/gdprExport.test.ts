import { describe, expect, it, vi } from 'vitest'
import { buildProfileExport } from '../src/services/gdprExport.js'

// S9-06: вивантаження власних даних — структура + скоуп «лише свої» + без секретів.
const NOW = new Date('2026-07-12T10:00:00Z')

function makeDb() {
  return {
    profile: {
      findUnique: vi.fn().mockResolvedValue({ id: 'p1', email: 'c@e.com', name: 'Client' }),
    },
    notificationSettings: {
      findUnique: vi.fn().mockResolvedValue({ language: 'uk', digestDaily: false }),
    },
    companyMember: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ role: 'owner', joinedAt: NOW, company: { name: 'ТОВ' } }]),
    },
    agencyMember: { findMany: vi.fn().mockResolvedValue([]) },
    notification: {
      findMany: vi
        .fn()
        .mockResolvedValue([{ title: 'x', body: 'y', isRead: false, createdAt: NOW }]),
    },
    ticketMessage: {
      findMany: vi.fn().mockResolvedValue([{ ticketId: 't1', content: 'hi', createdAt: NOW }]),
    },
    leaveRequest: { findMany: vi.fn().mockResolvedValue([]) },
  }
}

describe('buildProfileExport (S9-06)', () => {
  it('збирає власні дані профілю з міткою часу', async () => {
    const db = makeDb()
    const r = await buildProfileExport(db as never, 'p1', NOW)
    expect(r.generatedAt).toBe(NOW.toISOString())
    expect(r.subjectProfileId).toBe('p1')
    expect(r.profile).toMatchObject({ email: 'c@e.com' })
    expect(r.companyMemberships).toHaveLength(1)
    expect(r.notifications).toHaveLength(1)
    expect(r.ticketMessages[0]).toMatchObject({ content: 'hi' })
  })

  it('запитує лише СВОЇ рядки (profileId/authorId), без секретів у select', async () => {
    const db = makeDb()
    await buildProfileExport(db as never, 'p1', NOW)
    expect(db.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'p1' } })
    )
    expect(db.ticketMessage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { authorId: 'p1', deletedAt: null } })
    )
    expect(db.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { profileId: 'p1' } })
    )
    const sel = db.profile.findUnique.mock.calls[0]![0]!.select as Record<string, unknown>
    expect(sel).not.toHaveProperty('passwordHash')
    expect(sel).not.toHaveProperty('totpSecret')
  })
})
