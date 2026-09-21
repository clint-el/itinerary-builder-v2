import { describe, expect, it } from 'vitest'
import {
  applyVoucherLineSubmit,
  billableServices,
  cancelLine,
  confirmLine,
  evaluateTransition,
  isPricingLocked,
  isStructureLocked,
  itineraryCommercialFp,
  raiseVouchers,
  resetLine,
  roleAllowsTransition,
  supplierStatusOf,
} from '@/shared/lib/lifecycleRules'
import { payableEntityFromSupplierName } from '@/shared/lib/payableEntities'
import type { AddedService, Itinerary, ItineraryStatus } from '@/shared/lib/types'

const TEST_ENTITY = payableEntityFromSupplierName('Test Lodge').id

function svc(partial: Partial<AddedService> & Pick<AddedService, 'id'>): AddedService {
  return {
    tab: 'accommodation',
    title: 'Lodge',
    subtitle: 'Room',
    meta: '1 Jan',
    details: [],
    price: 1000,
    priceLabel: '$1,000',
    net: 700,
    rack: 1000,
    netLabel: '$700',
    rackLabel: '$1,000',
    margin: 300,
    marginPct: 30,
    marginColor: '#0B7A48',
    fg: '#059669',
    bg: '#D1FAE5',
    initial: 'A',
    expanded: true,
    draft: { supplier: 'Test Lodge', payableEntityId: TEST_ENTITY },
    lineStatus: 'New',
    supplierStatus: 'None',
    ...partial,
  }
}

