import { describe, expect, it } from 'vitest'
import { applyTravelRange, defaultDraft } from '@/shared/lib/catalogs'
import type { AddedService } from '@/shared/lib/types'
import {
  canAddDraft,
  draftMissingRequirements,
  autoAssignByCapacity,
  findFlightServiceOption,
  formatFlightOptionLabel,
  isDepartDateOnFlightOptionDay,
  isDepartTimeInFlightOptionWindow,
  optionsForFlightService,
  serviceStartDate,
  sortServicesByDate,
  weekdayFromIsoDate,
} from './builderUtils'

describe('draftMissingRequirements', () => {
  it('blocks incomplete accommodation drafts', () => {
    expect(draftMissingRequirements('accommodation', defaultDraft('accommodation'))).toEqual([
      'Location',
      'Supplier',
      'Service',
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
          start: '2026-09-01',
          end: '2026-09-03',
        },
      ],
    }
    expect(draftMissingRequirements('accommodation', draft)).toEqual([])
    expect(canAddDraft('accommodation', draft)).toBe(true)
  })

  it('requires location, supplier, service and vehicle dates for transportation', () => {
    const draft = {
      ...defaultDraft('transportation'),
    }
    expect(draftMissingRequirements('transportation', draft)).toEqual([
      'Location',
      'Supplier',
      'Service',
      'Vehicle date from / date to',
    ])
  })

  it('accepts transportation with location, supplier, service and vehicle dates', () => {
    const base = defaultDraft('transportation')
    const vehicles = ((base.vehicles as { id: string }[]) || []).map((v) => ({
      ...v,
      dateFrom: '2026-09-01',
      dateTo: '2026-09-01',
    }))
    const draft = {
      ...base,
      location: 'Nairobi',
      supplier: 'Hemingways Transfers',
      service: 'JKIA to Hemingways Nairobi (3-pax)',
      vehicles,
    }
    expect(draftMissingRequirements('transportation', draft)).toEqual([])
    expect(canAddDraft('transportation', draft)).toBe(true)
  })

  it('requires at least one flight with a departure date', () => {
    const draft = {
      ...defaultDraft('flight'),
      flightFrom: 'Wilson',
      flightTo: 'Loisaba',
      supplier: 'AirKenya',
      service: 'WILSON TO LOISABA OW',
    }
    expect(draftMissingRequirements('flight', draft)).toEqual(['At least one flight'])

    const withFlight = {
      ...draft,
      flights: [
        {
          id: 'f1',
          cap: 5,
          guestIds: [],
          optionId: 'wlo-morning',
          optionName: 'Morning Flight',
          departDate: '',
          departTime: '',
        },
      ],
    }
    expect(draftMissingRequirements('flight', withFlight)).toEqual(['Departure date'])
  })
})

