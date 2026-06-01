import type { AgencySubscriptionStatus, Prisma, PrismaClient } from '@prisma/client'

type DbClient = PrismaClient | Prisma.TransactionClient

export interface ProvisionAgencyInput {
  /** Pin a fixed id (platform seed); omit to auto-generate. */
  agencyId?: string
  name: string
  slug: string
  ownerProfileId: string
  /** BillingPlan.slug to attach (resolved to planId); null/absent = no plan yet. */
  planSlug?: string | null
  /** Defaults to `active` (platform); a Phase-1 signup passes `trialing`. */
  subscriptionStatus?: AgencySubscriptionStatus
  trialEndsAt?: Date | null
  /** Team rows to ensure. Defaults to a single owner (= ownerProfileId). */
  teamMembers?: Array<{ profileId: string; role: 'owner' | 'executor' }>
}

/**
 * The single factory for tenant provisioning (SAAS.md F3). Creates/upserts an
 * `Agency` with its SaaS defaults + team membership. The seed uses it now; the
 * Phase-1 agency-signup endpoint will reuse it (just with `trialing` status +
 * default per-agency settings). Pass a tx client to enroll in a wider transaction.
 */
export async function provisionAgency(
  db: DbClient,
  input: ProvisionAgencyInput
): Promise<{ agencyId: string }> {
  let planId: string | null = null
  if (input.planSlug) {
    const plan = await db.billingPlan.findUnique({
      where: { slug: input.planSlug },
      select: { id: true },
    })
    planId = plan?.id ?? null
  }

  const agency = await db.agency.upsert({
    where: { slug: input.slug },
    update: {
      name: input.name,
      ownerId: input.ownerProfileId,
      isActive: true,
      ...(planId ? { planId } : {}),
      ...(input.subscriptionStatus ? { subscriptionStatus: input.subscriptionStatus } : {}),
      ...(input.trialEndsAt !== undefined ? { trialEndsAt: input.trialEndsAt } : {}),
    },
    create: {
      ...(input.agencyId ? { id: input.agencyId } : {}),
      name: input.name,
      slug: input.slug,
      subdomain: input.slug,
      ownerId: input.ownerProfileId,
      planId,
      subscriptionStatus: input.subscriptionStatus ?? 'active',
      trialEndsAt: input.trialEndsAt ?? null,
    },
    select: { id: true },
  })

  const members = input.teamMembers ?? [{ profileId: input.ownerProfileId, role: 'owner' as const }]
  for (const member of members) {
    await db.agencyMember.upsert({
      where: { agencyId_profileId: { agencyId: agency.id, profileId: member.profileId } },
      update: { role: member.role },
      create: { agencyId: agency.id, profileId: member.profileId, role: member.role },
    })
  }

  return { agencyId: agency.id }
}
