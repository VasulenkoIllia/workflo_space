/**
 * Billing engine demo — a narrated walkthrough of the S5.6 cost-approval system (P-7..P-11)
 * against a real Postgres. It seeds ephemeral data, drives the full money lifecycle for each
 * of the 3 approval modes (+ counter-offer), prints what happens to the client's balance /
 * revenue at each step, then cleans up. Nothing here asserts — it's a "see it work" tour.
 *
 * Run (against the throwaway test DB that the migrations are already applied to):
 *   DATABASE_URL="postgresql://postgres:postgres@localhost:5441/postgres" \
 *     pnpm --filter @workflo/api demo:billing
 */
import { randomUUID } from 'node:crypto'
import { Prisma, prisma, tenantTransaction } from '@workflo/db'
import { OrderInternalStatus, canTransitionOrder } from '@workflo/types'
import { refreshMoneyBalance } from '../src/services/allocation.js'
import { computeProjectMargin } from '../src/services/margin.js'
import { generateRecurringCharges } from '../src/services/recurringCharges.js'

const tag = randomUUID().slice(0, 8)
const agencyId = randomUUID()
const creatorId = randomUUID()

const RATE = 30 // client $/hour
const HOURS = 5 // logged → charge = 5 × 30 = $150

// ── pretty print ─────────────────────────────────────────────────────────────
const line = (s = '') => console.log(s)
const h1 = (s: string) => line(`\n${'═'.repeat(78)}\n  ${s}\n${'═'.repeat(78)}`)
const step = (s: string) => line(`\n▸ ${s}`)
const kv = (k: string, v: string) => line(`    ${k.padEnd(34)} ${v}`)
const money = (d: Prisma.Decimal | null | undefined) =>
  d == null ? '—' : `$${new Prisma.Decimal(d).toFixed(2)}`

async function balance(companyId: string): Promise<string> {
  const c = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { moneyBalance: true },
  })
  // negative balance = client owes; positive = prepaid/credit.
  const b = c.moneyBalance
  return `${money(b)}  (${b.isNegative() ? 'клієнт винен' : b.isZero() ? 'рівно' : 'переплата/кредит'})`
}

async function revenue(projectId: string): Promise<string> {
  const m = await tenantTransaction(prisma, (tx) =>
    computeProjectMargin(tx, {
      agencyId,
      projectId,
      from: new Date('2026-07-01T00:00:00Z'),
      to: new Date('2026-07-31T00:00:00Z'),
    })
  )
  return m ? `revenue ${money(new Prisma.Decimal(m.revenueUsd))} · margin ${money(new Prisma.Decimal(m.marginUsd))}` : '—'
}

/** Seed company(mode) + hourly_postpaid project + order + 5h time-log in July. */
async function seedScenario(name: string, approvalMode: string) {
  const companyId = randomUUID()
  const projectId = randomUUID()
  const orderId = randomUUID()
  await prisma.company.create({
    data: {
      id: companyId,
      agencyId,
      name: `${name} Co`,
      slug: `${tag}-${name}`,
      loyaltyTier: 'new',
      approvalMode: approvalMode as never,
    },
  })
  await prisma.project.create({
    data: {
      id: projectId,
      agencyId,
      companyId,
      name: `${name} Project`,
      billingModel: 'hourly_postpaid',
      billingCycle: 'monthly_day_n',
      currency: 'USD',
      clientHourlyRate: new Prisma.Decimal(RATE),
      nextCycleAt: new Date('2026-08-01T00:00:00Z'), // Aug close bills July
    },
  })
  await prisma.order.create({
    data: { id: orderId, agencyId, projectId, title: `${name} order`, createdById: creatorId },
  })
  await prisma.timeLog.create({
    data: {
      agencyId,
      orderId,
      executorId: creatorId,
      hours: new Prisma.Decimal(HOURS),
      date: new Date('2026-07-10'),
      clientRateSnapshot: new Prisma.Decimal(RATE),
    },
  })
  return { companyId, projectId, orderId }
}

function generate(now: string) {
  return tenantTransaction(prisma, (tx) => generateRecurringCharges(tx, { now: new Date(now), agencyId }))
}
function charge(projectId: string) {
  return prisma.serviceCharge.findFirstOrThrow({ where: { projectId, kind: 'hourly' } })
}

// ── Scenario 1: none — charge is owed immediately ────────────────────────────
async function scenarioNone() {
  h1('РЕЖИМ 1 — «none»: без погодження (як зараз / дефолт)')
  const { companyId, projectId } = await seedScenario('none', 'none')
  step('Команда відпрацювала 5 год × $30 = $150. Закриваємо місяць (генерація нарахування).')
  await generate('2026-08-15T00:00:00Z')
  const c = await charge(projectId)
  kv('Нарахування виставлено', `${money(c.totalAmount)}  (approvalStatus: ${c.approvalStatus ?? 'немає гейту'})`)
  kv('Баланс клієнта', await balance(companyId))
  kv('У маржі проєкту', await revenue(projectId))
  line('\n  → Нарахування одразу «бойове»: входить у баланс і дохід. Жодного погодження.')
}