function itin(partial: Partial<Itinerary> = {}): Itinerary {
  return {
    id: 'CPS9',
    reference: 'CPS9',
    itineraryRef: 'ITN-9',
    title: 'Test',
    agency: 'CPS',
    agent: '',
    safariPlanner: 'Amelia',
    destination: 'Kenya',
    travelDateFrom: '2026-08-01',
    travelDateTo: '2026-08-10',
    createdAt: '2026-01-01',
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    totalUsd: 1000,
    balanceUsd: 1000,
    updatedAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('lifecycleRules', () => {
  it('blocks Draft→Prepared without billable lines', () => {
    const gate = evaluateTransition(itin(), [], 'PREPARED', { role: 'Admin' })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.ruleId).toBe('need-billable')
  })

  it('allows Draft→Prepared with a billable line', () => {
    const gate = evaluateTransition(itin(), [svc({ id: 's1' })], 'PREPARED', { role: 'Admin' })
    expect(gate.ok).toBe(true)
  })

  it('requires matching quote fingerprint unless generating', () => {
    const services = [svc({ id: 's1' })]
    const fp = itineraryCommercialFp(services)
    const stale = evaluateTransition(
      itin({ status: 'PREPARED', quoteFingerprint: 'old' }),
      services,
      'QUOTED',
      { role: 'Admin' },
    )
    expect(stale.ok).toBe(false)
    const fresh = evaluateTransition(
      itin({ status: 'PREPARED', quoteFingerprint: fp }),
      services,
      'QUOTED',
      { role: 'Admin' },
    )
    expect(fresh.ok).toBe(true)
    const missing = evaluateTransition(itin({ status: 'PREPARED' }), services, 'QUOTED', {
      role: 'Admin',
      generating: 'quote',
    })
    expect(missing.ok).toBe(false)
  })

  it('blocks Vouchered without payment or credit terms', () => {
    const services = [svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'NeedsRequest' })]
    const gate = evaluateTransition(
      itin({ status: 'INVOICED', paymentStatus: 'UNPAID' }),
      services,
      'VOUCHERED',
      { role: 'Admin' },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.ruleId).toBe('payment-or-credit')
  })

  it('allows Vouchered with deposit paid and raises Waiting', () => {
    const services = [svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'NeedsRequest' })]
    const gate = evaluateTransition(
      itin({ status: 'INVOICED', paymentStatus: 'DEPOSIT_PAID' }),
      services,
      'VOUCHERED',
      { role: 'Admin' },
    )
    expect(gate.ok).toBe(true)
    const raised = raiseVouchers(services, itin({ status: 'INVOICED' }))
    expect(raised.supplierVouchers[TEST_ENTITY]).toBe('Raised')
    expect(supplierStatusOf(raised.services[0])).toBe('Waiting')
  })

  it('blocks Confirmed until all billable lines are Booked', () => {
    const services = [svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'Waiting' })]
    const gate = evaluateTransition(itin({ status: 'VOUCHERED' }), services, 'CONFIRMED', {
      role: 'Admin',
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.ruleId).toBe('all-booked')
  })

  it('enforces line engagement rules', () => {
    const confirmed = confirmLine(svc({ id: 's1' }))
    expect(confirmed.ok).toBe(true)
    const resetOk = resetLine(confirmed.service!)
    expect(resetOk.ok).toBe(true)

    const waiting = {
      ...confirmed.service!,
      supplierStatus: 'Waiting' as const,
    }
    expect(resetLine(waiting).ok).toBe(false)
    expect(cancelLine(waiting).ok).toBe(true)
    expect(billableServices([cancelLine(waiting).service!])).toHaveLength(0)
  })

  it('rolls up a per-line submit onto service supplierStatus and the voucher status', () => {
    const waiting = [
      svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'Waiting' }),
      svc({ id: 's2', lineStatus: 'Confirmed', supplierStatus: 'Waiting', draft: { supplier: 'Test Lodge', payableEntityId: TEST_ENTITY } }),
    ]
    const lines = [
      { lineId: 's1#0', serviceId: 's1' },
      { lineId: 's2#0', serviceId: 's2' },
    ]

    const allHeld = applyVoucherLineSubmit(
      waiting,
      { [TEST_ENTITY]: 'Raised' },
      {},
      TEST_ENTITY,
      lines,
      { 's1#0': true, 's2#0': true },
      {},
      '2026-01-01T00:00:00Z',
    )
    expect(supplierStatusOf(allHeld.services[0])).toBe('Booked')
    expect(supplierStatusOf(allHeld.services[1])).toBe('Booked')
    expect(allHeld.supplierVouchers[TEST_ENTITY]).toBe('Confirmed')

    const allRejected = applyVoucherLineSubmit(
      waiting,
      { [TEST_ENTITY]: 'Raised' },
      {},
      TEST_ENTITY,
      lines,
      { 's1#0': false, 's2#0': false },
      { 's1#0': 'Not available', 's2#0': 'Closed out' },
      '2026-01-01T00:00:00Z',
    )
    expect(supplierStatusOf(allRejected.services[0])).toBe('Rejected')
    expect(allRejected.supplierVouchers[TEST_ENTITY]).toBe('Rejected')

    const partial = applyVoucherLineSubmit(
      waiting,
      { [TEST_ENTITY]: 'Raised' },
      {},
      TEST_ENTITY,
      lines,
      { 's1#0': true, 's2#0': false },
      { 's2#0': 'Not available' },
      '2026-01-01T00:00:00Z',
    )
    expect(supplierStatusOf(partial.services[0])).toBe('Booked')
    expect(supplierStatusOf(partial.services[1])).toBe('Rejected')
    expect(partial.supplierVouchers[TEST_ENTITY]).toBe('Partial')
  })

  it('deposit guard holds a rejected line back for the planner instead of deleting or rejecting it', () => {
    const waiting = [
      svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'Waiting', depositPaid: true }),
    ]
    const lines = [{ lineId: 's1#0', serviceId: 's1', depositPaid: true }]
    const result = applyVoucherLineSubmit(
      waiting,
      { [TEST_ENTITY]: 'Raised' },
      {},
      TEST_ENTITY,
      lines,
      { 's1#0': false },
      {},
      '2026-01-01T00:00:00Z',
    )
    expect(result.voucherLineAnswers['s1#0'].outcome).toBe('deposit_held_back')
    expect(result.depositGuardLineIds).toEqual(['s1#0'])
    // Held back for the planner — never silently rejected, never removed from the itinerary.
    expect(supplierStatusOf(result.services[0])).toBe('Waiting')
    expect(result.services).toHaveLength(1)
  })

  it('blocks APPROVED→INVOICED without matching invoice fingerprint', () => {
    const services = [svc({ id: 's1' })]
    const gate = evaluateTransition(itin({ status: 'APPROVED' }), services, 'INVOICED', {
      role: 'Admin',
    })
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.ruleId).toBe('invoice-fingerprint')
  })

  it('allows APPROVED→INVOICED when generating invoice', () => {
    const services = [svc({ id: 's1' })]
    const gate = evaluateTransition(itin({ status: 'APPROVED' }), services, 'INVOICED', {
      role: 'Admin',
      generating: 'invoice',
    })
    expect(gate.ok).toBe(true)
  })

  it('blocks invoice generation when finance locked', () => {
    const services = [svc({ id: 's1' })]
    const gate = evaluateTransition(
      itin({ status: 'APPROVED', financeLocked: true }),
      services,
      'INVOICED',
      { role: 'Admin', generating: 'invoice' },
    )
    expect(gate.ok).toBe(false)
    if (!gate.ok) expect(gate.ruleId).toBe('finance-locked')
  })

  it('restricts transitions by demo role', () => {
    expect(roleAllowsTransition('Safari.Planner', 'DRAFT', 'PREPARED')).toBe(true)
    expect(roleAllowsTransition('Safari.Planner', 'VOUCHERED', 'CONFIRMED')).toBe(false)
    expect(roleAllowsTransition('Operations', 'VOUCHERED', 'CONFIRMED')).toBe(true)
    expect(roleAllowsTransition('Finance', 'APPROVED', 'INVOICED')).toBe(true)
  })

  it('locks structure from Quoted onward', () => {
    const unlocked: ItineraryStatus[] = ['DRAFT', 'PREPARED']
    const locked: ItineraryStatus[] = [
      'QUOTED',
      'APPROVED',
      'INVOICED',
      'VOUCHERED',
      'CONFIRMED',
      'TRAVEL_IN_PROGRESS',
      'COMPLETED',
      'LOST',
      'CANCELLED',
      'SUPERSEDED',
    ]
    for (const s of unlocked) expect(isStructureLocked(s)).toBe(false)
    for (const s of locked) expect(isStructureLocked(s)).toBe(true)
  })

  it('locks Stay price overrides from Invoiced onward', () => {
    const unlocked: ItineraryStatus[] = ['DRAFT', 'PREPARED', 'QUOTED', 'APPROVED']
    const locked: ItineraryStatus[] = [
      'INVOICED',
      'VOUCHERED',
      'CONFIRMED',
      'TRAVEL_IN_PROGRESS',
      'COMPLETED',
      'LOST',
      'CANCELLED',
      'SUPERSEDED',
    ]
    for (const s of unlocked) expect(isPricingLocked(s)).toBe(false)
    for (const s of locked) expect(isPricingLocked(s)).toBe(true)
  })
})
