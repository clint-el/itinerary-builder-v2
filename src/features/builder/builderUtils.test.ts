import { describe, expect, it } from 'vitest'
import { defaultDraft } from '@/shared/lib/catalogs'
import type { AddedService } from '@/shared/lib/types'
import {
  canAddDraft,
  draftMissingRequirements,
  serviceStartDate,
  sortServicesByDate,
} from './builderUtils'

describe('draftMissingRequirements', () => {
  it('blocks incomplete accommodation drafts', () => {
    expect(draftMissingRequirements('accommodation', defaultDraft('accommodation'))).toEqual([
      'Location',
      'Supplier',
      'Service',
      'Start date',
      'End date',
      'At least one room',
    ])
  })

  it('allows a complete accommodation draft', () => {
    const draft = {
      ...defaultDraft('accommodation'),
      location: 'Nairobi',
      supplier: 'Hemingways Nairobi',
      service: 'Double Suite',
      start: '2026-09-01',
      end: '2026-09-03',
      rooms: [
        {
          id: 'r1',
          type: 'hemingways-double-suite',
          basis: 'bb',
          rate: 150,
          qty: 1,
          guestIds: [1],
        },
      ],
    }
    expect(draftMissingRequirements('accommodation', draft)).toEqual([])
    expect(canAddDraft('accommodation', draft)).toBe(true)
  })

  it('requires transfer date and pickup/drop-off for transfers', () => {
    const draft = {
      ...defaultDraft('transportation'),
      location: 'Nairobi',
      supplier: 'Hemingways Transfers',
      service: 'JKIA to Hemingways Nairobi (3-pax)',
      transMode: 'transfer',
    }
    expect(draftMissingRequirements('transportation', draft)).toEqual([
      'Transfer date',
      'Pickup',
      'Drop-off',
    ])
  })

  it('requires start/end, vehicle and route for vehicle disposal', () => {
    const draft = {
      ...defaultDraft('transportation'),
      location: 'Nairobi',
      supplier: 'Hemingways Transfers',
      service: 'Nairobi Full Day Car Hire and Driver',
      transMode: 'hire',
      vehicles: [],
    }
    expect(draftMissingRequirements('transportation', draft)).toEqual([
      'Start date',
      'End date',
      'At least one vehicle',
      'At least one route',
    ])
  })

  it('requires departure and return dates for return flights', () => {
    const draft = {
      ...defaultDraft('flight'),
      flightFrom: 'Wilson',
      flightTo: 'Loisaba',
      supplier: 'AirKenya',
      service: 'WILSON TO LOISABA OW',
      flightMode: 'return',
      departDate: '2026-09-01',
    }
    expect(draftMissingRequirements('flight', draft)).toEqual(['Return date'])
  })
})

function svc(
  id: string,
  tab: AddedService['tab'],
  draft: Record<string, unknown>,
): AddedService {
  return { id, tab, title: id, draft } as AddedService
}

describe('serviceStartDate', () => {
  it('reads the start date for each service type', () => {
    expect(serviceStartDate(svc('a', 'accommodation', { start: '2026-09-01' }))).toBe('2026-09-01')
    expect(
      serviceStartDate(svc('t', 'transportation', { transMode: 'transfer', transDate: '2026-09-02' })),
    ).toBe('2026-09-02')
    expect(
      serviceStartDate(svc('h', 'transportation', { transMode: 'hire', hireStart: '2026-09-03' })),
    ).toBe('2026-09-03')
    expect(serviceStartDate(svc('f', 'flight', { departDate: '2026-09-04' }))).toBe('2026-09-04')
    expect(serviceStartDate(svc('o', 'other', { startDate: '2026-09-05' }))).toBe('2026-09-05')
  })

  it('falls back to the first activity date', () => {
    const service = svc('act', 'activity', {
      activities: [{ id: 'a1', name: 'Game drive', rate: 60, start: '2026-09-06', guestIds: [] }],
    })
    expect(serviceStartDate(service)).toBe('2026-09-06')
  })
})

describe('sortServicesByDate', () => {
  it('orders services chronologically regardless of insertion order', () => {
    const list = [
      svc('flight', 'flight', { departDate: '2026-09-05' }),
      svc('stay', 'accommodation', { start: '2026-09-01' }),
      svc('transfer', 'transportation', { transMode: 'transfer', transDate: '2026-09-03' }),
    ]
    expect(sortServicesByDate(list).map((s) => s.id)).toEqual(['stay', 'transfer', 'flight'])
  })

  it('puts an edited service back in date order rather than at the end', () => {
    const existing = [
      svc('stay-1', 'accommodation', { start: '2026-09-01' }),
      svc('stay-3', 'accommodation', { start: '2026-09-09' }),
    ]
    const readded = svc('stay-2', 'accommodation', { start: '2026-09-03' })
    expect(sortServicesByDate([...existing, readded]).map((s) => s.id)).toEqual([
      'stay-1',
      'stay-2',
      'stay-3',
    ])
  })

  it('keeps same-date services in their existing order and sorts dateless last', () => {
    const list = [
      svc('no-date', 'other', {}),
      svc('first', 'accommodation', { start: '2026-09-01' }),
      svc('second', 'flight', { departDate: '2026-09-01' }),
    ]
    expect(sortServicesByDate(list).map((s) => s.id)).toEqual(['first', 'second', 'no-date'])
  })
})
