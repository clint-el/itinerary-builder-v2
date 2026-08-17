import { describe, expect, it } from 'vitest'
import {
  cancellationRuleCopy,
  isPolicyComplete,
  resolveCancellationPolicy,
  sortedRulesForDisplay,
  type CancellationPolicy,
  type CancellationRule,
} from './cancellationPolicy'

function rule(
  partial: Omit<CancellationRule, 'id' | 'policyId'> & { id?: string; policyId?: string },
): CancellationRule {
  return {
    id: partial.id ?? 'r1',
    policyId: partial.policyId ?? 'p1',
    starts: partial.starts,
    referenceEvent: partial.referenceEvent,
    startDay: partial.startDay,
    endDay: partial.endDay,
    penaltyValue: partial.penaltyValue,
    penaltyType: partial.penaltyType,
  }
}

describe('resolveCancellationPolicy', () => {
  it('returns none when no supplier or no intersecting Active policy', () => {
    expect(
      resolveCancellationPolicy({
        tab: 'accommodation',
        supplier: '',
        travelFrom: '2026-09-01',
        travelTo: '2026-09-05',
      }),
    ).toEqual({ kind: 'none' })
    expect(
      resolveCancellationPolicy({
        tab: 'accommodation',
        supplier: 'Unknown Lodge',
        travelFrom: '2026-09-01',
        travelTo: '2026-09-05',
      }),
    ).toEqual({ kind: 'none' })
    // Inactive-only supplier must not resolve.
    expect(
      resolveCancellationPolicy({
        tab: 'accommodation',
        supplier: "Governors' Camp",
        travelFrom: '2026-06-01',
        travelTo: '2026-06-05',
      }),
    ).toEqual({ kind: 'none' })
  })

  it('returns complete for a contiguous refundable policy', () => {
    const outcome = resolveCancellationPolicy({
      tab: 'accommodation',
      supplier: 'Hemingways Nairobi',
      travelFrom: '2026-09-01',
      travelTo: '2026-09-05',
    })
    expect(outcome.kind).toBe('complete')
    if (outcome.kind === 'complete') {
      expect(outcome.policy.id).toBe('cp-hem-nbo')
      expect(isPolicyComplete(outcome.policy)).toBe(true)
    }
  })

  it('returns non-refundable when the matched policy is not refundable', () => {
    const outcome = resolveCancellationPolicy({
      tab: 'accommodation',
      supplier: 'Hemingways Watamu',
      travelFrom: '2026-09-01',
      travelTo: '2026-09-05',
    })
    expect(outcome.kind).toBe('non-refundable')
    if (outcome.kind === 'non-refundable') {
      expect(outcome.policy.refundable).toBe(false)
    }
  })

  it('returns incomplete for the Coastal Aviation Charter gap (bands stop before day 0)', () => {
    const outcome = resolveCancellationPolicy({
      tab: 'flight',
      supplier: 'Coastal Aviation Charter',
      travelFrom: '2026-06-01',
      travelTo: '2026-06-03',
    })
    expect(outcome.kind).toBe('incomplete')
    if (outcome.kind === 'incomplete') {
      expect(outcome.policy.id).toBe('cp-coastal-charter')
      expect(isPolicyComplete(outcome.policy)).toBe(false)
    }
  })

  it('returns overlap when multiple Active policies intersect the travel window', () => {
    const outcome = resolveCancellationPolicy({
      tab: 'accommodation',
      supplier: 'Elewana Loisaba Tented Camp',
      travelFrom: '2026-08-20',
      travelTo: '2026-08-25',
    })
    expect(outcome.kind).toBe('overlap')
    if (outcome.kind === 'overlap') {
      expect(outcome.candidates.map((c) => c.id).sort()).toEqual([
        'cp-elw-lois-high',
        'cp-elw-lois-peak',
      ])
    }
  })
})

