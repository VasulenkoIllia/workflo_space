/**
 * S9-06 GDPR-EXPORT: право на переносимість/доступ — вивантаження ВЛАСНИХ даних
 * профілю у машиночитний JSON. Тільки дані самого суб'єкта (за profileId/authorId):
 * профіль, налаштування, членства, свої сповіщення, свої повідомлення в тікетах,
 * свої відсутності. СВІДОМО НЕ включаємо: passwordHash / TOTP-секрет / секрети
 * vault / чужі дані. Викликається зі скоупу активної агенції (withTenant у роуті).
 */

// Структурний контракт до Prisma — щоб сервіс тестувався db-даблом.
interface ExportDb {
  profile: {
    findUnique: (args: {
      where: { id: string }
      select: Record<string, true>
    }) => Promise<Record<string, unknown> | null>
  }
  notificationSettings: {
    findUnique: (args: {
      where: { profileId: string }
      select: Record<string, true>
    }) => Promise<Record<string, unknown> | null>
  }
  companyMember: {
    findMany: (args: {
      where: { profileId: string }
      select: Record<string, unknown>
    }) => Promise<Array<Record<string, unknown>>>
  }
  agencyMember: {
    findMany: (args: {
      where: { profileId: string }
      select: Record<string, unknown>
    }) => Promise<Array<Record<string, unknown>>>
  }
  notification: {
    findMany: (args: {
      where: { profileId: string }
      select: Record<string, true>
      orderBy: { createdAt: 'desc' }
      take: number
    }) => Promise<Array<Record<string, unknown>>>
  }
  ticketMessage: {
    findMany: (args: {
      where: { authorId: string; deletedAt: null }
      select: Record<string, true>
      orderBy: { createdAt: 'asc' }
      take: number
    }) => Promise<Array<Record<string, unknown>>>
  }
  leaveRequest: {
    findMany: (args: {
      where: { profileId: string }
      select: Record<string, true>
      orderBy: { startDate: 'asc' }
      take: number
    }) => Promise<Array<Record<string, unknown>>>
  }
}

export interface ProfileExport {
  generatedAt: string
  subjectProfileId: string
  note: string
  profile: Record<string, unknown> | null
  notificationSettings: Record<string, unknown> | null
  companyMemberships: Array<Record<string, unknown>>
  agencyMemberships: Array<Record<string, unknown>>
  notifications: Array<Record<string, unknown>>
  ticketMessages: Array<Record<string, unknown>>
  leaveRequests: Array<Record<string, unknown>>
}

export async function buildProfileExport(
  db: ExportDb,
  profileId: string,
  now: Date
): Promise<ProfileExport> {
  const [
    profile,
    notificationSettings,
    companyMemberships,
    agencyMemberships,
    notifications,
    ticketMessages,
    leaveRequests,
  ] = await Promise.all([
    db.profile.findUnique({
      where: { id: profileId },
      // Явний allow-list: жодних passwordHash / totpSecret.
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        language: true,
        theme: true,
        avatarUrl: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    db.notificationSettings.findUnique({
      where: { profileId },
      select: {
        language: true,
        telegramChatId: true,
        quietFrom: true,
        quietTo: true,
        digestDaily: true,
      },
    }),
    db.companyMember.findMany({
      where: { profileId },
      select: { role: true, joinedAt: true, company: { select: { name: true } } },
    }),
    db.agencyMember.findMany({
      where: { profileId },
      select: {
        role: true,
        hireDate: true,
        createdAt: true,
        agency: { select: { name: true } },
      },
    }),
    db.notification.findMany({
      where: { profileId },
      select: { title: true, body: true, isRead: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    }),
    db.ticketMessage.findMany({
      where: { authorId: profileId, deletedAt: null },
      select: { ticketId: true, content: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    }),
    db.leaveRequest.findMany({
      where: { profileId },
      select: {
        type: true,
        startDate: true,
        endDate: true,
        days: true,
        status: true,
        reason: true,
        createdAt: true,
      },
      orderBy: { startDate: 'asc' },
      take: 2000,
    }),
  ])

  return {
    generatedAt: now.toISOString(),
    subjectProfileId: profileId,
    note: 'Персональні дані з активної агенції. Секрети (паролі, TOTP, дані сейфа) свідомо не включені.',
    profile,
    notificationSettings,
    companyMemberships,
    agencyMemberships,
    notifications,
    ticketMessages,
    leaveRequests,
  }
}
