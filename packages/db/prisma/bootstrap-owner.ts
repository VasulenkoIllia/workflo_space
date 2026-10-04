// bootstrap-owner.ts — first owner account for a fresh production database. The demo seed
// (seed.ts) must never run on production, so a new prod DB has no one who can log in. This
// creates ONLY the owner profile + the platform agency (via the shared provisionAgency
// factory) + notification defaults — no demo companies/orders/passwords.
//
// Run on the server (password typed, never in shell history or logs):
//   read -rs BOOTSTRAP_OWNER_PASSWORD && export BOOTSTRAP_OWNER_PASSWORD
//   docker compose --project-name workflo-production --env-file .env \
//     -f docker-compose.production.yml run --rm --no-deps \
//     -e BOOTSTRAP_OWNER_EMAIL=you@example.com -e BOOTSTRAP_OWNER_PASSWORD \
//     api pnpm --filter @workflo/db run bootstrap:owner
//
// Idempotent: an existing profile with that email is left untouched (password included).
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { provisionAgency } from '../src/provisioning'

const prisma = new PrismaClient()

// Must match the platform tenant id inserted by the S1.6 migration (see seed.ts).
const PLATFORM_AGENCY_ID = '00000000-0000-4000-8000-000000000001'
const NOTIFICATION_CATEGORIES = [
  'auth',
  'orders',
  'chat',
  'billing',
  'documents',
  'loyalty',
  'system',
] as const
const NOTIFICATION_DEFAULT_CHANNELS = ['email', 'telegram', 'in_app'] as const

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is not set`)
  return value
}

async function main() {
  const email = requireEnv('BOOTSTRAP_OWNER_EMAIL').toLowerCase()
  const password = requireEnv('BOOTSTRAP_OWNER_PASSWORD')
  if (password.length < 12)
    throw new Error('BOOTSTRAP_OWNER_PASSWORD must be at least 12 characters')
  const name = process.env.BOOTSTRAP_OWNER_NAME?.trim() || 'Owner'
  const agencyName = process.env.BOOTSTRAP_AGENCY_NAME?.trim() || 'Workflo'

  const existing = await prisma.profile.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    console.log(`Profile ${email} already exists — left unchanged.`)
    return
  }

  const otherOwner = await prisma.agencyMember.findFirst({
    where: { agencyId: PLATFORM_AGENCY_ID, role: 'owner' },
    select: { profileId: true },
  })
  if (otherOwner) {
    throw new Error('The platform agency already has an owner — refusing to create a second one')
  }

  const owner = await prisma.profile.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(password, 12),
      name,
      role: 'owner',
      language: 'uk',
      theme: 'system',
      isActive: true,
      // The owner set this address themselves on the server — no verify-email round trip.
      emailVerifiedAt: new Date(),
    },
    select: { id: true },
  })

  await provisionAgency(prisma, {
    agencyId: PLATFORM_AGENCY_ID,
    name: agencyName,
    slug: 'workflo',
    ownerProfileId: owner.id,
    subscriptionStatus: 'active',
  })

  const settings = await prisma.notificationSettings.upsert({
    where: { profileId: owner.id },
    update: {},
    create: { profileId: owner.id, language: 'uk' },
  })
  for (const category of NOTIFICATION_CATEGORIES) {
    for (const channel of NOTIFICATION_DEFAULT_CHANNELS) {
      await prisma.notificationPreference.upsert({
        where: { settingsId_category_channel: { settingsId: settings.id, category, channel } },
        update: {},
        create: { settingsId: settings.id, category, channel, enabled: true },
      })
    }
  }

  console.log(`Owner ${email} created and attached to agency "${agencyName}".`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
