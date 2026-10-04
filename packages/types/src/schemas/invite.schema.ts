import { z } from 'zod'

/** POST /workspace/team/invite — invite an executor (internal team member). */
export const inviteExecutorSchema = z.object({
  email: z.string().email(),
})

/** POST /company/members/invite — invite a member to a company. */
export const inviteCompanyMemberSchema = z.object({
  email: z.string().email(),
  // Optional — defaults to the caller's active company when omitted.
  companyId: z.string().uuid().optional(),
})
