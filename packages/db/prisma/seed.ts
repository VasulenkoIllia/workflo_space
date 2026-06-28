import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { provisionAgency } from '../src/provisioning.js'

const prisma = new PrismaClient()

const DEFAULT_OWNER_EMAIL = 'owner@workflo.space'
const DEFAULT_OWNER_PASSWORD = 'Admin123!'
const DEFAULT_EXECUTOR_EMAIL = 'executor@workflo.space'
const DEFAULT_EXECUTOR_PASSWORD = 'Exec123!'
const DEFAULT_CLIENT_EMAIL = 'client@example.com'
const DEFAULT_CLIENT_PASSWORD = 'Client123!'

// Multi-tenancy (ADR-004) Phase 0 — single platform tenant. Matches the fixed
// id inserted by the S1.6 migration so the seed upserts the same agency row.
const PLATFORM_AGENCY_ID = '00000000-0000-4000-8000-000000000001'

const NOTIFICATION_CATEGORIES = ['auth', 'orders', 'chat', 'billing', 'documents', 'loyalty', 'system'] as const
const NOTIFICATION_DEFAULT_CHANNELS = ['email', 'telegram', 'in_app'] as const

async function ensureNotificationSettings(profileId: string, language: 'uk' | 'en' = 'uk') {
  const settings = await prisma.notificationSettings.upsert({
    where: { profileId },
    update: { language },
    create: { profileId, language },
  })

  for (const category of NOTIFICATION_CATEGORIES) {
    for (const channel of NOTIFICATION_DEFAULT_CHANNELS) {
      await prisma.notificationPreference.upsert({
        where: {
          settingsId_category_channel: {
            settingsId: settings.id,
            category,
            channel,
          },
        },
        update: {}, // do not overwrite user choices on reseed
        create: {
          settingsId: settings.id,
          category,
          channel,
          enabled: true,
        },
      })
    }
  }

  return settings
}

async function ensurePaymentSettings(agencyId: string) {
  const existing = await prisma.paymentSettings.findFirst({ where: { agencyId } })

  if (existing) {
    return existing
  }

  return prisma.paymentSettings.create({
    data: {
      agencyId,
      bankName: 'Workflo Bank',
      iban: 'UA123456789012345678901234567',
      accountName: 'WORKFLO SPACE LLC',
      invoiceCurrency: 'UAH',
      notes: 'Manual payment settings for local dev',
    },
  })
}

