import { describe, expect, it } from 'vitest'
import { buildQuoteSnapshot, nextQuoteSeq } from '@/features/quote-doc/quoteSnapshotModel'
import {
  linesForRateBasis,
  rateBasisTag,
} from '@/features/quote-doc/quoteRateBasisModel'
import { appendQuote, listQuotes } from '@/shared/lib/storage'
import type { AddedService, Itinerary } from '@/shared/lib/types'

function baseItinerary(): Itinerary {
  return {
    id: 'TEST-RB',
    reference: 'CPS8888',
    itineraryRef: 'ITN-8888',
    title: 'Rate Basis Safari',
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
  }
}

function service(id: string, rack: number, net: number): AddedService {
  return {
    id,
    tab: 'accommodation',
    title: 'Test Lodge',
    subtitle: 'Suite',
    meta: '1 Oct 2026',
    details: [],
    price: rack,
    priceLabel: `$${rack}`,
    net,
    rack,
    netLabel: `$${net}`,
    rackLabel: `$${rack}`,
    margin: rack - net,
    marginPct: 23,
    marginColor: '#0B7A48',
    fg: '#059669',
    bg: '#D1FAE5',
    initial: 'A',
    expanded: true,
    draft: {},
  }
}

describe('quoteRateBasisModel', () => {
  it('tags rack and nett PDFs correctly', () => {
    expect(rateBasisTag('rack')).toBe('All prices in USD')
    expect(rateBasisTag('nett')).toBe('All prices in USD net')
  })

  it('builds lower totals for nett than rack', () => {
    const itinerary = baseItinerary()
    const services = [service('s1', 1200, 924)]
    const rack = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
      rateBasis: 'rack',
    })
    const nett = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: 1,
      generatedBy: 'Planner',
      rateBasis: 'nett',
    })
    expect(rack.sellTotal).toBe(1200)
    expect(nett.sellTotal).toBe(924)
    expect(rack.rateBasis).toBe('rack')
    expect(nett.rateBasis).toBe('nett')
  })

  it('supports both rack and nett snapshots in one generation sequence', () => {
    localStorage.clear()
    const itinerary = baseItinerary()
    const services = [service('s1', 1200, 924)]
    const existing = listQuotes(itinerary.id)
    const rack = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: nextQuoteSeq(existing),
      generatedBy: 'Planner',
      rateBasis: 'rack',
    })
    appendQuote(rack)
    const nett = buildQuoteSnapshot({
      itinerary,
      services,
      quoteGroups: [],
      guestDetails: [],
      seq: nextQuoteSeq(listQuotes(itinerary.id)),
      generatedBy: 'Planner',
      rateBasis: 'nett',
    })
    appendQuote(nett)

    const docs = listQuotes(itinerary.id)
    expect(docs).toHaveLength(2)
    expect(docs[0].docNumber).toBe('Q1')
    expect(docs[1].docNumber).toBe('Q2')
    expect(docs[0].sellTotal).toBeGreaterThan(docs[1].sellTotal)
  })

  it('remaps line rack amounts when transforming for nett', () => {
    const lines = linesForRateBasis(
      [
        {
          type: 'accommodation',
          serviceId: 's1',
          lineId: 'l1',
          date: '2026-10-01',
          supplier: 'Lodge',
          net: 500,
          rack: 650,
          hold: 'none',
          chargePer: 'unit',
        },
      ],
      'nett',
    )
    expect(lines[0].rack).toBe(500)
  })
})
