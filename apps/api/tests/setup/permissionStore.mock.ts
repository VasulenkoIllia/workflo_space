import { beforeEach, vi } from 'vitest'

/**
 * PERM-1: юніт-тести мокають `@workflo/db` без таблиць прав → глобально підміняємо сховище
 * резолвера на «чисті дефолти» (без відхилень матриці, без тімлідства). Тести прав
 * перевизначають через `vi.mocked(fetchPermissionData)`. Інтеграційні (RUN_DB_TESTS=1) —
 * реальне сховище проти БД.
 */
vi.mock('../../src/auth/permissionStore.js', async (importOriginal) => {
  if (process.env.RUN_DB_TESTS === '1') return importOriginal()
  // PERM-4: базова фікстура юніт-тестів — видимість замовлень/чатів для виконавця й тімліда
  // «вся агенція» (як до PERM-4), щоб функціональні тести під-ресурсів замовлень не залежали
  // від скоупу. Скоуп own/team перевіряють окремі тести (permScope.test.ts) через
  // vi.mocked(fetchPermissionData) із порожніми roleRows (= реальні дефолти каталогу).
  const WIDE = ['orders.view', 'orders.work', 'chats.view'].flatMap((permission) =>
    (['executor', 'lead'] as const).map((role) => ({ role, permission, level: 'all' as const }))
  )
  return {
    fetchPermissionData: vi.fn(async () => ({
      leadTeamIds: [],
      teamId: null,
      roleRows: WIDE,
      memberRows: [],
    })),
  }
})

// Кеш прав (TTL 30 с) не має переживати тест: інакше знімок одного тесту (напр. тімлід)
// підхопить наступний з тим самим користувачем.
beforeEach(async () => {
  const { clearPermissionCache } = await import('../../src/auth/permissions.js')
  clearPermissionCache()
})
