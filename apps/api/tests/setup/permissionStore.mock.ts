import { beforeEach, vi } from 'vitest'

/**
 * PERM-1: юніт-тести мокають `@workflo/db` без таблиць прав → глобально підміняємо сховище
 * резолвера на «чисті дефолти» (без відхилень матриці, без тімлідства). Тести прав
 * перевизначають через `vi.mocked(fetchPermissionData)`. Інтеграційні (RUN_DB_TESTS=1) —
 * реальне сховище проти БД.
 */
vi.mock('../../src/auth/permissionStore.js', async (importOriginal) => {
  if (process.env.RUN_DB_TESTS === '1') return importOriginal()
  return {
    fetchPermissionData: vi.fn(async () => ({
      leadTeamIds: [],
      teamId: null,
      roleRows: [],
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