describe('isPolicyComplete', () => {
  it('accepts contiguous Travel·Before bands that end at day 0', () => {
    const policy: CancellationPolicy = {
      id: 'complete',
      name: 'Complete',
      description: '',
      refundable: true,
      status: 'Active',
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        rule({
          starts: 'Before',
          referenceEvent: 'Travel Date',
          startDay: 30,
          endDay: 15,
          penaltyValue: 50,
          penaltyType: 'Percent',
        }),
        rule({
          id: 'r2',
          starts: 'Before',
          referenceEvent: 'Travel Date',
          startDay: 14,
          endDay: 0,
          penaltyValue: 100,
          penaltyType: 'Percent',
        }),
      ],
    }
    expect(isPolicyComplete(policy)).toBe(true)
  })

  it('rejects a policy with a gap before arrival (Coastal charter shape)', () => {
    const policy: CancellationPolicy = {
      id: 'gap',
      name: 'Gap',
      description: '',
      refundable: true,
      status: 'Active',
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        rule({
          starts: 'Before',
          referenceEvent: 'Travel Date',
          startDay: 14,
          endDay: 2,
          penaltyValue: 100,
          penaltyType: 'Percent',
        }),
      ],
    }
    expect(isPolicyComplete(policy)).toBe(false)
  })
})

describe('sortedRulesForDisplay', () => {
  it('orders Booking Date rules first, then Travel Date furthest-first', () => {
    const rules = [
      rule({
        id: 't-near',
        starts: 'Before',
        referenceEvent: 'Travel Date',
        startDay: 14,
        endDay: 0,
        penaltyValue: 100,
        penaltyType: 'Percent',
      }),
      rule({
        id: 'b0',
        starts: 'After',
        referenceEvent: 'Booking Date',
        startDay: 0,
        endDay: 0,
        penaltyValue: 20,
        penaltyType: 'Percent',
      }),
      rule({
        id: 't-far',
        starts: 'Before',
        referenceEvent: 'Travel Date',
        startDay: 60,
        endDay: 31,
        penaltyValue: 50,
        penaltyType: 'Percent',
      }),
    ]
    expect(sortedRulesForDisplay(rules).map((r) => r.id)).toEqual(['b0', 't-far', 't-near'])
  })
})

describe('cancellationRuleCopy', () => {
  const bookingAfter = rule({
    starts: 'After',
    referenceEvent: 'Booking Date',
    startDay: 0,
    endDay: 0,
    penaltyValue: 20,
    penaltyType: 'Percent',
  })
  const travelBeforeMid = rule({
    starts: 'Before',
    referenceEvent: 'Travel Date',
    startDay: 60,
    endDay: 31,
    penaltyValue: 50,
    penaltyType: 'Percent',
  })
  const travelBeforeArrival = rule({
    starts: 'Before',
    referenceEvent: 'Travel Date',
    startDay: 14,
    endDay: 0,
    penaltyValue: 100,
    penaltyType: 'Percent',
  })

  it('uses DRAFT copy for Booking·After and Travel·Before shapes', () => {
    expect(cancellationRuleCopy(bookingAfter, true)).toBe(
      'Upon confirmation, 20% non-refundable deposit',
    )
    expect(cancellationRuleCopy(travelBeforeMid, true)).toBe(
      'Cancelled 60 days before arrival, 50% cancellation fee.',
    )
    expect(cancellationRuleCopy(travelBeforeArrival, true)).toBe(
      'Cancelled/reduced within 14 days of arrival, 100% cancellation fee.',
    )
  })

  it('uses neutral literal copy when the itinerary is not DRAFT', () => {
    expect(cancellationRuleCopy(bookingAfter, false)).toBe(
      'After Booking Date · day 0–0: 20% cancellation charge',
    )
    expect(cancellationRuleCopy(travelBeforeMid, false)).toBe(
      'Before Travel Date · day 60–31: 50% cancellation charge',
    )
  })
})
