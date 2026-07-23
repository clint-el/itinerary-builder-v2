import { beforeEach, describe, expect, it } from 'vitest'
import {
  ensureSeeded,
  getGuestDetails,
  getQuoteGroups,
  getServices,
  listItineraries,
  nextInquiryId,
  setQuoteGroups,
  setServices,
  upsertItinerary,
} from '@/shared/lib/storage'
import type { AddedService, Itinerary } from '@/shared/lib/types'

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear()
    ensureSeeded()
  })

  it('seeds itineraries on first load', () => {
    const list = listItineraries()
    expect(list.length).toBeGreaterThanOrEqual(18)
    expect(list.some((it) => it.reference === 'CPS5678-1-1')).toBe(true)
    expect(list.find((it) => it.id === 'CPS5679')?.leadFirst).toBeTruthy()
  })

  it('seeds full guest, quote, and service details for every seed itinerary', () => {
    const list = listItineraries()
    for (const it of list.filter((x) => x.id.startsWith('CPS56'))) {
      expect(getGuestDetails(it.id).length).toBeGreaterThan(0)
      expect(getQuoteGroups(it.id).length).toBeGreaterThan(0)
      expect(getServices(it.id).length).toBeGreaterThan(0)
      expect(getGuestDetails(it.id).some((g) => g.lead)).toBe(true)
    }
  })

  it('persists itinerary upserts', () => {
    const src = listItineraries()[0]
    const updated: Itinerary = { ...src, title: 'Updated Title QA' }
    upsertItinerary(updated)
    expect(listItineraries().find((it) => it.id === src.id)?.title).toBe('Updated Title QA')
  })

  it('persists services and quote groups', () => {
    const id = 'CPS5678'
    const service: AddedService = {
      id: 's1',
      tab: 'accommodation',
      title: 'Test Lodge',
      subtitle: 'Suite',
      meta: '1 Jan 2026',
      details: [{ label: 'Basis', value: 'FB' }],
      price: 1000,
      priceLabel: '$1,000.00',
      net: 770,
      rack: 1000,
      netLabel: '$770.00',
      rackLabel: '$1,000.00',
      margin: 230,
      marginPct: 23,
      marginColor: '#0B7A48',
      fg: '#059669',
      bg: '#D1FAE5',
      initial: 'A',
      expanded: true,
      draft: {},
    }
    setServices(id, [service])
    expect(getServices(id)).toHaveLength(1)
    expect(getServices(id)[0].title).toBe('Test Lodge')

    const groups = getQuoteGroups('CPS5679')
    expect(groups.length).toBeGreaterThan(0)
    setQuoteGroups(id, groups)
    expect(getQuoteGroups(id)).toHaveLength(groups.length)
  })

  it('generates next inquiry id after highest root CPS number', () => {
    const next = nextInquiryId(listItineraries())
    expect(next).toBe('CPS5688')
  })
})