// ── Scenario 2: on_actuals — draft until released, with counter-offer ────────
async function scenarioOnActuals() {
  h1('РЕЖИМ 2 — «on_actuals»: працюємо по факту → погоджуємо суму ПЕРЕД рахунком')
  const { companyId, projectId } = await seedScenario('onact', 'on_actuals')
  step('Ті самі 5 год × $30 = $150. Закриваємо місяць.')
  await generate('2026-08-15T00:00:00Z')
  const c = await charge(projectId)
  kv('Нарахування виставлено', `${money(c.totalAmount)}  (approvalStatus: ${c.approvalStatus})`)
  kv('Баланс клієнта', await balance(companyId))
  kv('У маржі проєкту', await revenue(projectId))
  line('\n  → DRAFT: сума порахована, але НЕ входить у баланс і дохід, поки не погодимо.')

  step('Власник/фінансист переглядає й ПОГОДЖУЄ зі знижкою-поступкою (counter-offer): $150 → $120.')
  await tenantTransaction(prisma, async (tx) => {
    await tx.serviceCharge.update({
      where: { id: c.id },
      data: {
        approvalStatus: 'approved',
        approvalDecidedAt: new Date(),
        approvalDecidedById: creatorId,
        approvedAmount: new Prisma.Decimal(120),
        totalAmount: new Prisma.Decimal(120), // amount=150 лишається як «виставлено» → видно 3 числа
      },
    })
    await refreshMoneyBalance(tx, { agencyId, companyId })
  })
  const c2 = await prisma.serviceCharge.findUniqueOrThrow({ where: { id: c.id } })
  kv('Очікувано (quote)', money(c2.amount))
  kv('Погоджено/фінально (counter-offer)', money(c2.totalAmount))
  kv('Баланс клієнта', await balance(companyId))
  kv('У маржі проєкту', await revenue(projectId))
  line('\n  → Після release нарахування «бойове» — але вже на погоджені $120, не $150.')
}

// ── Scenario 3: upfront — estimate approved BEFORE work starts ───────────────
async function scenarioUpfront() {
  h1('РЕЖИМ 3 — «upfront»: клієнт погоджує ОЦІНКУ до старту роботи (гейт замовлення)')
  const companyId = randomUUID()
  const orderId = randomUUID()
  await prisma.company.create({
    data: { id: companyId, agencyId, name: 'upfront Co', slug: `${tag}-upf`, loyaltyTier: 'new', approvalMode: 'upfront' as never },
  })
  // Order born with an estimate; upfront ⇒ requiresApproval=true (as createWorkspaceOrder resolves).
  await prisma.order.create({
    data: {
      id: orderId,
      agencyId,
      companyId,
      title: 'upfront order',
      createdById: creatorId,
      billingType: 'fixed',
      fixedPrice: new Prisma.Decimal(500),
      internalStatus: 'estimating',
      approvalMode: 'upfront' as never,
      requiresApproval: true,
      approvalStatus: 'pending',
      clientStatus: 'pending_approval',
    },
  })
  step('Команда подала оцінку $500. Клієнт ще не погодив (approvalStatus=pending).')
  const o = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  const gateBlocks = o.requiresApproval && o.approvalStatus !== 'approved'
  const canTransition = canTransitionOrder(
    OrderInternalStatus.ESTIMATING,
    OrderInternalStatus.IN_PROGRESS
  )
  kv('Перехід estimating→in_progress дозволено машиною?', canTransition ? 'так' : 'ні')
  kv('Але гейт 02-А блокує старт?', gateBlocks ? 'ТАК → 409 «оцінку ще не погоджено»' : 'ні')

  step('Клієнт погоджує, але на меншу суму (counter-offer): $500 → $450.')
  await prisma.order.update({
    where: { id: orderId },
    data: {
      approvalStatus: 'approved',
      approvalDecidedAt: new Date(),
      approvalDecidedById: creatorId,
      approvedAmount: new Prisma.Decimal(450),
      clientStatus: 'in_progress',
    },
  })
  const o2 = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  kv('Очікувано (оцінка)', money(o2.fixedPrice))
  kv('Погоджено (counter-offer)', money(o2.approvedAmount))
  kv('Гейт тепер пускає в роботу?', !(o2.requiresApproval && o2.approvalStatus !== 'approved') ? 'ТАК — старт дозволено' : 'ні')
  line('\n  → Робота стартує лише після погодження; зафіксовано, що домовились на $450.')
}

async function cleanup() {
  await prisma.serviceCharge.deleteMany({ where: { agencyId } })
  await prisma.timeLog.deleteMany({ where: { agencyId } })
  await prisma.order.deleteMany({ where: { agencyId } })
  await prisma.project.deleteMany({ where: { agencyId } })
  await prisma.company.deleteMany({ where: { agencyId } })
  await prisma.agency.deleteMany({ where: { id: agencyId } })
  await prisma.profile.deleteMany({ where: { id: creatorId } })
}

async function main() {
  h1('WORKFLO — ДЕМО СИСТЕМИ БІЛІНГУ (погодження вартості, S5.6 P-7..P-11)')
  line('  Три числа всюди: ОЧІКУВАНО (quote) → ВИСТАВЛЕНО/ПОГОДЖЕНО → СПЛАЧЕНО.')
  line('  Баланс < 0 = клієнт винен. Маржа = виставлено − собівартість (P-9).')
  await prisma.profile.create({
    data: { id: creatorId, email: `demo-${tag}@local`, passwordHash: 'x', name: 'Demo' },
  })
  await prisma.agency.create({ data: { id: agencyId, name: `demo-${tag}`, slug: `demo-${tag}` } })
  try {
    await scenarioNone()
    await scenarioOnActuals()
    await scenarioUpfront()
    h1('ГОТОВО — три режими + counter-offer відпрацювали наскрізь проти реальної БД')
  } finally {
    await cleanup()
    await prisma.$disconnect()
  }
}

main().catch(async (e) => {
  console.error('\n✗ Demo failed:', e)
  await cleanup().catch(() => {})
  await prisma.$disconnect()
  process.exit(1)
})
