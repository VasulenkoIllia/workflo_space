import { ApprovalMode, type InvoiceApprover } from '@workflo/types'

/**
 * Cost-approval policy resolution (P-11, PROJECTS_SPEC §8). The owner sets `approvalMode`
 * once on a cascade — Order(snapshot) → Project → Company → Agency(non-null floor) — and the
 * effective mode is resolved by "nearest explicit wins", then snapshotted onto the work/charge
 * row (immutable thereafter, like the P-4 paymentTermsDays cascade and the 02-А snapshot).
 *
 * Back-compat: the legacy `Project.requiresApproval` boolean still carries the upfront intent
 * (`true → upfront`, `false → none`) when a project has no explicit `approvalMode` yet, so
 * existing projects keep behaving exactly as before until migrated to the enum.
 */

export interface ApprovalModeContext {
  /** Explicit per-order override (only at creation); null/undefined → inherit the cascade. */
  orderOverride?: ApprovalMode | null
  /** Project tier — explicit `approvalMode`, else the legacy `requiresApproval` boolean. */
  project?: { approvalMode: ApprovalMode | null; requiresApproval: boolean | null } | null
  company?: { approvalMode: ApprovalMode | null } | null
  agencyDefault: ApprovalMode
}

/** Resolve the effective cost-approval mode by walking Order → Project → Company → Agency. */
export function resolveApprovalMode(ctx: ApprovalModeContext): ApprovalMode {
  if (ctx.orderOverride != null) return ctx.orderOverride
  if (ctx.project) {
    if (ctx.project.approvalMode != null) return ctx.project.approvalMode
    // Legacy boolean still decides when the project has no enum value yet.
    if (ctx.project.requiresApproval === true) return ApprovalMode.UPFRONT
    if (ctx.project.requiresApproval === false) return ApprovalMode.NONE
  }
  if (ctx.company?.approvalMode != null) return ctx.company.approvalMode
  return ctx.agencyDefault
}

export interface InvoiceApproverContext {
  project?: { invoiceApprover: InvoiceApprover | null } | null
  company?: { invoiceApprover: InvoiceApprover | null } | null
  agencyDefault: InvoiceApprover
}

/** Resolve who signs off an `on_actuals` charge: Project → Company → Agency floor. */
export function resolveInvoiceApprover(ctx: InvoiceApproverContext): InvoiceApprover {
  return ctx.project?.invoiceApprover ?? ctx.company?.invoiceApprover ?? ctx.agencyDefault
}
