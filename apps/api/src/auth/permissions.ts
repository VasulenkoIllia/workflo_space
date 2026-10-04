import { type Prisma, prisma } from '@workflo/db'
import {
  ApiErrorCode,
  AppError,
  levelAtLeast,
  permissionDef,
  resolvePermissions,
  type PermissionKey,
  type PermissionLevel,
  type PermissionMap,
} from '@workflo/types'
import type { FastifyRequest } from 'fastify'
import { fetchPermissionData } from './permissionStore.js'
import { agencyRole, type AccessClaims } from './tokens.js'

/**
 * PERM-1: ефективні права людини в АКТИВНІЙ агенції. Резолвимо на запит (не в JWT) —
 * відкликання діє за ≤30 с (TTL кешу), а не після спливу access-токена. Роль, матриця,
 * персональні права й тімлідство — з БД (роль із токена — лише щоб знайти членство; зміна
 * ролі чи видалення з агенції діє за ≤30 с — security-review 27.09).
 * Каталог і дефолти — @workflo/types `PERMISSIONS`.
 */
export interface PermissionSnapshot {
  agencyId: string
  role: 'owner' | 'manager' | 'executor'
  isLead: boolean
  leadTeamIds: string[]
  teamId: string | null
  levels: PermissionMap
}

const TTL_MS = 30_000
const cache = new Map<string, { at: number; snap: PermissionSnapshot }>()
const perRequest = new WeakMap<FastifyRequest, Promise<PermissionSnapshot | null>>()

/** Обмеження памʼяті процесу: при переповненні — викинути протухлі, далі найстаріші. */
const MAX_ENTRIES = 5_000
function sweep(): void {
  const now = Date.now()
  for (const [k, v] of cache) if (now - v.at >= TTL_MS) cache.delete(k)
  // Map зберігає порядок вставки → перші записи найстаріші
  for (const k of cache.keys()) {
    if (cache.size < MAX_ENTRIES) break
    cache.delete(k)
  }
}

/** Повне очищення кешу (тести; зміна ролі через адмінку — для надійності). */
export function clearPermissionCache(): void {
  cache.clear()
}

/** Скинути кеш агенції (після зміни матриці/персональних прав/тімліда). */
export function invalidatePermissions(agencyId: string): void {
  for (const k of cache.keys()) if (k.startsWith(`${agencyId}:`)) cache.delete(k)
}

/** Знімок прав людини в конкретній агенції (для /auth/me — зі свіжими членствами з БД). */
export async function loadPermissionSnapshot(
  user: Pick<AccessClaims, 'sub' | 'agencyMemberships'>,
  agencyId: string
): Promise<PermissionSnapshot | null> {
  return load(user, agencyId)
}

