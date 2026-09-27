import { z } from 'zod'

/**
 * PERM-1 ПРАВА ДОСТУПУ (рішення власника 27.09.2026) — єдиний каталог можливостей агенції.
 *
 * Модель (design-v2 workspace-admin.jsx «Permissions»-матриця):
 *  • рівні: none · own (лише призначене/своє) · team (свій підрозділ) · all;
 *  • ролі матриці: manager · lead (executor, що є тімлідом підрозділу) · executor;
 *    owner — завжди `all` на все, не редагується (не можна заблокувати власника);
 *  • резолюція: персональне право людини → рядок матриці агенції → дефолт ролі → none.
 *  • керування самими правами — ЛИШЕ власник (не право каталогу: інакше самопідвищення).
 *
 * Дефолти відтворюють рішення власника 27.09: менеджер без фінансів, але веде замовлення/
 * клієнтів/лідів/команду; тімлід приймає роботу й бачить KPI свого підрозділу; виконавець —
 * лише своя робота (без фінансів, скасування/видалення, інвайтів, редагування проєктів).
 * Бекенд перевіряє через `requirePermission`, фронт — через `permissions` у /auth/me.
 */

export type PermissionLevel = 'none' | 'own' | 'team' | 'all'
export type PermissionRole = 'manager' | 'lead' | 'executor'
export type AgencyRoleKey = 'owner' | PermissionRole

export const PERMISSION_LEVELS: readonly PermissionLevel[] = ['none', 'own', 'team', 'all']
export const PERMISSION_ROLES: readonly PermissionRole[] = ['manager', 'lead', 'executor']

const RANK: Record<PermissionLevel, number> = { none: 0, own: 1, team: 2, all: 3 }

export function levelAtLeast(level: PermissionLevel, min: PermissionLevel): boolean {
  return RANK[level] >= RANK[min]
}

const BIN = ['none', 'all'] as const satisfies readonly PermissionLevel[]
const SCOPED = ['none', 'own', 'team', 'all'] as const satisfies readonly PermissionLevel[]
const TEAMED = ['none', 'team', 'all'] as const satisfies readonly PermissionLevel[]

export interface PermissionDef {
  key: string
  area: string
  label: string
  hint?: string
  /** Рівні, які має сенс виставляти (UI показує лише їх; інші клемпляться вниз). */
  levels: readonly PermissionLevel[]
  defaults: Record<PermissionRole, PermissionLevel>
}

const d = (m: PermissionLevel, l: PermissionLevel, x: PermissionLevel) => ({
  manager: m,
  lead: l,
  executor: x,
})

