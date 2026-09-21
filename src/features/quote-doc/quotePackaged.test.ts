import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildIncludesRows,
  buildPaymentSnapshot,
  presentationLabel,
} from '@/features/quote-doc/quotePackagedModel'
import { buildQuoteSnapshot, renderModelFromSnapshot } from '@/features/quote-doc/quoteSnapshotModel'
import { appendQuote, ensureSeeded, getItinerary, getServices, listQuotes, setServices } from '@/shared/lib/storage'
import type { AddedService, Itinerary } from '@/shared/lib/types'
import type { SummaryLine } from '@/features/summary/summaryModel'

function baseItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: 'TEST-PKG',
    reference: 'CPS9998',
    itineraryRef: 'ITN-9998',
    title: 'Packaged Safari',
    agency: 'CPS',
    agent: '',
    safariPlanner: 'Planner',
    destination: 'Kenya',
    travelDateFrom: '2026-10-01',
    travelDateTo: '2026-10-05',
    createdAt: '2026-01-01',
    status: 'PREPARED',
    paymentStatus: 'PARTIALLY_PAID',
    totalUsd: 10000,
    balanceUsd: 4000,
    updatedAt: '2026-01-01',
    adults: 2,
    children: 0,
    infants: 0,
    ...overrides,
  }
}

function service(id: string, price: number): AddedService {
  return {
    id,
    tab: 'accommodation',
    title: 'Test Lodge',
    subtitle: 'Suite',
    meta: '1 Oct 2026',
    details: [],
    price,
    priceLabel: `$${price}`,
    net: price * 0.77,
    rack: price,
    netLabel: `$${price * 0.77}`,
    rackLabel: `$${price}`,
    margin: price * 0.23,
    marginPct: 23,
    marginColor: '#0B7A48',
    fg: '#059669',
    bg: '#D1FAE5',
    initial: 'A',
    expanded: true,
    draft: { supplier: 'Test Lodge', start: '2026-10-01', end: '2026-10-03' },
  }
}

function line(date: string, supplier: string, amount: number): SummaryLine {
  return {
    type: 'accommodation',
    serviceId: `s-${supplier}`,
    lineId: `s-${supplier}`,
    date,
    supplier,
    net: amount,
    rack: amount,
    hold: 'none',
    chargePer: 'unit',
  }
}

describe('quotePackagedModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('buildIncludesRows sorts chronologically and includes zero-priced lines', () => {
    const rows = buildIncludesRows([
      line('2026-10-03', 'Later Camp', 800),
      line('2026-10-01', 'First Camp', 0),
      line('2026-10-02', 'Transfer Co', 200),
    ])
    expect(rows.map((r) => r.date)).toEqual(['01/10', '02/10', '03/10'])
    expect(rows[0].description).toContain('First Camp')
    expect(rows.every((r) => !('amount' in r))).toBe(true)
  })

  it('buildPaymentSnapshot uses itinerary totals', () => {
    const snap = buildPaymentSnapshot(baseItinerary(), 9800)
    expect(snap.totalTripCost).toBe(9800)
    expect(snap.amountPaid).toBe(6000)
    expect(snap.balanceDue).toBe(4000)
  })

  it('buildQuoteSnapshot with B2B_PACKAGED sets presentation and packaged fields', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200), service('s2', 0)]
    const doc = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
      presentation: 'B2B_PACKAGED',
    })
    expect(doc.presentation).toBe('B2B_PACKAGED')
    expect(doc.includesRows.length).toBeGreaterThan(0)
    expect(doc.paymentSnapshot.totalTripCost).toBe(doc.sellTotal)
    expect(doc.paymentSnapshot.amountPaid).toBe(6000)
  })

  it('render model for packaged snapshot has includes rows without amounts', () => {
    const doc = buildQuoteSnapshot({
      itinerary: baseItinerary(),
      services: [service('s1', 1200)],
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
      presentation: 'B2B_PACKAGED',
    })
    const model = renderModelFromSnapshot(doc, false)
    expect(model.presentation).toBe('B2B_PACKAGED')
    expect(model.includesRows.length).toBeGreaterThan(0)
    expect(model.paymentSnapshot.balanceDue).toBe(4000)
  })

  it('regenerating itemised then packaged keeps Q1 unchanged and increments seq', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200)]
    const q1 = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
      presentation: 'B2B_ITEMISED',
    })
    appendQuote(q1)

    const q2 = buildQuoteSnapshot({
      itinerary,
      services: [service('s1', 1500)],
      quoteGroups: [],
      guestDetails: [],
      seq: 2,
      generatedBy: 'Planner',
      presentation: 'B2B_PACKAGED',
    })
    appendQuote(q2)

    const docs = listQuotes(itinerary.id)
    expect(docs.map((d) => d.seq)).toEqual([1, 2])
    expect(docs[0].presentation).toBe('B2B_ITEMISED')
    expect(docs[1].presentation).toBe('B2B_PACKAGED')
    expect(docs[0].sellTotal).toBe(q1.sellTotal)
    expect(docs[1].sellTotal).toBe(q2.sellTotal)
  })

  it('payment snapshot is frozen after itinerary changes', () => {
    ensureSeeded()
    const id = 'CPS5680'
    const quotes = listQuotes(id)
    const packaged = quotes.find((q) => q.presentation === 'B2B_PACKAGED')
    expect(packaged).toBeTruthy()
    const paidBefore = packaged!.paymentSnapshot.amountPaid

    const services = getServices(id)
    setServices(id, [...services, service('extra', 500)])
    const after = listQuotes(id).find((q) => q.id === packaged!.id)
    expect(after?.paymentSnapshot.amountPaid).toBe(paidBefore)
  })

  it('seeds CPS5680 with itemised Q1 and packaged Q2', () => {
    ensureSeeded()
    const quotes = listQuotes('CPS5680')
    expect(quotes).toHaveLength(2)
    expect(quotes[0].presentation).toBe('B2B_ITEMISED')
    expect(quotes[1].presentation).toBe('B2B_PACKAGED')
    expect(getItinerary('CPS5680')?.quoteFingerprint).toBe(quotes[1].fingerprint)
  })

  it('presentationLabel maps types', () => {
    expect(presentationLabel('B2B_ITEMISED')).toBe('Itemised')
    expect(presentationLabel('B2B_PACKAGED')).toBe('Packaged')
  })
})
