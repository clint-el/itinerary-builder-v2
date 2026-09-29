import { describe, expect, it } from 'vitest'
import {
  paymentTermsForSupplier,
  primaryPaymentTermBalanceDays,
  primaryPaymentTermPercent,
} from './supplierPaymentTerms'

describe('supplierPaymentTerms', () => {
  it('matches AndBeyond group term when travel overlaps window', () => {
    const rows = paymentTermsForSupplier('ANDBEYOND SUYIAN LODGE', '2027-06-01', '2027-06-05')
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe('Groups')
    expect(rows[0].deposit).toBe('30% on confirmation')
    expect(rows[0].balanceDue).toBe('90 days before arrival')
  })

  it('falls back to legacy deposit rule when no catalog match', () => {
    const rows = paymentTermsForSupplier('Unknown Lodge', '2027-06-01', '2027-06-05', {
      pct: 50,
      days: 14,
    })
    expect(rows[0].name).toBe('Contract default')
    expect(rows[0].deposit).toBe('50% on confirmation')
    expect(rows[0].balanceDue).toBe('14 days before arrival')
  })

  it('uses primary term for deposit math', () => {
    expect(primaryPaymentTermPercent('Four Seasons Serengeti', '2026-08-01', '2026-08-04', 35)).toBe(50)
    expect(primaryPaymentTermBalanceDays('Four Seasons Serengeti', '2026-08-01', '2026-08-04', 60)).toBe(14)
  })
})
