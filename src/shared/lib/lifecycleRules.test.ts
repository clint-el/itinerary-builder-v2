import { describe, expect, it } from 'vitest'
import {
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
  setSupplierVoucherOutcome,
  supplierStatusOf,
} from '@/shared/lib/lifecycleRules'
import type { AddedService, Itinerary, ItineraryStatus } from '@/shared/lib/types'

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
    draft: { supplier: 'Test Lodge' },
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
    const generating = evaluateTransition(itin({ status: 'PREPARED' }), services, 'QUOTED', {
      role: 'Admin',
      generating: 'quote',
    })
    expect(generating.ok).toBe(true)
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
    expect(raised.supplierVouchers['Test Lodge']).toBe('Raised')
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

  it('maps supplier confirm/reject onto Booked/Rejected', () => {
    const waiting = [
      svc({ id: 's1', lineStatus: 'Confirmed', supplierStatus: 'Waiting' }),
    ]
    const confirmed = setSupplierVoucherOutcome(waiting, { 'Test Lodge': 'Raised' }, 'Test Lodge', 'Confirmed')
    expect(supplierStatusOf(confirmed.services[0])).toBe('Booked')
    const rejected = setSupplierVoucherOutcome(waiting, { 'Test Lodge': 'Raised' }, 'Test Lodge', 'Rejected')
    expect(supplierStatusOf(rejected.services[0])).toBe('Rejected')
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
