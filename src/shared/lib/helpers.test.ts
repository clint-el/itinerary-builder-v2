import { describe, expect, it } from 'vitest'
import { SEED_ITINERARIES, SEED_QUOTE_GROUPS } from '@/shared/lib/catalogs'
import {
  buildItineraryRows,
  createSplitRecord,
  copyItinerary,
  depthOf,
  emptyFilters,
  filterItineraries,
  inquiryRefLabel,
  marginFromSell,
  marginPct,
  nextChildReference,
  parentReference,
  partyGuests,
  quoteGroupsTotal,
  rackOf,
  rootCpsNumber,
  sortItineraries,
  transitions,
} from '@/shared/lib/helpers'

describe('helpers', () => {
  it('computes parent reference and depth', () => {
    expect(parentReference('CPS5678')).toBeNull()
    expect(parentReference('CPS5678-1')).toBe('CPS5678')
    expect(parentReference('CPS5678-1-2')).toBe('CPS5678-1')
    expect(depthOf('CPS5678-1-2')).toBe(2)
  })

  it('extracts root CPS number ignoring split suffixes', () => {
    expect(rootCpsNumber('CPS5678')).toBe(5678)
    expect(rootCpsNumber('CPS5686-1')).toBe(5686)
    expect(rootCpsNumber('CPS5678-1-2')).toBe(5678)
  })

  it('builds hierarchical rows with collapse', () => {
    const rows = buildItineraryRows(SEED_ITINERARIES, { CPS5687: true })
    expect(rows.some((r) => r.itinerary.reference === 'CPS5687' && r.collapsed)).toBe(true)
    expect(rows.some((r) => r.itinerary.reference === 'CPS5687-1')).toBe(false)
    expect(rows.some((r) => r.itinerary.reference === 'CPS5678-1-1' && r.isSubquote)).toBe(true)
  })

  it('filters by query and status', () => {
    const f = { ...emptyFilters(), status: 'DRAFT' as const }
    const filtered = filterItineraries(SEED_ITINERARIES, 'delacroix', f)
    expect(filtered.every((it) => it.status === 'DRAFT')).toBe(true)
    expect(filtered.some((it) => it.title.toLowerCase().includes('delacroix'))).toBe(true)
  })

  it('sorts by total descending', () => {
    const sorted = sortItineraries(SEED_ITINERARIES, 'total', 'desc')
    expect(sorted[0].totalUsd).toBeGreaterThanOrEqual(sorted[1].totalUsd)
  })

  it('creates next split child reference', () => {
    expect(nextChildReference('CPS5678', SEED_ITINERARIES)).toBe('CPS5678-3')
    const split = createSplitRecord(SEED_ITINERARIES, 'CPS5678', {
      family: 'Split Family',
      ad: '2',
      ch: '1',
    })
    expect(split?.reference).toBe('CPS5678-3')
    expect(split?.status).toBe('DRAFT')
    expect(split?.title).toBe('Split Family')
  })

  it('copies itinerary with new CPS id after highest root', () => {
    const src = SEED_ITINERARIES[0]
    const copy = copyItinerary(src, SEED_ITINERARIES)
    expect(copy.id).toBe('CPS5688')
    expect(copy.title.startsWith('Copy ')).toBe(true)
    expect(copy.status).toBe('DRAFT')
  })

  it('returns lifecycle transitions, margin, and inquiry label', () => {
    expect(transitions('DRAFT')[0].to).toBe('PREPARED')
    expect(transitions('QUOTED').some((t) => t.to === 'LOST' && t.danger)).toBe(true)
    expect(inquiryRefLabel('CPS5678')).toMatch(/^HS-\d+$/)
    expect(marginPct({ totalUsd: 1300 })).toBe(23)
    expect(marginFromSell(0)).toBeNull()
    expect(rackOf(100)).toBe(130)
    expect(quoteGroupsTotal(SEED_QUOTE_GROUPS)).toBe(10200)
  })

  it('builds party guests from itinerary pax', () => {
    const it = SEED_ITINERARIES.find((x) => x.id === 'CPS5679')!
    const guests = partyGuests(it)
    expect(guests.filter((g) => g.type === 'adult')).toHaveLength(2)
    expect(guests.filter((g) => g.type === 'child' || g.type === 'youth')).toHaveLength(3)
  })
})
