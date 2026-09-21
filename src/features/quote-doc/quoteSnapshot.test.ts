import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildQuoteSnapshot,
  isQuoteStale,
  nextQuoteSeq,
} from '@/features/quote-doc/quoteSnapshotModel'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import {
  appendQuote,
  ensureSeeded,
  getItinerary,
  getServices,
  listQuotes,
  setServices,
} from '@/shared/lib/storage'
import type { AddedService, Itinerary } from '@/shared/lib/types'

function baseItinerary(overrides: Partial<Itinerary> = {}): Itinerary {
  return {
    id: 'TEST1',
    reference: 'CPS9999',
    itineraryRef: 'ITN-9999',
    title: 'Test Safari',
    agency: 'CPS',
    agent: '',
    safariPlanner: 'Planner',
    destination: 'Kenya',
    travelDateFrom: '2026-10-01',
    travelDateTo: '2026-10-05',
    createdAt: '2026-01-01',
    status: 'PREPARED',
    paymentStatus: 'UNPAID',
    totalUsd: 1000,
    balanceUsd: 1000,
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
    draft: {},
  }
}

describe('quoteSnapshotModel', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('buildQuoteSnapshot freezes lines and total at generation time', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200)]
    const snap = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
    })
    expect(snap.docNumber).toBe('Q1')
    expect(snap.versionLabel).toBe('v1')
    expect(snap.sellTotal).toBeGreaterThan(0)
    expect(snap.lines.length).toBeGreaterThan(0)
    expect(snap.fingerprint).toBe(itineraryCommercialFp(services))
  })

  it('marks a quote stale when the itinerary fingerprint changes', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200)]
    const snap = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
    })
    const changed = [service('s1', 1500)]
    expect(isQuoteStale(snap, itineraryCommercialFp(changed))).toBe(true)
    expect(isQuoteStale(snap, snap.fingerprint)).toBe(false)
  })

  it('increments seq Q1 → Q2 → Q3 and keeps prior snapshots unchanged', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200)]
    const q1 = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: nextQuoteSeq([]),
      generatedBy: 'Planner',
    })
    appendQuote(q1)

    const changed = [service('s1', 1500)]
    const q2 = buildQuoteSnapshot({
      itinerary,
      services: changed,
      quoteGroups: [],
      guestDetails: [],
      seq: nextQuoteSeq(listQuotes(itinerary.id)),
      generatedBy: 'Planner',
    })
    appendQuote(q2)

    const docs = listQuotes(itinerary.id)
    expect(docs.map((d) => d.seq)).toEqual([1, 2])
    expect(q1.sellTotal).not.toBe(q2.sellTotal)
    expect(docs[0].sellTotal).toBe(q1.sellTotal)
    expect(docs[1].sellTotal).toBe(q2.sellTotal)
    expect(nextQuoteSeq(docs)).toBe(3)
  })

  it('seeds CPS5680 with itemised Q1 and packaged Q2 on first load', () => {
    ensureSeeded()
    const quotes = listQuotes('CPS5680')
    expect(quotes).toHaveLength(2)
    expect(quotes[0].docNumber).toBe('Q1')
    expect(quotes[1].docNumber).toBe('Q2')
    expect(getItinerary('CPS5680')?.quoteFingerprint).toBe(quotes[1].fingerprint)
  })

  it('does not mutate quote fingerprint when services change without generating', () => {
    ensureSeeded()
    const id = 'CPS5680'
    const before = getItinerary(id)?.quoteFingerprint
    const services = getServices(id)
    setServices(id, [...services, service('extra-line', 500)])
    const after = getItinerary(id)?.quoteFingerprint
    expect(after).toBe(before)
    expect(isQuoteStale(listQuotes(id)[0], itineraryCommercialFp(getServices(id)))).toBe(true)
  })
})