describe('travel window seeding', () => {
  const range = { from: '2026-09-01', to: '2026-09-10' }

  it('seeds date fields for every service tab', () => {
    expect(defaultDraft('accommodation', range)).toMatchObject({
      start: '2026-09-01',
      end: '2026-09-10',
    })
    expect(defaultDraft('transportation', range)).toMatchObject({
      transDate: '2026-09-01',
      hireStart: '2026-09-01',
      hireEnd: '2026-09-10',
      vehicles: [{ dateFrom: '2026-09-01', dateTo: '2026-09-10' }],
    })
    expect(defaultDraft('flight', range)).toMatchObject({
      departDate: '2026-09-01',
      returnDate: '2026-09-10',
    })
    expect(defaultDraft('activity', range)).toMatchObject({
      startDate: '2026-09-01',
      endDate: '2026-09-10',
    })
    expect(defaultDraft('other', range)).toMatchObject({
      startDate: '2026-09-01',
      endDate: '2026-09-10',
    })
  })

  it('only needs rooms once dates come from the travel window', () => {
    const draft = {
      ...defaultDraft('accommodation', range),
      location: 'Nairobi',
      supplier: 'Hemingways Nairobi',
      service: 'Double Suite',
    }
    expect(draftMissingRequirements('accommodation', draft)).toEqual(['At least one room'])
  })

  it('requires room stay dates when the travel window is missing', () => {
    const draft = {
      ...defaultDraft('accommodation'),
      location: 'Nairobi',
      supplier: 'Hemingways Nairobi',
      service: 'Double Suite',
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
    expect(draftMissingRequirements('accommodation', draft)).toEqual(['Room stay dates'])
  })

  it('never overwrites dates a planner already set', () => {
    const edited = applyTravelRange(
      'accommodation',
      { ...defaultDraft('accommodation'), start: '2026-09-04', end: '' },
      range,
    )
    expect(edited).toMatchObject({ start: '2026-09-04', end: '2026-09-10' })
  })

  it('leaves dates blank when the itinerary has no travel window', () => {
    expect(defaultDraft('accommodation', { from: '', to: '' })).toMatchObject({
      start: '',
      end: '',
    })
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

describe('flight service options', () => {
  it('exposes options for scheduled services and none for charter', () => {
    expect(optionsForFlightService('Scheduled Economy').length).toBeGreaterThan(0)
    expect(optionsForFlightService('WILSON TO LOISABA OW').length).toBe(2)
    expect(optionsForFlightService('Private Charter')).toEqual([])
    expect(optionsForFlightService('Shared Charter')).toEqual([])
  })

  it('validates departure time against the selected option window', () => {
    const morning = findFlightServiceOption('Scheduled Economy', 'econ-morning')
    expect(morning).toBeTruthy()
    expect(isDepartTimeInFlightOptionWindow('07:30', morning!)).toBe(true)
    expect(isDepartTimeInFlightOptionWindow('07:00', morning!)).toBe(true)
    expect(isDepartTimeInFlightOptionWindow('08:00', morning!)).toBe(true)
    expect(isDepartTimeInFlightOptionWindow('06:59', morning!)).toBe(false)
    expect(isDepartTimeInFlightOptionWindow('08:01', morning!)).toBe(false)
  })

  it('validates departure date against option operating days', () => {
    const weekdayOnly = findFlightServiceOption('SEN - SERENGETI NORTH to MANYARA', 'sen-morning')
    expect(weekdayOnly).toBeTruthy()
    // 2026-09-07 is a Monday; 2026-09-12 is a Saturday
    expect(weekdayFromIsoDate('2026-09-07')).toBe('Mon')
    expect(weekdayFromIsoDate('2026-09-12')).toBe('Sat')
    expect(isDepartDateOnFlightOptionDay('2026-09-07', weekdayOnly!)).toBe(true)
    expect(isDepartDateOnFlightOptionDay('2026-09-12', weekdayOnly!)).toBe(false)
  })

  it('formats option labels with flight number, window, and days', () => {
    const morning = findFlightServiceOption('WILSON TO LOISABA OW', 'wlo-morning')
    expect(formatFlightOptionLabel(morning!)).toBe(
      'Morning Flight — FY78787 · 7:00 AM–8:00 AM · Mon–Sun',
    )
  })
})

describe('autoAssignByCapacity', () => {
  it('clears existing assignments and fills buckets in order up to capacity', () => {
    const guests = [
      { id: 1, name: 'A', type: 'adult' as const, age: 30, resident: true },
      { id: 2, name: 'B', type: 'adult' as const, age: 30, resident: true },
      { id: 3, name: 'C', type: 'adult' as const, age: 30, resident: true },
      { id: 4, name: 'D', type: 'adult' as const, age: 30, resident: true },
    ]
    const items = [
      { id: 'a', guestIds: [9], cap: 2 },
      { id: 'b', guestIds: [8], cap: 1 },
    ]
    const next = autoAssignByCapacity(items, guests, (x) => x.cap)
    expect(next[0].guestIds).toEqual([1, 2])
    expect(next[1].guestIds).toEqual([3])
    expect(items[0].guestIds).toEqual([9])
  })
})
