import { describe, expect, it } from 'vitest'
import {
  bookingAgentBlock,
  buildLedgerOptionRows,
  buildLedgerScheduleGroups,
  fmtLedgerTravelWindow,
  documentCoverTitle,
  guestDetailLines,
  invoiceRecipientProfile,
  paxPriceSplit,
} from '@/features/quote-doc/quoteLedgerModel'
import type { SummaryLine } from '@/features/summary/summaryModel'

function accommodationLine(overrides: Partial<SummaryLine> = {}): SummaryLine {
  return {
    type: 'accommodation',
    serviceId: 's1',
    lineId: 'l1',
    date: '2026-10-01',
    supplier: 'Test Lodge',
    net: 385,
    rack: 500,
    hold: 'none',
    chargePer: 'person',
    nights: 2,
    rooms: 1,
    ...overrides,
  }
}

describe('buildLedgerScheduleGroups — Duration and Unit Price columns (BR-Q12/BR-I06, OD-27/OD-18)', () => {
  it('adds a Duration column distinct from Qty, and a Unit Price column distinct from Amount', () => {
    const [group] = buildLedgerScheduleGroups([accommodationLine({ nights: 2, rack: 500, net: 385 })])
    const [row] = group.rows
    expect(row.duration).toBe('2')
    expect(row.amount).toBe(500)
    expect(row.unitPrice).toBe(250) // 500 / 2 nights
  })

  it('single-instance services (e.g. transfers) show duration 1 rather than inventing a concept', () => {
    const transfer: SummaryLine = {
      type: 'transportation',
      kind: 'transfer',
      serviceId: 's2',
      lineId: 'l2',
      date: '2026-10-01',
      supplier: 'Transfer Co',
      net: 77,
      rack: 100,
      hold: 'none',
      chargePer: 'unit',
      veh: 1,
    }
    const [group] = buildLedgerScheduleGroups([transfer])
    expect(group.rows[0].duration).toBe('1')
    expect(group.rows[0].unitPrice).toBe(100)
  })
})

describe('paxPriceSplit (BR-Q36/BR-I58)', () => {
  it('splits each line by its own Adult/Child mix when present', () => {
    const lines: SummaryLine[] = [
      { ...accommodationLine(), ad: 2, ch: 0, rack: 800, net: 600 },
      { ...accommodationLine(), lineId: 'l2', ad: 0, ch: 1, rack: 200, net: 150 },
    ]
    const split = paxPriceSplit(lines, 2, 1)
    expect(split.totalAdults).toBe(2)
    expect(split.totalChildren).toBe(1)
    expect(split.totalAdultPrice).toBe(800)
    expect(split.totalChildPrice).toBe(200)
  })

  it('allocates lines with no per-line Ad/Ch split proportionally to the overall guest mix', () => {
    const lines: SummaryLine[] = [{ ...accommodationLine(), ad: undefined, ch: undefined, rack: 900, net: 700 }]
    const split = paxPriceSplit(lines, 2, 1) // 2 adults, 1 child => 2/3 vs 1/3
    expect(split.totalAdultPrice).toBeCloseTo(600, 2)
    expect(split.totalChildPrice).toBeCloseTo(300, 2)
  })
})

describe('guestDetailLines', () => {
  it('formats lead, adult, and child lines for guest details blocks', () => {
    const lines = guestDetailLines(
      [],
      [
        {
          id: 'g1',
          firstName: 'Apex',
          lastName: 'Tiffany',
          ageBand: 'adult',
          lead: true,
        },
        {
          id: 'g2',
          firstName: 'Alex',
          lastName: 'Tiffany',
          ageBand: 'adult',
        },
        {
          id: 'g3',
          firstName: 'Sam',
          lastName: 'Tiffany',
          ageBand: 'child',
          age: 9,
        },
      ],
    )
    expect(lines).toEqual([
      { key: 'g1', name: 'Apex Tiffany', ageBand: 'adult', age: undefined, lead: true },
      { key: 'g2', name: 'Alex Tiffany', ageBand: 'adult', age: undefined, lead: undefined },
      { key: 'g3', name: 'Sam Tiffany', ageBand: 'child', age: 9, lead: undefined },
    ])
  })
})

describe('invoiceRecipientProfile', () => {
  it('returns the agent legal entity and address for invoicing', () => {
    const profile = invoiceRecipientProfile({
      agency: 'Black Tomato',
      agent: 'Rachel Kim',
      agencyAddress: '',
    })
    expect(profile.legalName).toBe('INTRIQ JOURNEY LIMITED')
    expect(profile.addressLines[0]).toContain('SI TOI COMMERCIAL BUILDING')
  })

  it('returns Travel Counsellors head office when that mode is enabled', () => {
    const profile = invoiceRecipientProfile(
      { agency: 'Black Tomato', agent: 'Rachel Kim', agencyAddress: '' },
      true,
    )
    expect(profile.legalName).toBe('Travel Counsellors Head Office')
  })
})

describe('documentCoverTitle', () => {
  it('prefers the itinerary title over destination labels', () => {
    expect(
      documentCoverTitle({
        title: 'Families Apex, Tiffany, Zidane',
        destination: 'Tanzania',
        destinations: ['Tanzania'],
      }),
    ).toBe('Families Apex, Tiffany, Zidane')
  })
})

describe('bookingAgentBlock', () => {
  it('uses the agent name when present and prints the agency profile address', () => {
    const block = bookingAgentBlock({
      agency: 'Black Tomato',
      agent: 'Rachel Kim',
      agencyAddress: 'ignored when profile exists',
    })
    expect(block.name).toBe('Rachel Kim')
    expect(block.addressLines[0]).toBe('International Ventures')
    expect(block.addressLines).toContain('Wilton CT 06897')
  })

  it('falls back to agency name and splits a flat agencyAddress', () => {
    const block = bookingAgentBlock({
      agency: 'Custom Agency',
      agent: '',
      agencyAddress: 'Line one, Line two',
    })
    expect(block.name).toBe('Custom Agency')
    expect(block.addressLines).toEqual(['Line one', 'Line two'])
  })
})

describe('fmtLedgerTravelWindow', () => {
  it('uses consistent dd/mm/yy on both ends of the range', () => {
    expect(fmtLedgerTravelWindow('2025-01-01', '2027-12-31')).toBe('01/01/25 – 31/12/27')
  })
})

describe('buildLedgerOptionRows', () => {
  it('splits room type and meal basis into Service and Option columns', () => {
    const [row] = buildLedgerOptionRows(
      [
        accommodationLine({
          roomType: 'Double',
          basis: 'FB',
          serviceId: 'cat-four-seasons',
        }),
      ],
      [
        {
          id: 'cat-four-seasons',
          tab: 'accommodation',
          title: 'Four Seasons',
          draft: { roomType: 'double', basis: 'fb' },
        } as never,
      ],
    )
    expect(row.service).toBe('Double Room')
    expect(row.option).toBe('Full Board')
  })
})