async function load(
  user: Pick<AccessClaims, 'sub' | 'agencyMemberships'>,
  agencyId: string
): Promise<PermissionSnapshot | null> {
  const tokenRole = agencyRole(user, agencyId)
  if (!tokenRole) return null // не член агенції (клієнт порталу) — агентських прав нема
  const key = `${agencyId}:${user.sub}:${tokenRole}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.snap
  const data = await fetchPermissionData(agencyId, user.sub)
  // Роль із БД переважає токен; null — людину прибрали з агенції → прав нема
  const role = data.role === undefined ? tokenRole : data.role
  if (!role) return null
  const isLead = role === 'executor' && data.leadTeamIds.length > 0
  const snap: PermissionSnapshot = {
    agencyId,
    role,
    isLead,
    leadTeamIds: data.leadTeamIds,
    teamId: data.teamId,
    levels: resolvePermissions({
      agencyRole: role,
      isLead,
      roleRows: data.roleRows,
      memberRows: data.memberRows,
    }),
  }
  if (cache.size >= MAX_ENTRIES) sweep()
  cache.set(key, { at: Date.now(), snap })
  return snap
}

/** Права поточного користувача в його активній агенції (мемо на запит). null — не агенція. */
export function getPermissions(request: FastifyRequest): Promise<PermissionSnapshot | null> {
  let p = perRequest.get(request)
  if (!p) {
    const agencyId = request.user.activeAgencyId
    p = agencyId ? load(request.user, agencyId) : Promise.resolve(null)
    perRequest.set(request, p)
  }
  return p
}

/** Рівень права (none, якщо не член агенції). */
export async function permissionLevel(
  request: FastifyRequest,
  key: PermissionKey
): Promise<PermissionLevel> {
  const snap = await getPermissions(request)
  return snap?.levels[key] ?? 'none'
}

/**
 * Гард: 403, якщо рівень права нижчий за `min` (дефолт — будь-який, крім none).
 * Повертає знімок (рівень + підрозділ/тімлідство для скоупу own/team у хендлері).
 */
export async function requirePermission(
  request: FastifyRequest,
  key: PermissionKey,
  min: PermissionLevel = 'own'
): Promise<PermissionSnapshot & { level: PermissionLevel }> {
  const snap = await getPermissions(request)
  const level = snap?.levels[key] ?? 'none'
  if (!snap || level === 'none' || !levelAtLeast(level, min)) {
    throw new AppError(
      ApiErrorCode.FORBIDDEN,
      `Недостатньо прав: ${permissionDef(key).label.toLowerCase()}`,
      403
    )
  }
  return { ...snap, level }
}

/** Неблокуюча перевірка — для маскування полів (суми лише з `billing.view` тощо). */
export async function hasPermission(
  request: FastifyRequest,
  key: PermissionKey,
  min: PermissionLevel = 'own'
): Promise<boolean> {
  const snap = await getPermissions(request)
  const level = snap?.levels[key] ?? 'none'
  return level !== 'none' && levelAtLeast(level, min)
}

/** Гард «хоча б одне з прав» (напр. пікер юр-осіб: settings.legal ∨ projects.manage). */
export async function requireAnyPermission(
  request: FastifyRequest,
  keys: readonly PermissionKey[]
): Promise<PermissionSnapshot> {
  const snap = await getPermissions(request)
  if (snap && keys.some((k) => snap.levels[k] !== 'none')) return snap
  throw new AppError(
    ApiErrorCode.FORBIDDEN,
    `Недостатньо прав: ${keys.map((k) => permissionDef(k).label.toLowerCase()).join(' або ')}`,
    403
  )
}

/**
 * PERM-3: скоуп рівня для дії над ЛЮДИНОЮ (KPI, відсутності, ставки): `all` — будь-хто;
 * `team` — член підрозділу, де я тімлід; інакше — ні. Самого себе не покриває (self —
 * окреме правило роуту).
 */
export async function coversMember(
  snap: PermissionSnapshot,
  level: PermissionLevel,
  profileId: string
): Promise<boolean> {
  if (level === 'all') return true
  if (level !== 'team' || snap.leadTeamIds.length === 0) return false
  const member = await prisma.agencyMember.findFirst({
    where: { agencyId: snap.agencyId, profileId, teamId: { in: snap.leadTeamIds } },
    select: { id: true },
  })
  return member != null
}

/** Члени підрозділів, де я тімлід (для списків рівня `team`). */
export async function myTeamMemberIds(snap: PermissionSnapshot): Promise<string[]> {
  if (snap.leadTeamIds.length === 0) return []
  const rows = await prisma.agencyMember.findMany({
    where: { agencyId: snap.agencyId, teamId: { in: snap.leadTeamIds } },
    select: { profileId: true },
  })
  return rows.map((r) => r.profileId)
}

/**
 * PERM-3/4: чи покриває рівень права КОНКРЕТНЕ замовлення. all — будь-яке; team — замовлення
 * підрозділу, де я тімлід (проєкт закріплений за підрозділом АБО головний виконавець у ньому);
 * own — я головний виконавець чи співвиконавець.
 */
export async function coversOrder(
  snap: PermissionSnapshot,
  level: PermissionLevel,
  order: {
    assigneeId: string | null
    coAssigneeIds?: readonly string[]
    projectTeamId?: string | null
  },
  userId: string
): Promise<boolean> {
  if (level === 'all') return true
  const mine = order.assigneeId === userId || (order.coAssigneeIds ?? []).includes(userId)
  if (level === 'own') return mine
  if (level !== 'team') return false
  if (mine) return true
  if (order.projectTeamId && snap.leadTeamIds.includes(order.projectTeamId)) return true
  if (!order.assigneeId) return false
  return coversMember(snap, 'team', order.assigneeId)
}

/**
 * PERM-4: Prisma-фільтр замовлень за рівнем права (orders.view / chats.view / orders.work).
 *  all — усі замовлення агенції; own — де я головний/співвиконавець АБО маю задачу (виконавець
 *  чи співвиконавець задачі); team — own + замовлення підрозділів, де я тімлід (проєкт
 *  підрозділу, задачі підрозділу, головний виконавець у підрозділі). null — доступу нема.
 */
export function orderScopeWhere(
  snap: PermissionSnapshot,
  level: PermissionLevel,
  userId: string
): Prisma.OrderWhereInput | null {
  if (level === 'all') return {}
  if (level === 'none') return null
  const own: Prisma.OrderWhereInput[] = [
    { assigneeId: userId },
    { coAssignees: { some: { profileId: userId } } },
    {
      internalTasks: {
        some: { OR: [{ assigneeId: userId }, { coAssignees: { some: { profileId: userId } } }] },
      },
    },
  ]
  if (level === 'own' || snap.leadTeamIds.length === 0) return { OR: own }
  const teams = { in: snap.leadTeamIds }
  return {
    OR: [
      ...own,
      { project: { teamId: teams } },
      { internalTasks: { some: { teamId: teams } } },
      {
        assignee: {
          agencyMemberships: { some: { agencyId: snap.agencyId, teamId: teams } },
        },
      },
    ],
  }
}
