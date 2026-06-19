import { ApprovalMode, InvoiceApprover } from '@workflo/types'
import { describe, expect, it } from 'vitest'
import { resolveApprovalMode, resolveInvoiceApprover } from '../src/services/approvalPolicy.js'

// P-11 (PROJECTS_SPEC §8) — cost-approval cascade: Order → Project → Company → Agency floor.
describe('resolveApprovalMode — Order → Project → Company → Agency cascade', () => {
  const agencyDefault = ApprovalMode.NONE

  it('explicit order override wins over everything', () => {
    expect(
      resolveApprovalMode({
        orderOverride: ApprovalMode.ON_ACTUALS,
        project: { approvalMode: ApprovalMode.UPFRONT, requiresApproval: null },
        company: { approvalMode: ApprovalMode.UPFRONT },
        agencyDefault,
      })
    ).toBe(ApprovalMode.ON_ACTUALS)
  })

  it('project.approvalMode wins over company and agency', () => {
    expect(
      resolveApprovalMode({
        project: { approvalMode: ApprovalMode.ON_ACTUALS, requiresApproval: null },
        company: { approvalMode: ApprovalMode.UPFRONT },
        agencyDefault,
      })
    ).toBe(ApprovalMode.ON_ACTUALS)
  })

  it('legacy project.requiresApproval=true → upfront when no enum set', () => {
    expect(
      resolveApprovalMode({
        project: { approvalMode: null, requiresApproval: true },
        company: { approvalMode: ApprovalMode.NONE },
        agencyDefault,
      })
    ).toBe(ApprovalMode.UPFRONT)
  })

  it('legacy project.requiresApproval=false → none (explicit opt-out, ignores company)', () => {
    expect(
      resolveApprovalMode({
        project: { approvalMode: null, requiresApproval: false },
        company: { approvalMode: ApprovalMode.UPFRONT },
        agencyDefault,
      })
    ).toBe(ApprovalMode.NONE)
  })

  it('project requiresApproval=null → inherit company', () => {
    expect(
      resolveApprovalMode({
        project: { approvalMode: null, requiresApproval: null },
        company: { approvalMode: ApprovalMode.ON_ACTUALS },
        agencyDefault,
      })
    ).toBe(ApprovalMode.ON_ACTUALS)
  })

  it('no project, no company → agency floor', () => {
    expect(resolveApprovalMode({ agencyDefault: ApprovalMode.UPFRONT })).toBe(ApprovalMode.UPFRONT)
  })

  it('company override applies when project absent', () => {
    expect(
      resolveApprovalMode({ company: { approvalMode: ApprovalMode.UPFRONT }, agencyDefault })
    ).toBe(ApprovalMode.UPFRONT)
  })
})

describe('resolveInvoiceApprover — Project → Company → Agency cascade', () => {
  it('project wins', () => {
    expect(
      resolveInvoiceApprover({
        project: { invoiceApprover: InvoiceApprover.INTERNAL },
        company: { invoiceApprover: InvoiceApprover.CLIENT },
        agencyDefault: InvoiceApprover.CLIENT,
      })
    ).toBe(InvoiceApprover.INTERNAL)
  })

  it('falls to company then agency', () => {
    expect(
      resolveInvoiceApprover({
        company: { invoiceApprover: InvoiceApprover.INTERNAL },
        agencyDefault: InvoiceApprover.CLIENT,
      })
    ).toBe(InvoiceApprover.INTERNAL)
    expect(resolveInvoiceApprover({ agencyDefault: InvoiceApprover.CLIENT })).toBe(
      InvoiceApprover.CLIENT
    )
  })
})
