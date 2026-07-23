import { CATALOG, SEED_ITINERARIES, SEED_QUOTE_GROUPS, TAB_META } from './catalogs'
import { nightsBetween, quoteGroupsTotal } from './helpers'
import type {
  AddedService,
  GuestDetail,
  Itinerary,
  ItineraryStatus,
  QuoteExtra,
  QuoteGroup,
  QuoteService,
} from './types'

function money(n: number) {
  return (
    '$' +
    (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

function familyName(it: Itinerary): string {
  const title = (it.title || '').replace(/^Copy\s+/i, '').trim()
  if (!title || /^untitled/i.test(title)) return 'Traveler'
  const dash = title.split(/[—–-]/)[0]?.trim()
  const family = (dash || title).replace(/\s+Family.*$/i, '').trim()
  const words = family.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return words[words.length - 1]
  return words[0] || 'Traveler'
}

function allocLabel(it: Itinerary): string {
  const parts = [
    it.adults ? `${it.adults}A` : '',
    it.children ? `${it.children}C` : '',
    it.infants ? `${it.infants}In` : '',
  ].filter(Boolean)
  return parts.join(', ') || '—'
}

function formatRange(from: string, to: string) {
  if (!from) return '—'
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number)
    return `${d} ${months[m - 1]} ${y}`
  }
  if (!to || to === from) return fmt(from)
  return `${fmt(from)} - ${fmt(to)}`
}

function midDate(from: string, to: string): string {
  if (!from) return ''
  if (!to || to === from) return from
  const a = new Date(from + 'T00:00:00').getTime()
  const b = new Date(to + 'T00:00:00').getTime()
  const mid = new Date(a + Math.round((b - a) / 2))
  const y = mid.getFullYear()
  const m = String(mid.getMonth() + 1).padStart(2, '0')
  const d = String(mid.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(iso: string, days: number): string {
  if (!iso) return ''
  const dt = new Date(iso + 'T00:00:00')
  dt.setDate(dt.getDate() + days)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

type StatusChip = {
  label: string
  color: string
  bg: string
  sub?: string
}

function statusChip(status: ItineraryStatus, holdDate?: string): StatusChip {
  if (['CONFIRMED', 'TRAVEL_IN_PROGRESS', 'COMPLETED', 'VOUCHERED'].includes(status)) {
    return { label: 'Confirmed', color: '#067A55', bg: 'rgba(0,212,146,0.14)' }
  }
  if (['QUOTED', 'APPROVED', 'INVOICED'].includes(status)) {
    return { label: 'Hold', color: '#931115', bg: '#F4E2E3', sub: holdDate }
  }
  if (['CANCELLED', 'LOST', 'SUPERSEDED'].includes(status)) {
    return { label: 'Prepared', color: '#0B69A3', bg: '#DFF2FE' }
  }
  return { label: 'Prepared', color: '#0B69A3', bg: '#DFF2FE' }
}

const LEAD_NAMES: Record<string, { first: string; last: string; salutation?: string }> = {
  CPS5678: { first: 'Apex', last: 'Tiffany', salutation: 'Mr' },
  'CPS5678-1': { first: 'Claire', last: 'Delacroix', salutation: 'Mrs' },
  'CPS5678-1-1': { first: 'Jean', last: 'Delacroix', salutation: 'Mr' },
  'CPS5678-1-2': { first: 'Marc', last: 'Delacroix', salutation: 'Mr' },
  'CPS5678-2': { first: 'Sophie', last: 'Moreau', salutation: 'Ms' },
  CPS5679: { first: 'Amara', last: 'Chen', salutation: 'Mrs' },
  CPS5680: { first: 'Daniel', last: 'Okello', salutation: 'Mr' },
  CPS5681: { first: 'Rachel', last: 'Kim', salutation: 'Ms' },
  CPS5682: { first: 'Emma', last: 'Clarke', salutation: 'Mrs' },
  CPS5683: { first: 'Noah', last: 'Kiptoo', salutation: 'Mr' },
  CPS5684: { first: 'Jane', last: 'Smith', salutation: 'Ms' },
  CPS5685: { first: 'David', last: 'Ochieng', salutation: 'Mr' },
  CPS5686: { first: 'Tom', last: 'Smith', salutation: 'Mr' },
  'CPS5686-1': { first: 'Helen', last: 'Whitfield', salutation: 'Mrs' },
  'CPS5686-2': { first: 'Chidi', last: 'Okonkwo', salutation: 'Mr' },
  'CPS5686-3': { first: 'Priya', last: 'Patel', salutation: 'Mrs' },
  CPS5687: { first: 'Oliver', last: 'Bennett', salutation: 'Mr' },
  'CPS5687-1': { first: 'Oliver', last: 'Bennett', salutation: 'Mr' },
}

const CHILD_AGES: Record<string, number[]> = {
  CPS5678: [9, 6],
  'CPS5678-1': [14, 8],
  'CPS5678-1-2': [11, 7],
  'CPS5678-2': [10],
  CPS5679: [15, 9, 6],
  CPS5685: [8],
  CPS5686: [12, 7],
  'CPS5686-1': [9],
  'CPS5686-3': [13, 5],
  CPS5687: [10, 8],
  'CPS5687-1': [10, 8],
}

/** Named guest details for every seeded itinerary. */
export function buildSeedGuests(it: Itinerary): GuestDetail[] {
  const lead = LEAD_NAMES[it.id] || {
    first: it.leadFirst || 'Lead',
    last: it.leadLast || familyName(it),
    salutation: 'Mr',
  }
  const ages = CHILD_AGES[it.id] || it.childAges || []
  const guests: GuestDetail[] = []
  const adults = it.adults ?? it.paxAdults ?? 1
  const children = it.children ?? it.paxChildren ?? 0
  const infants = it.infants ?? 0

  for (let i = 0; i < adults; i++) {
    guests.push({
      id: `${it.id}-a${i}`,
      salutation: i === 0 ? lead.salutation || 'Mr' : i % 2 === 0 ? 'Mr' : 'Mrs',
      firstName: i === 0 ? lead.first : i === 1 ? 'Alex' : `Guest`,
      lastName: lead.last,
      dob: i === 0 ? '1988-04-12' : undefined,
      ageBand: 'adult',
      age: 30 + i * 3,
      flight: i === 0 ? 'KQ100 / LHR–NBO' : '',
      dietary: i === 0 ? 'No shellfish' : '',
      preferences: i === 0 ? 'Quiet room, high floor' : '',
      note: '',
      lead: i === 0,
    })
  }

  for (let i = 0; i < children; i++) {
    const age = ages[i] ?? 8
    guests.push({
      id: `${it.id}-c${i}`,
      salutation: '',
      firstName: ['Sam', 'Mia', 'Leo', 'Ava', 'Noah'][i % 5],
      lastName: lead.last,
      ageBand: age >= 12 ? 'youth' : 'child',
      age,
      dietary: '',
      preferences: '',
      note: '',
      lead: false,
    })
  }

  for (let i = 0; i < infants; i++) {
    guests.push({
      id: `${it.id}-i${i}`,
      firstName: ['Baby', 'Infant'][i % 2],
      lastName: lead.last,
      ageBand: 'infant',
      age: 1,
      note: 'Travel cot required',
      lead: false,
    })
  }

  return guests
}

function scaleMoney(raw: string, factor: number): string {
  const n = Number(String(raw || '0').replace(/[^0-9.-]/g, '')) || 0
  const signed = n < 0
  const next = Math.round(Math.abs(n) * factor * 100) / 100
  return `${signed ? '-' : ''}${money(next)}`
}

function lodgeFor(destination: string) {
  const loc = destination || 'Kenya'
  if (/zanzibar/i.test(loc)) return { name: 'Elewana Zanzibar Beach', loc: 'Zanzibar' }
  if (/rwanda/i.test(loc)) return { name: 'Singita Mara River Tented Camp', loc: 'Rwanda' }
  if (/tanzania|serengeti/i.test(loc)) return { name: 'Four Seasons Serengeti', loc: 'Tanzania' }
  return { name: 'Hemingways Nairobi', loc: 'Kenya' }
}

function scaleQuoteTemplate(it: Itinerary, template: QuoteGroup[]): QuoteGroup[] {
  const target = Math.max(500, it.totalUsd || 5000)
  const base = quoteGroupsTotal(template) || 10200
  const factor = target / base
  const alloc = allocLabel(it)
  const holdDate = formatRange(addDays(it.travelDateFrom, -40), addDays(it.travelDateFrom, -40))
  const chip = statusChip(it.status, holdDate)
  const lodge = lodgeFor(it.destination)
  const mid = midDate(it.travelDateFrom, it.travelDateTo)
  const stayEnd = addDays(it.travelDateFrom, Math.min(3, nightsBetween(it.travelDateFrom, it.travelDateTo) || 3))
  const stayDates = formatRange(it.travelDateFrom, stayEnd)
  const midDates = formatRange(mid, addDays(mid, 1))

  return template.map((g, gi) => {
    const name =
      gi === 0
        ? lodge.name
        : gi === 3
          ? /rwanda|kenya/i.test(it.destination)
            ? 'Singita Mara River Tented Camp'
            : lodge.name
          : g.name
    const loc =
      gi === 0 ? lodge.loc : gi === 3 ? (it.destination === 'Kenya' ? 'Kenya' : g.loc || lodge.loc) : g.loc
    return {
      ...g,
      id: `${it.id}-${g.id}`,
      name,
      loc,
      services: g.services.map((sv, si) => {
        const dates =
          si === 0 && gi === 0
            ? stayDates
            : gi >= 2
              ? midDates
              : formatRange(mid, mid)
        const next: QuoteService = {
          ...sv,
          id: `${it.id}-${sv.id}`,
          dates,
          alloc: sv.alloc?.includes('C') && !(it.children || 0) ? alloc : alloc,
          statusLabel: chip.label,
          statusColor: chip.color,
          statusBg: chip.bg,
          statusSub: chip.sub,
          subtotal: scaleMoney(sv.subtotal, factor),
          extras: (sv.extras || []).map((ex): QuoteExtra => ({
            ...ex,
            dates: ex.dates ? dates : ex.dates,
            alloc: ex.alloc ? alloc : ex.alloc,
            amount: ex.amount ? scaleMoney(ex.amount, factor) : ex.amount,
            statusLabel: ex.statusLabel === 'Hold' || ex.statusLabel === 'Prepared' || ex.statusLabel === 'Confirmed'
              ? chip.label
              : ex.statusLabel,
            statusColor: ex.statusLabel ? chip.color : ex.statusColor,
            statusBg: ex.statusLabel ? chip.bg : ex.statusBg,
            statusSub: ex.statusSub ? chip.sub : ex.statusSub,
          })),
        }
        return next
      }),
    }
  })
}

/** Quote workspace groups for every seeded itinerary (scaled to its total). */
export function buildSeedQuoteGroups(it: Itinerary): QuoteGroup[] {
  // Cancelled/lost keep a thinner quote so summary still has content.
  if (it.status === 'CANCELLED' || it.status === 'LOST') {
    const thin = structuredClone(SEED_QUOTE_GROUPS).slice(0, 2)
    return scaleQuoteTemplate(it, thin)
  }
  return scaleQuoteTemplate(it, structuredClone(SEED_QUOTE_GROUPS))
}

function serviceCard(
  it: Itinerary,
  tab: AddedService['tab'],
  seq: number,
  title: string,
  subtitle: string,
  meta: string,
  price: number,
  details: { label: string; value: string }[],
  draft: Record<string, unknown>,
): AddedService {
  const t = TAB_META[tab]
  const marginPct = 23
  const margin = Math.round(price * (marginPct / 100) * 100) / 100
  return {
    id: `${it.id}-s${seq}`,
    tab,
    title,
    subtitle,
    meta,
    details,
    price,
    priceLabel: money(price),
    margin,
    marginPct,
    marginColor: '#0B7A48',
    fg: t.fg,
    bg: t.bg,
    initial: t.initial,
    expanded: seq === 1,
    draft,
  }
}

/** Builder "added services" mirrored from the itinerary destination / dates. */
export function buildSeedServices(it: Itinerary): AddedService[] {
  const lodge = lodgeFor(it.destination)
  const acc = CATALOG.accommodation.find((c) => c.location.includes(lodge.loc.split(',')[0])) ||
    CATALOG.accommodation[0]
  const transport = CATALOG.transportation[0]
  const flight = CATALOG.flight[0]
  const activity = CATALOG.activity[0]
  const nights = Math.max(1, nightsBetween(it.travelDateFrom, it.travelDateTo) || 3)
  const total = Math.max(800, it.totalUsd || 5000)
  const stayPrice = Math.round(total * 0.55)
  const transferPrice = Math.round(total * 0.18)
  const flightPrice = Math.round(total * 0.17)
  const activityPrice = Math.max(0, total - stayPrice - transferPrice - flightPrice)
  const guestIds = Array.from({ length: (it.adults || 0) + (it.children || 0) }, (_, i) => i + 1)
  const mid = midDate(it.travelDateFrom, it.travelDateTo)

  const services: AddedService[] = [
    serviceCard(
      it,
      'accommodation',
      1,
      lodge.name,
      `2 room(s) · Full Board`,
      `${nights} night(s)`,
      stayPrice,
      [
        { label: 'Location', value: lodge.loc },
        { label: 'Rooms', value: '2' },
        { label: 'Basis', value: 'Full Board' },
        { label: 'Dates', value: formatRange(it.travelDateFrom, it.travelDateTo) },
        { label: 'Guests', value: `${guestIds.length} pax` },
      ],
      {
        location: lodge.loc,
        supplier: lodge.name,
        service: acc.service,
        start: it.travelDateFrom,
        end: it.travelDateTo,
        basis: 'fb',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'Double',
            basis: 'fb',
            rate: Math.round(stayPrice / nights / 2),
            guestIds: guestIds.slice(0, Math.min(2, guestIds.length)),
            start: it.travelDateFrom,
            end: it.travelDateTo,
          },
          {
            id: 'r2',
            type: guestIds.length > 2 ? 'Twin' : 'Double',
            basis: 'fb',
            rate: Math.round(stayPrice / nights / 2),
            guestIds: guestIds.slice(2),
            start: it.travelDateFrom,
            end: it.travelDateTo,
          },
        ],
        extras: ['conservancy'],
        customExtras: [],
        promotion: 'early-bird',
        holds: [
          {
            id: 'h1',
            status: 'Held',
            price: stayPrice,
            date: formatRange(addDays(it.travelDateFrom, -30), addDays(it.travelDateFrom, -30)),
            ref: `REF-${it.id.slice(-4)}`,
            comment: 'Seeded hold',
          },
        ],
        notes: 'Seeded demo stay',
      },
    ),
    serviceCard(
      it,
      'transportation',
      2,
      transport.name,
      '1 vehicle(s)',
      `${guestIds.length} PAX`,
      transferPrice,
      [
        { label: 'Service', value: transport.service },
        { label: 'Vehicles', value: 'Land Cruiser' },
        { label: 'Dates', value: formatRange(mid, mid) },
        { label: 'Location', value: transport.location },
        { label: 'Pickup', value: 'Airstrip' },
        { label: 'Drop-off', value: lodge.name },
        { label: 'Time', value: '09:00 – 12:00' },
      ],
      {
        location: transport.location,
        supplier: transport.name,
        service: 'Airport Pick-up Transfer',
        transMode: 'transfer',
        transDate: mid,
        pickup: 'Airstrip',
        dropoff: lodge.name,
        timeFrom: '09:00',
        timeTo: '12:00',
        discount: 0,
        vehicles: [
          {
            id: 'v1',
            type: 'Land Cruiser',
            cap: 6,
            rate: transferPrice,
            guestIds,
          },
        ],
      },
    ),
  ]

  if (it.status !== 'CANCELLED') {
    services.push(
      serviceCard(
        it,
        'flight',
        3,
        flight.name,
        `${it.adults || 2} passenger(s) · qty 1`,
        'Eligible',
        flightPrice,
        [
          { label: 'Passengers', value: String((it.adults || 0) + (it.children || 0)) },
          { label: 'Qty', value: '1' },
          { label: 'Capacity', value: '12' },
        ],
        {
          location: flight.location,
          supplier: flight.name,
          service: 'Scheduled Economy',
          flightMode: 'oneway',
          departDate: mid,
          capacity: 12,
          qty: 1,
          discount: 0,
          pax: {
            adult: it.adults || 2,
            youth: 0,
            child: it.children || 0,
            infant: it.infants || 0,
          },
          rates: { adult: 180, youth: 140, child: 90, infant: 0 },
          extras: [],
          customExtras: [],
        },
      ),
      serviceCard(
        it,
        'activity',
        4,
        activity.name,
        '1 activity(ies)',
        'Sat, Sun',
        activityPrice,
        [
          { label: 'Activities', value: '1' },
          { label: 'Days', value: 'Sat, Sun' },
        ],
        {
          location: activity.location,
          supplier: activity.name,
          service: activity.service,
          startDate: mid,
          endDate: addDays(mid, 1),
          discount: 0,
          days: ['Sat', 'Sun'],
          activities: [
            {
              id: 'a1',
              name: 'Game drive',
              rate: Math.round(activityPrice / Math.max(1, guestIds.length)),
              start: mid,
              end: addDays(mid, 1),
              guestIds,
            },
          ],
        },
      ),
    )
  }

  return services
}

export function enrichSeedItinerary(it: Itinerary): Itinerary {
  const lead = LEAD_NAMES[it.id]
  const ages = CHILD_AGES[it.id] || it.childAges
  const adults = it.adults ?? 0
  const children = it.children ?? 0
  const infants = it.infants ?? 0
  return {
    ...it,
    leadFirst: it.leadFirst || lead?.first,
    leadLast: it.leadLast || lead?.last,
    childAges: ages,
    paxAdults: adults,
    paxChildren: children,
    guestsLabel:
      it.guestsLabel ||
      [adults ? `${adults} Ad` : '', children ? `${children} Ch` : '', infants ? `${infants} In` : '']
        .filter(Boolean)
        .join(' · '),
    destinations: it.destinations || (it.destination ? [it.destination] : []),
  }
}

export const SEED_ITINERARIES_FULL: Itinerary[] = SEED_ITINERARIES.map(enrichSeedItinerary)

export function buildSeedGuestsMap(): Record<string, GuestDetail[]> {
  const map: Record<string, GuestDetail[]> = {}
  for (const it of SEED_ITINERARIES_FULL) {
    map[it.id] = buildSeedGuests(it)
  }
  return map
}

export function buildSeedQuoteMap(): Record<string, QuoteGroup[]> {
  const map: Record<string, QuoteGroup[]> = {}
  for (const it of SEED_ITINERARIES_FULL) {
    map[it.id] = buildSeedQuoteGroups(it)
  }
  return map
}

export function buildSeedServicesMap(): Record<string, AddedService[]> {
  const map: Record<string, AddedService[]> = {}
  for (const it of SEED_ITINERARIES_FULL) {
    map[it.id] = buildSeedServices(it)
  }
  return map
}

/** Apply quote totals back onto itineraries while preserving paid balance. */
export function withSeedTotalsFromQuotes(itineraries: Itinerary[], quotes: Record<string, QuoteGroup[]>): Itinerary[] {
  return itineraries.map((it) => {
    const groups = quotes[it.id]
    if (!groups?.length) return it
    const total = quoteGroupsTotal(groups)
    const paid = Math.max(0, (it.totalUsd || 0) - (it.balanceUsd || 0))
    return {
      ...it,
      totalUsd: total,
      balanceUsd: Math.round((total - paid) * 100) / 100,
    }
  })
}
