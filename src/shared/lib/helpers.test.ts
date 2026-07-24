import { describe, expect, it } from 'vitest'
import { SEED_ITINERARIES, SEED_QUOTE_GROUPS } from '@/shared/lib/catalogs'
import {
  _descendantsOf,
  _holdMeta,
  _itinVM,
  _serviceHolds,
  buildItineraryRows,
  createSplitRecord,
  copyItinerary,
  depthOf,
  emptyFilters,
  filterItineraries,
  inquiryRefLabel,
  isBuilderStatus,
  marginFromSell,
  marginPct,
  nextChildReference,
  openPath,
  parentReference,
  partyGuests,
  quoteGroupsTotal,
  rackOf,
  rootCpsNumber,
  sortItineraries,
  transitions,
} from '@/shared/lib/helpers'
import type { ItineraryStatus } from '@/shared/lib/types'

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

  it('routes Draft/Prepared to the Builder and everything else to Summary', () => {
    const builderStatuses: ItineraryStatus[] = ['DRAFT', 'PREPARED']
    const summaryStatuses: ItineraryStatus[] = [
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

    for (const status of builderStatuses) {
      expect(isBuilderStatus(status)).toBe(true)
      expect(openPath({ id: 'CPS1', status })).toBe('/build/CPS1')
    }
    for (const status of summaryStatuses) {
      expect(isBuilderStatus(status)).toBe(false)
      expect(openPath({ id: 'CPS1', status })).toBe('/summary/CPS1')
    }
  })

  it('gives Lost/Cancelled/Superseded a reopen transition back to Draft', () => {
    for (const status of ['LOST', 'CANCELLED', 'SUPERSEDED'] as const) {
      expect(transitions(status).some((t) => t.to === 'DRAFT')).toBe(true)
    }
  })

  it('generates deterministic service-level holds and aggregates the most urgent one', () => {
    const eligible = SEED_ITINERARIES.slice(0, 6).map((it) => ({ ...it, status: 'DRAFT' as const }))
    const generated = eligible.flatMap(_serviceHolds)
    const meta = _holdMeta(eligible)

    expect(_serviceHolds(eligible[0])).toEqual(_serviceHolds(eligible[0]))
    expect(eligible.every((it) => _serviceHolds(it).length <= 3)).toBe(true)
    expect(meta.count).toBe(generated.length)
    if (meta.hasHold) {
      expect(meta.daysLeft).toBe(Math.min(...generated.map((hold) => hold.daysLeft)))
      expect(meta.tooltip).toMatch(/^\d+ service holds?, soonest /)
    }
  })

  it('excludes finalized and inactive itineraries from hold aggregation', () => {
    const inactive = ['CONFIRMED', 'SUPERSEDED', 'LOST', 'CANCELLED'] as const
    const itineraries = inactive.map((status, index) => ({
      ...SEED_ITINERARIES[index],
      status,
    }))

    expect(_holdMeta(itineraries)).toEqual({
      hasHold: false,
      count: 0,
      daysLeft: null,
      tooltip: 'No active service holds',
    })
  })

  it('aggregates holds over every descendant in an itinerary hierarchy', () => {
    const childMap = new Map<string, typeof SEED_ITINERARIES>()
    for (const itinerary of SEED_ITINERARIES) {
      const parent = parentReference(itinerary.reference)
      if (parent) childMap.set(parent, [...(childMap.get(parent) || []), itinerary])
    }
    const root = SEED_ITINERARIES.find((it) => it.reference === 'CPS5678')!
    const descendants = _descendantsOf(root.reference, childMap)
    const vm = _itinVM(root, childMap)

    expect(descendants.map((it) => it.reference)).toEqual([
      'CPS5678-1',
      'CPS5678-1-1',
      'CPS5678-1-2',
      'CPS5678-2',
    ])
    expect(vm.hold).toEqual(_holdMeta([root, ...descendants]))
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
