import { describe, expect, it } from 'vitest'
import { ProjectBillingCycle, ProjectBillingModel } from '../src/enums.js'
import {
  createProjectSchema,
  defaultContractRequired,
  updateProjectSchema,
} from '../src/schemas/project.schema.js'

/** Project create/update validation + §5 contract default (PROJECTS_SPEC, P-1). */

const base = { companyId: '11111111-1111-1111-1111-111111111111', name: 'Оренда' }

describe('createProjectSchema coherence (§5)', () => {
  it('fixed_monthly_advance requires abonAmount', () => {
    expect(() =>
      createProjectSchema.parse({
        ...base,
        billingModel: ProjectBillingModel.FIXED_MONTHLY_ADVANCE,
      })
    ).toThrow()
    const ok = createProjectSchema.parse({
      ...base,
      billingModel: ProjectBillingModel.FIXED_MONTHLY_ADVANCE,
      abonAmount: 100,
    })
    expect(ok.abonAmount).toBe(100)
  })

  it('hourly_* requires clientHourlyRate', () => {
    expect(() =>
      createProjectSchema.parse({ ...base, billingModel: ProjectBillingModel.HOURLY_PREPAID })
    ).toThrow()
    expect(
      createProjectSchema.parse({
        ...base,
        billingModel: ProjectBillingModel.HOURLY_POSTPAID,
        clientHourlyRate: 30,
      }).clientHourlyRate
    ).toBe(30)
  })

  it('weekly_day_x requires cycleWeekday', () => {
    expect(() =>
      createProjectSchema.parse({
        ...base,
        billingModel: ProjectBillingModel.HOURLY_POSTPAID,
        clientHourlyRate: 30,
        billingCycle: ProjectBillingCycle.WEEKLY_DAY_X,
      })
    ).toThrow()
  })

  it('hybrid (fixed + includedHoursCap) is valid with an overage rate, invalid without', () => {
    // fixed base $500 covering 20 hours, overage at $30/h → valid hybrid config.
    expect(
      createProjectSchema.parse({
        ...base,
        billingModel: ProjectBillingModel.FIXED_MONTHLY_ADVANCE,
        abonAmount: 500,
        includedHoursCap: 20,
        clientHourlyRate: 30,
      }).includedHoursCap
    ).toBe(20)
    // cap without an overage rate → can't bill the excess → rejected.
    expect(() =>
      createProjectSchema.parse({
        ...base,
        billingModel: ProjectBillingModel.FIXED_MONTHLY_ADVANCE,
        abonAmount: 500,
        includedHoursCap: 20,
      })
    ).toThrow()
  })

  it('defaults currency to USD and uppercases input', () => {
    const p = createProjectSchema.parse({
      ...base,
      billingModel: ProjectBillingModel.HOURLY_PREPAID,
      clientHourlyRate: 30,
      currency: 'eur',
    })
    expect(p.currency).toBe('EUR')
    expect(p.billingCycle).toBe(ProjectBillingCycle.MONTHLY_DAY_N)
  })
})

describe('defaultContractRequired (§5)', () => {
  it('true for fixed_monthly_advance, false for hourly', () => {
    expect(defaultContractRequired(ProjectBillingModel.FIXED_MONTHLY_ADVANCE)).toBe(true)
    expect(defaultContractRequired(ProjectBillingModel.HOURLY_PREPAID)).toBe(false)
    expect(defaultContractRequired(ProjectBillingModel.HOURLY_POSTPAID)).toBe(false)
  })
})

describe('updateProjectSchema', () => {
  it('rejects an empty patch', () => {
    expect(() => updateProjectSchema.parse({})).toThrow()
  })

  it('rejects unknown / immutable fields (strict — no companyId/billingModel here)', () => {
    expect(() => updateProjectSchema.parse({ companyId: base.companyId })).toThrow()
    expect(() =>
      updateProjectSchema.parse({ billingModel: ProjectBillingModel.HOURLY_PREPAID })
    ).toThrow()
  })

  it('accepts a partial field change', () => {
    expect(updateProjectSchema.parse({ active: false }).active).toBe(false)
  })
})