async function main() {
  console.log('🌱 Seeding database...')

  const ownerEmail = process.env.SEED_OWNER_EMAIL ?? DEFAULT_OWNER_EMAIL
  const ownerPassword = process.env.SEED_OWNER_PASSWORD ?? DEFAULT_OWNER_PASSWORD
  const executorPassword = process.env.SEED_EXECUTOR_PASSWORD ?? DEFAULT_EXECUTOR_PASSWORD
  const clientPassword = process.env.SEED_CLIENT_PASSWORD ?? DEFAULT_CLIENT_PASSWORD

  const owner = await prisma.profile.upsert({
    where: { email: ownerEmail },
    update: {
      name: 'Workflo Owner',
      role: 'owner',
      language: 'uk',
      theme: 'system',
      isActive: true,
    },
    create: {
      email: ownerEmail,
      passwordHash: await bcrypt.hash(ownerPassword, 12),
      name: 'Workflo Owner',
      role: 'owner',
      language: 'uk',
      theme: 'system',
      isActive: true,
    },
  })
  console.log(`✅ Owner seeded: ${ownerEmail}`)

  const executor = await prisma.profile.upsert({
    where: { email: DEFAULT_EXECUTOR_EMAIL },
    update: {
      name: 'Петро Виконавець',
      role: 'executor',
      language: 'uk',
      theme: 'system',
      isActive: true,
    },
    create: {
      email: DEFAULT_EXECUTOR_EMAIL,
      passwordHash: await bcrypt.hash(executorPassword, 12),
      name: 'Петро Виконавець',
      role: 'executor',
      language: 'uk',
      theme: 'system',
      isActive: true,
    },
  })
  console.log(`✅ Executor seeded: ${DEFAULT_EXECUTOR_EMAIL}`)

  const clientProfile = await prisma.profile.upsert({
    where: { email: DEFAULT_CLIENT_EMAIL },
    update: {
      name: 'Іван Клієнт',
      role: 'client',
      language: 'uk',
      isActive: true,
    },
    create: {
      email: DEFAULT_CLIENT_EMAIL,
      passwordHash: await bcrypt.hash(clientPassword, 12),
      name: 'Іван Клієнт',
      role: 'client',
      language: 'uk',
      isActive: true,
    },
  })

  // Multi-tenancy (ADR-004) + SaaS (SAAS.md F3): provision the platform tenant
  // via the shared factory (the same fn a Phase-1 agency-signup will call).
  const { agencyId } = await provisionAgency(prisma, {
    agencyId: PLATFORM_AGENCY_ID,
    name: 'Workflo',
    slug: 'workflo',
    ownerProfileId: owner.id,
    subscriptionStatus: 'active',
    teamMembers: [
      { profileId: owner.id, role: 'owner' },
      { profileId: executor.id, role: 'executor' },
    ],
  })
  console.log(`✅ Agency provisioned: Workflo (owner=${ownerEmail}, +1 executor)`)

  const company = await prisma.company.upsert({
    // AR-22: company slugs are per-agency unique now.
    where: { agencyId_slug: { agencyId, slug: 'test-company' } },
    update: {
      name: 'ТОВ Тестова Компанія',
      language: 'uk',
      currency: 'USD',
      referralCode: 'workflo-TEST01',
      notes: 'Seed company',
    },
    create: {
      agencyId,
      name: 'ТОВ Тестова Компанія',
      slug: 'test-company',
      language: 'uk',
      currency: 'USD',
      referralCode: 'workflo-TEST01',
      notes: 'Seed company',
    },
  })

  await prisma.companyMember.upsert({
    where: {
      companyId_profileId: {
        companyId: company.id,
        profileId: clientProfile.id,
      },
    },
    update: {
      role: 'owner',
      permissions: {},
    },
    create: {
      companyId: company.id,
      profileId: clientProfile.id,
      role: 'owner',
      permissions: {},
    },
  })
  console.log(`✅ Company seeded: ${company.name} (${DEFAULT_CLIENT_EMAIL})`)

  await ensureNotificationSettings(owner.id, 'uk')
  await ensureNotificationSettings(executor.id, 'uk')
  await ensureNotificationSettings(clientProfile.id, 'uk')
  console.log('✅ Notification settings + default preferences initialized')

  // ExecutorRate no longer has @unique(executorId) (historical-rate windows), so
  // upsert-by-executorId is gone. Seed keeps a single current rate idempotently.
  const existingRate = await prisma.executorRate.findFirst({ where: { executorId: executor.id } })
  if (existingRate) {
    await prisma.executorRate.update({
      where: { id: existingRate.id },
      data: { monthlySalary: '1200', commissionPercent: '15', agencyId },
    })
  } else {
    await prisma.executorRate.create({
      data: { executorId: executor.id, agencyId, monthlySalary: '1200', commissionPercent: '15' },
    })
  }

  await ensurePaymentSettings(agencyId)

  await prisma.exchangeRate.upsert({
    where: { agencyId },
    update: {
      usdToUah: '41.5000',
      eurToUah: '45.2000',
      updatedBy: 'seed',
    },
    create: {
      agencyId,
      usdToUah: '41.5000',
      eurToUah: '45.2000',
      updatedBy: 'seed',
    },
  })
  console.log('✅ Exchange rates initialized')

  const plans = [
    {
      name: 'Starter',
      slug: 'starter',
      priceUsd: '49.00',
      maxOrders: 5,
      maxMembers: 1,
      features: ['5 активних замовлень', 'Email підтримка'],
    },
    {
      name: 'Professional',
      slug: 'professional',
      priceUsd: '99.00',
      maxOrders: 20,
      maxMembers: 3,
      features: ['20 замовлень', 'Пріоритетна підтримка', 'API доступ'],
    },
    {
      name: 'Business',
      slug: 'business',
      priceUsd: '199.00',
      maxOrders: null,
      maxMembers: 10,
      features: ['Необмежено замовлень', '24/7 підтримка', 'Кастомні інтеграції'],
    },
  ] as const

  for (const plan of plans) {
    await prisma.billingPlan.upsert({
      where: { slug: plan.slug },
      update: {
        name: plan.name,
        priceUsd: plan.priceUsd,
        maxOrders: plan.maxOrders,
        maxMembers: plan.maxMembers,
        features: plan.features,
        isActive: true,
      },
      create: {
        name: plan.name,
        slug: plan.slug,
        priceUsd: plan.priceUsd,
        maxOrders: plan.maxOrders,
        maxMembers: plan.maxMembers,
        features: plan.features,
      },
    })
  }
  console.log('✅ Billing plans initialized')

  const orderCount = await prisma.order.count({ where: { companyId: company.id } })

  if (orderCount === 0) {
    const seedOrders = [
      {
        title: 'Автоматизація звітності Excel',
        description: 'Побудувати pipeline збору та агрегації даних для щоденних звітів.',
        internalStatus: 'in_progress' as const,
        clientStatus: 'in_progress' as const,
        priority: 'high' as const,
        totalAmount: '500.00',
      },
      {
        title: 'Парсинг даних з сайту постачальника',
        description: 'Налаштувати стабільний scraper з щоденною синхронізацією.',
        internalStatus: 'new' as const,
        clientStatus: 'in_progress' as const,
        priority: 'medium' as const,
        totalAmount: '800.00',
      },
      {
        title: 'CRM інтеграція з 1C',
        description: 'Синхронізація контактів та угод між CRM і 1C.',
        internalStatus: 'review' as const,
        clientStatus: 'pending_approval' as const,
        priority: 'urgent' as const,
        totalAmount: '1200.00',
      },
      {
        title: 'Telegram бот для сповіщень',
        description: 'Підключити bot-notifications для подій по задачах.',
        internalStatus: 'done' as const,
        clientStatus: 'completed' as const,
        priority: 'medium' as const,
        totalAmount: '300.00',
      },
      {
        title: 'Google Sheets дашборд продажів',
        description: 'Підготувати дашборд KPI з автооновленням.',
        internalStatus: 'on_hold' as const,
        clientStatus: 'in_progress' as const,
        priority: 'low' as const,
        totalAmount: '250.00',
      },
    ]

    for (const item of seedOrders) {
      const order = await prisma.order.create({
        data: {
          title: item.title,
          description: item.description,
          type: 'client_order',
          priority: item.priority,
          agencyId,
          companyId: company.id,
          assigneeId: executor.id,
          createdById: owner.id,
          internalStatus: item.internalStatus,
          clientStatus: item.clientStatus,
          billingType: 'fixed',
          totalAmount: item.totalAmount,
          currency: 'USD',
          // fixedPrice = the agreed fixed price → a pre-work order with one can be submitted
          // for approval (team «Надіслати на погодження»). The pending_approval order also
          // gets approvalStatus=pending so the portal approval banner works on a fresh seed.
          fixedPrice: item.totalAmount,
          requiresApproval: item.clientStatus === 'pending_approval',
          approvalStatus: item.clientStatus === 'pending_approval' ? 'pending' : null,
        },
      })

      await prisma.orderStage.createMany({
        data: [
          {
            orderId: order.id,
            title: 'Бриф',
            description: 'Збір вимог',
            status: 'done',
            position: 1,
          },
          {
            orderId: order.id,
            title: 'Реалізація',
            description: 'Розробка рішення',
            status: item.internalStatus === 'done' ? 'done' : 'in_progress',
            position: 2,
          },
          {
            orderId: order.id,
            title: 'Передача',
            description: 'Фінальна передача клієнту',
            status: item.internalStatus === 'done' ? 'done' : 'pending',
            position: 3,
          },
        ],
      })
    }

    console.log('✅ Test orders initialized (5)')
  } else {
    console.log(`ℹ️ Orders already exist (${orderCount}), skipping order seed`)
  }

  // ── S5 / S5.6 sample data — so the financial / design-v2 screens aren't empty ──
  // All guarded by count() so a reseed is idempotent; only independent rows + fully
  // self-consistent invariants (bonusBalance == Σ wallet credits) are seeded. No payments /
  // charges / moneyBalance (those carry cross-row money invariants — created via the UI flow).
  const now = new Date()
  const firstOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1))
  const firstOfNextMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1))

  if ((await prisma.service.count({ where: { agencyId } })) === 0) {
    await prisma.service.createMany({
      data: [
        {
          agencyId,
          name: 'Підтримка інфраструктури',
          description: 'Моніторинг і супровід серверів',
          isRecurring: true,
          defaultPriceUsd: '300',
          estimatedHours: '8',
        },
        {
          agencyId,
          name: 'Розробка автоматизації',
          description: 'Скрипти, інтеграції, боти',
          isRecurring: false,
          defaultPriceUsd: '1500',
          estimatedHours: '40',
        },
        {
          agencyId,
          name: 'Консультація',
          description: 'Аудит і рекомендації',
          isRecurring: false,
          defaultPriceUsd: '150',
          estimatedHours: '4',
        },
      ],
    })
    console.log('✅ Services catalog seeded (3)')
  }

  if ((await prisma.project.count({ where: { agencyId } })) === 0) {
    await prisma.project.create({
      data: {
        agencyId,
        companyId: company.id,
        name: 'Абонентська підтримка',
        type: 'Підтримка',
        billingModel: 'fixed_monthly_advance',
        currency: 'USD',
        abonAmount: '300',
        billingCycle: 'monthly_day_n',
        cycleDay: 1,
        nextCycleAt: firstOfNextMonth,
        contractRequired: false,
      },
    })
    await prisma.project.create({
      data: {
        agencyId,
        companyId: company.id,
        name: 'Розробка інтеграцій',
        type: 'Розробка',
        billingModel: 'hourly_postpaid',
        currency: 'USD',
        clientHourlyRate: '35',
        billingCycle: 'monthly_day_n',
        cycleDay: 1,
        nextCycleAt: firstOfNextMonth,
      },
    })
    console.log('✅ Financial projects seeded (2)')
  }

  if ((await prisma.expense.count({ where: { agencyId } })) === 0) {
    await prisma.expense.createMany({
      data: [
        {
          agencyId,
          type: 'recurring',
          category: 'infrastructure',
          vendor: 'Hetzner',
          amount: '50',
          currency: 'USD',
          frequency: 'monthly',
          startDate: firstOfMonth,
          createdById: owner.id,
        },
        {
          agencyId,
          type: 'recurring',
          category: 'software',
          vendor: 'GitHub',
          amount: '20',
          currency: 'USD',
          frequency: 'monthly',
          startDate: firstOfMonth,
          createdById: owner.id,
        },
        {
          agencyId,
          type: 'one_time',
          category: 'marketing',
          vendor: 'Реклама',
          amount: '120',
          currency: 'USD',
          frequency: 'one_time',
          startDate: firstOfMonth,
          createdById: owner.id,
        },
      ],
    })
    console.log('✅ Expenses seeded (3)')
  }

  // A referred company + referral + matching bonus wallet credit (consistent: bonusBalance == credit).
  const partner = await prisma.company.upsert({
    where: { agencyId_slug: { agencyId, slug: 'partner-co' } },
    update: { name: 'ТОВ Партнер', referredById: company.id },
    create: {
      agencyId,
      name: 'ТОВ Партнер',
      slug: 'partner-co',
      language: 'uk',
      currency: 'USD',
      referralCode: 'workflo-PARTNER',
      referredById: company.id,
      notes: 'Seed — приведений тест-компанією',
    },
  })
  if ((await prisma.referral.count({ where: { referrerId: company.id } })) === 0) {
    await prisma.referral.create({
      data: { agencyId, referrerId: company.id, referredId: partner.id, totalEarned: '25.00' },
    })
    console.log('✅ Referral seeded (test-company → ТОВ Партнер)')
  }
  if ((await prisma.walletTransaction.count({ where: { companyId: company.id } })) === 0) {
    await prisma.walletTransaction.create({
      data: {
        agencyId,
        companyId: company.id,
        type: 'credit',
        source: 'referral_bonus',
        amount: '25.00',
        balanceAfter: '25.00',
        currency: 'USD',
        note: 'Реферальний бонус (seed)',
      },
    })
    await prisma.company.update({ where: { id: company.id }, data: { bonusBalance: '25.00' } })
    console.log('✅ Bonus wallet credit seeded ($25)')
  }

  // Blog posts (S7-02) — landing /blog reads these via the public content API. UA block content;
  // EN mirrors UA until the i18n slice. Idempotent upsert by slug. Editing = deferred CMS (S7-05).
  const blogPosts = [
    {
      slug: 'excel-to-crm-without-pain',
      type: 'article' as const,
      title: 'Як піти з Excel у власний портал — без болю',
      excerpt:
        'Excel тримає бізнес, поки не починає його гальмувати. Розбираємо, коли пора на власний інструмент і як перейти без зупинки роботи.',
      tags: ['портали', 'процеси'],
      featured: true,
      content: [
        { t: 'p', v: 'Excel — чудовий старт. Але коли в одній таблиці працює пів команди, починаються конфлікти версій, загублені рядки й «а хто це видалив?».' },
        { t: 'h2', v: 'Коли пора' },
        { t: 'ul', v: ['Більше 3 людей редагують одне й те саме щодня.', 'Дані дублюються між кількома файлами.', 'Звіти збираються руками понад годину.'] },
        { t: 'h2', v: 'Як перейти без зупинки' },
        { t: 'p', v: 'Не переписуємо все одразу. Беремо **один болючий процес**, виносимо його в портал, лишаємо Excel для решти — і мігруємо поступово.' },
        { t: 'callout', k: 'порада', v: 'Перший реліз має закрити одну конкретну біль, а не «оцифрувати все». Так команда бачить користь за тиждень, а не за квартал.' },
        { t: 'quote', v: 'За шість тижнів ми перейшли з ручної координації на повністю автоматичний цикл — і це вже не повернеться назад.', author: 'Olena B., COO Brunky' },
      ],
    },
    {
      slug: 'ai-agent-that-actually-works',
      type: 'article' as const,
      title: 'AI-агент, який реально працює, а не просто чатить',
      excerpt:
        'Різниця між демо-ботом і агентом, що закриває 90% звернень — у даних, гардах і метриках. Коротко про те, що відрізняє робоче рішення.',
      tags: ['ai', 'агенти'],
      featured: false,
      content: [
        { t: 'p', v: 'Більшість «AI-ботів» вражають на демо й розчаровують у проді: вони не знають ваших даних і впевнено вигадують.' },
        { t: 'h2', v: 'Три складові робочого агента' },
        { t: 'ul', v: ['RAG на вашій базі знань — відповіді з ваших документів, не з інтернету.', 'Гарди + ескалація до людини, коли впевненість низька.', 'Метрики: % автозакриття, точність, вартість токенів.'] },
        { t: 'h2', v: 'Що міряти' },
        { t: 'p', v: 'Без метрик агент — це віра. З метриками — це інструмент. Дивимось на auto-resolution rate і CSAT **до і після**.' },
        { t: 'callout', k: 'факт', v: 'У кейсі Tably агент закрив 92% першої відповіді й підняв CSAT на 24% — за 4 тижні.' },
      ],
    },
  ]
  for (const p of blogPosts) {
    await prisma.blogPost.upsert({
      where: { slug: p.slug },
      update: {
        type: p.type,
        titleUk: p.title,
        titleEn: p.title,
        excerptUk: p.excerpt,
        excerptEn: p.excerpt,
        contentUk: p.content,
        contentEn: p.content,
        tags: p.tags,
        featured: p.featured,
        published: true,
      },
      create: {
        slug: p.slug,
        type: p.type,
        titleUk: p.title,
        titleEn: p.title,
        excerptUk: p.excerpt,
        excerptEn: p.excerpt,
        contentUk: p.content,
        contentEn: p.content,
        tags: p.tags,
        authorId: owner.id,
        featured: p.featured,
        published: true,
        publishedAt: new Date(),
      },
    })
  }
  console.log(`✅ Blog posts seeded (${blogPosts.length})`)

  console.log('🎉 Seed completed!')
  // Never print credentials outside local/dev (avoid leaking into CI/staging logs).
  if (process.env.NODE_ENV !== 'production') {
    console.log('─────────────────────────────────────────')
    console.log('Credentials for testing:')
    console.log(`  Owner:    ${ownerEmail} / ${ownerPassword}`)
    console.log(`  Executor: ${DEFAULT_EXECUTOR_EMAIL} / ${executorPassword}`)
    console.log(`  Client:   ${DEFAULT_CLIENT_EMAIL} / ${clientPassword}`)
    console.log('  Portal:    http://localhost:3001')
    console.log('  Workspace: http://localhost:3002')
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