export const PERMISSIONS = [
  // ── Замовлення ──────────────────────────────────────────────────────────────
  {
    key: 'orders.view',
    area: 'Замовлення',
    label: 'Бачити замовлення',
    hint: 'own — лише призначені; team — свого підрозділу',
    levels: SCOPED,
    defaults: d('all', 'team', 'own'),
  },
  {
    key: 'orders.work',
    area: 'Замовлення',
    label: 'Працювати із замовленням: взяти в роботу, уточнити, здати',
    levels: SCOPED,
    defaults: d('all', 'team', 'own'),
  },
  {
    key: 'orders.create',
    area: 'Замовлення',
    label: 'Створювати замовлення',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'orders.edit',
    area: 'Замовлення',
    label: 'Редагувати замовлення (назва, опис, дедлайн, теги, залежності)',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'orders.assign',
    area: 'Замовлення',
    label: 'Призначати виконавців',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'orders.status',
    area: 'Замовлення',
    label: 'Керувати статусом: триаж, пауза, скасування',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'orders.accept',
    area: 'Замовлення',
    label: 'Приймати роботу / повертати на доопрацювання',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'orders.reconcile',
    area: 'Замовлення',
    label: 'Звірка годин: білабельні години клієнту',
    hint: 'години до виплати виконавцям — окремо, «Виплати»',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'orders.estimate',
    area: 'Замовлення',
    label: 'Оцінка й кошторис замовлення, подання на погодження',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'orders.delete',
    area: 'Замовлення',
    label: 'Видаляти й відновлювати замовлення (кошик)',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'chats.view',
    area: 'Замовлення',
    label: 'Чати замовлень',
    hint: 'own — лише чати призначених замовлень',
    levels: SCOPED,
    defaults: d('all', 'team', 'own'),
  },
  {
    key: 'chats.moderate',
    area: 'Замовлення',
    label: 'Модерувати чат: редагувати й видаляти чужі повідомлення',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },

  // ── Задачі й час ────────────────────────────────────────────────────────────
  {
    key: 'tasks.manage',
    area: 'Задачі й час',
    label: 'Створювати й редагувати задачі',
    levels: SCOPED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'tasks.delete',
    area: 'Задачі й час',
    label: 'Видаляти задачі',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'boards.configure',
    area: 'Задачі й час',
    label: 'Налаштовувати колонки дошки підрозділу',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'time.view_team',
    area: 'Задачі й час',
    label: 'Бачити час команди (timesheet)',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'time.edit_others',
    area: 'Задачі й час',
    label: 'Редагувати чужі записи часу',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },

  // ── Клієнти ─────────────────────────────────────────────────────────────────
  {
    key: 'clients.view',
    area: 'Клієнти',
    label: 'Бачити клієнтів і картку 360°',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'clients.manage',
    area: 'Клієнти',
    label: 'Заводити клієнтів, запрошувати й скидати доступ їхнім учасникам',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'clients.requisites',
    area: 'Клієнти',
    label: 'Юр-реквізити клієнтів (ЄДРПОУ, IBAN, підписант)',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'leads.manage',
    area: 'Клієнти',
    label: 'Ліди й воронка продажів',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'documents.manage',
    area: 'Клієнти',
    label: 'Документи: специфікації, акти, договори (формувати й надсилати)',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },

  {
    key: 'support.handle',
    area: 'Клієнти',
    label: 'Обробляти звернення підтримки (статус, призначення)',
    levels: BIN,
    defaults: d('all', 'all', 'all'),
  },

  // ── Фінанси ─────────────────────────────────────────────────────────────────
  {
    key: 'billing.view',
    area: 'Фінанси',
    label: 'Рахунки, платежі, дебітори (перегляд)',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'billing.manage',
    area: 'Фінанси',
    label: 'Виставляти рахунки, підтверджувати оплати, бонусні гаманці',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'projects.manage',
    area: 'Фінанси',
    label: 'Фін-проєкти: умови, цикли, кошториси проєктів',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'projects.view',
    area: 'Фінанси',
    label: 'Бачити фін-проєкти (суми — лише з «Рахунки»)',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'finance.view',
    area: 'Фінанси',
    label: 'P&L, маржа, виручка, фінансові звіти',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'finance.manage',
    area: 'Фінанси',
    label: 'Вносити витрати',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'payouts.view_team',
    area: 'Фінанси',
    label: 'Бачити заробіток і ставки команди',
    levels: TEAMED,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'payouts.manage',
    area: 'Фінанси',
    label: 'Виплати: звірка, затвердження, ставки',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },

  // ── Команда ─────────────────────────────────────────────────────────────────
  {
    key: 'team.invite',
    area: 'Команда',
    label: 'Запрошувати виконавців',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'team.departments',
    area: 'Команда',
    label: 'Підрозділи: створювати, склад, тімліди',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'team.kpi',
    area: 'Команда',
    label: 'KPI й картки виконавців',
    levels: TEAMED,
    defaults: d('all', 'team', 'none'),
  },
  {
    key: 'leave.approve',
    area: 'Команда',
    label: 'Погоджувати відсутності',
    levels: TEAMED,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'calendar.manage',
    area: 'Команда',
    label: 'Редагувати й скасовувати чужі події календаря',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },

  // ── Агенція ─────────────────────────────────────────────────────────────────
  {
    key: 'reports.ops',
    area: 'Агенція',
    label: 'Операційні звіти: навантаження, план-факт, SLA, timesheet',
    levels: BIN,
    defaults: d('all', 'none', 'none'),
  },
  {
    key: 'reports.audit',
    area: 'Агенція',
    label: 'Журнал дій (audit log)',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'content.manage',
    area: 'Агенція',
    label: 'Контент сайту: блог, кейси, відгуки',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'announcements.manage',
    area: 'Агенція',
    label: 'Оголошення команді й клієнтам',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'broadcasts.manage',
    area: 'Агенція',
    label: 'Email-розсилки клієнтам',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'settings.catalogs',
    area: 'Агенція',
    label: 'Каталоги: послуги, номенклатура, теги, шаблони замовлень',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'settings.legal',
    area: 'Агенція',
    label: 'Юр-особи й платіжні реквізити агенції',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
  {
    key: 'settings.manage',
    area: 'Агенція',
    label: 'Налаштування агенції: воркфлоу, шаблони, SMTP, крони, реферальна програма',
    levels: BIN,
    defaults: d('none', 'none', 'none'),
  },
] as const satisfies readonly PermissionDef[]

export type PermissionKey = (typeof PERMISSIONS)[number]['key']
export type PermissionMap = Record<PermissionKey, PermissionLevel>

const DEF_BY_KEY = new Map<string, PermissionDef>(PERMISSIONS.map((p) => [p.key, p]))

export function isPermissionKey(key: string): key is PermissionKey {
  return DEF_BY_KEY.has(key)
}

export function permissionDef(key: PermissionKey): PermissionDef {
  return DEF_BY_KEY.get(key) as PermissionDef
}

/** Клемп рівня до дозволених для права (напр. `own` для BIN-права → `none`). */
export function clampLevel(key: PermissionKey, level: PermissionLevel): PermissionLevel {
  const allowed = permissionDef(key).levels
  let best: PermissionLevel = 'none'
  for (const l of allowed) if (RANK[l] <= RANK[level] && RANK[l] > RANK[best]) best = l
  return best
}

export interface ResolveInput {
  /** Роль в агенції з членства. */
  agencyRole: 'owner' | 'manager' | 'executor'
  /** executor, що є тімлідом ≥1 підрозділу → колонка `lead` матриці. */
  isLead: boolean
  roleRows: readonly { role: PermissionRole; permission: string; level: PermissionLevel }[]
  memberRows: readonly { permission: string; level: PermissionLevel }[]
}

/** Колонка матриці для людини (owner → 'owner'). */
export function matrixRole(agencyRole: ResolveInput['agencyRole'], isLead: boolean): AgencyRoleKey {
  if (agencyRole === 'owner') return 'owner'
  if (agencyRole === 'executor' && isLead) return 'lead'
  return agencyRole
}

/** Ефективні права людини: персональне → рядок матриці агенції → дефолт ролі. */
export function resolvePermissions(input: ResolveInput): PermissionMap {
  const role = matrixRole(input.agencyRole, input.isLead)
  const out = {} as PermissionMap
  if (role === 'owner') {
    for (const p of PERMISSIONS) out[p.key] = 'all'
    return out
  }
  const roleOv = new Map<string, PermissionLevel>()
  for (const r of input.roleRows) if (r.role === role) roleOv.set(r.permission, r.level)
  const memberOv = new Map<string, PermissionLevel>()
  for (const r of input.memberRows) memberOv.set(r.permission, r.level)
  for (const p of PERMISSIONS) {
    const raw = memberOv.get(p.key) ?? roleOv.get(p.key) ?? p.defaults[role]
    out[p.key] = clampLevel(p.key, raw)
  }
  return out
}

/** Дефолтна матриця (для UI «скинути до дефолту» і як база без відхилень). */
export function defaultMatrix(): Record<PermissionRole, PermissionMap> {
  const m = { manager: {}, lead: {}, executor: {} } as Record<PermissionRole, PermissionMap>
  for (const p of PERMISSIONS) for (const r of PERMISSION_ROLES) m[r][p.key] = p.defaults[r]
  return m
}

// ── API-контракти керування правами (owner-only) ─────────────────────────────

const levelSchema = z.enum(['none', 'own', 'team', 'all'])

/** PUT /workspace/permissions/roles/:role та /members/:profileId — `level: null` = скинути
 *  відхилення (повернути дефолт ролі / рядок матриці). */
export const setPermissionSchema = z
  .object({
    permission: z.string().refine(isPermissionKey, 'Невідоме право'),
    level: levelSchema.nullable(),
  })
  .strict()
export type SetPermissionInput = z.infer<typeof setPermissionSchema>

export const permissionRoleSchema = z.enum(['manager', 'lead', 'executor'])
