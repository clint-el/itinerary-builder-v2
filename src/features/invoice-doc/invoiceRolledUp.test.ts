import { describe, expect, it } from 'vitest'
import { buildRolledUpRows } from '@/features/invoice-doc/invoiceRolledUpModel'
import type { SummaryLine } from '@/features/summary/summaryModel'

function line(overrides: Partial<SummaryLine> = {}): SummaryLine {
  return {
    type: 'accommodation',
    serviceId: 's1',
    lineId: 'l1',
    date: '2026-10-01',
    supplier: 'Test Lodge',
    net: 770,
    rack: 1000,
    hold: 'none',
    chargePer: 'unit',
    ...overrides,
  }
}

describe('invoiceRolledUpModel (BR-I57/BR-I56)', () => {
  it('rolls multiple dated lines for the same supplier/service into one description row', () => {
    const rows = buildRolledUpRows([
      line({ date: '2026-10-01', net: 385, rack: 500 }),
      line({ date: '2026-10-02', net: 385, rack: 500 }),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].grossPrice).toBe(1000)
    expect(rows[0].netAmount).toBe(770)
  })

  it('standard (non-TC) commission is Gross minus Net, using existing rack/net fields', () => {
    const rows = buildRolledUpRows([line({ net: 770, rack: 1000 })], false)
    expect(rows[0].commission).toBe(230)
  })

  it('omits commission (not zero) for zero-priced/complimentary lines', () => {
    const rows = buildRolledUpRows([line({ net: 0, rack: 0 })], false)
    expect(rows[0].commission).toBeUndefined()
  })

  it('Travel Counsellors mode applies a flat 6% commission and hides the underlying net cost (BR-I56)', () => {
    const rows = buildRolledUpRows([line({ net: 770, rack: 1000 })], true)
    expect(rows[0].grossPrice).toBe(1000)
    expect(rows[0].commission).toBe(60)
    expect(rows[0].netAmount).toBe(940)
  })
})
