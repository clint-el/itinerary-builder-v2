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
  CPS5688: { first: 'James', last: 'Harper', salutation: 'Mr' },
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
  CPS5688: [14, 8],
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
  marginPct = 23,
): AddedService {
  const t = TAB_META[tab]
  const margin = Math.round(price * (marginPct / 100) * 100) / 100
  const net = Math.round((price - margin) * 100) / 100
  return {
    id: `${it.id}-s${seq}`,
    tab,
    title,
    subtitle,
    meta,
    details,
    price,
    priceLabel: money(price),
    net,
    rack: price,
    netLabel: money(net),
    rackLabel: money(price),
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

function customExtra(
  id: string,
  title: string,
  price: number,
  opts?: { qty?: number; timeUnit?: string; qtyLabel?: string; rack?: number; pax?: number },
) {
  return {
    id,
    title,
    price,
    custom: true as const,
    qty: opts?.qty,
    timeUnit: opts?.timeUnit,
    qtyLabel: opts?.qtyLabel,
    rack: opts?.rack,
    pax: opts?.pax,
  }
}

function sellFromNet(net: number, marginPct: number) {
  if (!net) return 0
  if (marginPct <= 0) return Math.round(net * 100) / 100
  if (marginPct >= 100) return Math.round(net * 100) / 100
  return Math.round((net / (1 - marginPct / 100)) * 100) / 100
}

function accommodationSeedPrice(roomNets: number[], feeSells: number[], marginPct: number) {
  const roomsNet = roomNets.reduce((a, b) => a + b, 0)
  const feesSell = feeSells.reduce((a, b) => a + b, 0)
  return sellFromNet(roomsNet, marginPct) + feesSell
}

function blendedMarginPct(nets: number[], sells: number[]) {
  const totalNet = nets.reduce((a, b) => a + b, 0)
  const totalSell = sells.reduce((a, b) => a + b, 0)
  if (!totalSell) return 0
  return Math.round((1 - totalNet / totalSell) * 10000) / 100
}

/** Hand-authored builder services from legacy data.csv (CPS5688). */
function buildCsvSeedServices(it: Itinerary): AddedService[] {
  const guestIds = [1, 2, 3, 4]
  let seq = 0
  const next = () => ++seq

  const hxNets = [1530, 1530]
  const loisRoomNets = [3330.3, 2497.74]
  const loisFeeNets = [1080, 540]
  const loisFeeSells = [1080, 540]
  const maraRoomNets = [7759.65]
  const maraFeeNets = [1200, 300]
  const maraFeeSells = [1200, 300]
  const serRoomNets = [4977.6, 3733.2]
  const serFeeNets = [566.4, 660.8, 188.8, 94.4]
  const serFeeSells = [566.4, 660.8, sellFromNet(188.8, 2), sellFromNet(94.4, 2)]
  const manorRoomNets = [4562.8]
  const manorFeeNets = [141.6, 47.2]
  const manorFeeSells = [141.6, sellFromNet(47.2, 2)]
  const vehicleUpgradeNet = 600
  const vehicleUpgradeSell = 1000
  const balloonNet = 452.6
  const balloonSell = 620

  const loisSell = accommodationSeedPrice(loisRoomNets, loisFeeSells, 39.99)
  const maraSell =
    accommodationSeedPrice(maraRoomNets, maraFeeSells, 40) + vehicleUpgradeSell
  const serSell = accommodationSeedPrice(serRoomNets, serFeeSells, 47) + balloonSell
  const manorSell = accommodationSeedPrice(manorRoomNets, manorFeeSells, 46.99)

  return [
    serviceCard(
      it,
      'accommodation',
      next(),
      'Hemingways Nairobi',
      '2 room(s) · Bed & Breakfast',
      '2 night(s)',
      accommodationSeedPrice(hxNets, [], 30.01),
      [
        { label: 'Location', value: 'Nairobi' },
        { label: 'Rooms', value: 'Double Suite, Twin Suite' },
        { label: 'Basis', value: 'Bed & Breakfast' },
        { label: 'Dates', value: formatRange('2026-09-01', '2026-09-03') },
        { label: 'Guests', value: '4 pax' },
      ],
      {
        location: 'Nairobi',
        supplier: 'Hemingways Nairobi',
        service: 'Double Suite',
        start: '2026-09-01',
        end: '2026-09-03',
        basis: 'bb',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'hemingways-double-suite',
            basis: 'bb',
            rate: 765,
            qty: 1,
            guestIds: guestIds.slice(0, 2),
            start: '2026-09-01',
            end: '2026-09-03',
          },
          {
            id: 'r2',
            type: 'hemingways-twin-suite',
            basis: 'bb',
            rate: 765,
            qty: 1,
            guestIds: guestIds.slice(2),
            start: '2026-09-01',
            end: '2026-09-03',
          },
        ],
        extras: [],
        customExtras: [],
        promotion: 'early-bird',
        holds: [],
        notes: 'Legacy CSV seed — Nairobi arrival nights',
      },
      30.01,
    ),
    serviceCard(
      it,
      'accommodation',
      next(),
      'Elewana Loisaba Tented Camp',
      '2 room(s) · Fully Inclusive',
      '3 night(s)',
      loisSell,
      [
        { label: 'Location', value: 'Loisaba' },
        { label: 'Rooms', value: 'GPKG Double Safari Tent, GPKG CIOR' },
        { label: 'Basis', value: 'Fully Inclusive' },
        { label: 'Dates', value: formatRange('2026-09-03', '2026-09-06') },
        { label: 'Guests', value: '4 pax' },
      ],
      {
        location: 'Loisaba',
        supplier: 'Elewana Loisaba Tented Camp',
        service: 'GPKG Double Safari Tent',
        start: '2026-09-03',
        end: '2026-09-06',
        basis: 'fi',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'elewana-double-safari-tent',
            basis: 'fi',
            rate: 1110.1,
            qty: 1,
            guestIds: guestIds.slice(0, 2),
            start: '2026-09-03',
            end: '2026-09-06',
          },
          {
            id: 'r2',
            type: 'elewana-cior-two-children',
            basis: 'fi',
            rate: 832.58,
            qty: 1,
            guestIds: guestIds.slice(2),
            start: '2026-09-03',
            end: '2026-09-06',
          },
        ],
        extras: [],
        customExtras: [
          customExtra('lois-cons-adult', 'Conservancy Fees — Adult', loisFeeNets[0], {
            qty: 3,
            timeUnit: 'days',
            qtyLabel: '3 days',
            rack: loisFeeSells[0],
            pax: 2,
          }),
          customExtra('lois-cons-child', 'Conservancy Fees — Child (3 - 17.99 yrs)', loisFeeNets[1], {
            qty: 3,
            timeUnit: 'days',
            qtyLabel: '3 days',
            rack: loisFeeSells[1],
            pax: 2,
          }),
        ],
        promotion: null,
        holds: [],
        notes: '',
      },
      blendedMarginPct([...loisRoomNets, ...loisFeeNets], [
        sellFromNet(loisRoomNets[0] + loisRoomNets[1], 39.99),
        ...loisFeeSells,
      ]),
    ),
    serviceCard(
      it,
      'accommodation',
      next(),
      'Elewana Sand River Masai Mara',
      '1 room(s) · Fully Inclusive',
      '3 night(s)',
      maraSell,
      [
        { label: 'Location', value: 'Masai Mara' },
        { label: 'Rooms', value: 'GPKG Family Tent' },
        { label: 'Basis', value: 'Fully Inclusive' },
        { label: 'Dates', value: formatRange('2026-09-06', '2026-09-09') },
        { label: 'Guests', value: '4 pax' },
      ],
      {
        location: 'Masai Mara',
        supplier: 'Elewana Sand River Masai Mara',
        service: 'GPKG Family Tent',
        start: '2026-09-06',
        end: '2026-09-09',
        basis: 'fi',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'elewana-family-tent',
            basis: 'fi',
            rate: 2586.55,
            qty: 1,
            guestIds,
            start: '2026-09-06',
            end: '2026-09-09',
          },
        ],
        extras: [],
        customExtras: [
          customExtra('mara-upgrade', 'Private safari vehicle & guide upgrade', vehicleUpgradeNet, {
            qty: 3,
            timeUnit: 'days',
            qtyLabel: '3 days',
            rack: vehicleUpgradeSell,
            pax: 4,
          }),
          customExtra('mara-res-adult', 'Masai Mara National Reserve Fees — Adult', maraFeeNets[0], {
            qty: 3,
            timeUnit: 'days',
            qtyLabel: '3 days',
            rack: maraFeeSells[0],
            pax: 2,
          }),
          customExtra(
            'mara-res-child',
            'Masai Mara National Reserve Fees — Child (9 to 17.99 years)',
            maraFeeNets[1],
            {
              qty: 3,
              timeUnit: 'days',
              qtyLabel: '3 days',
              rack: maraFeeSells[1],
              pax: 2,
            },
          ),
        ],
        promotion: null,
        holds: [],
        notes: '',
      },
      blendedMarginPct([...maraRoomNets, ...maraFeeNets, vehicleUpgradeNet], [
        sellFromNet(maraRoomNets[0], 40),
        ...maraFeeSells,
        vehicleUpgradeSell,
      ]),
    ),
    serviceCard(
      it,
      'accommodation',
      next(),
      'Elewana Serengeti Migration Camp',
      '2 room(s) · Fully Inclusive',
      '4 night(s)',
      serSell,
      [
        { label: 'Location', value: 'Serengeti' },
        { label: 'Rooms', value: 'GPKG Double Safari Tent, GPKG CIOR' },
        { label: 'Basis', value: 'Fully Inclusive' },
        { label: 'Dates', value: formatRange('2026-09-09', '2026-09-13') },
        { label: 'Guests', value: '4 pax' },
      ],
      {
        location: 'Serengeti',
        supplier: 'Elewana Serengeti Migration Camp',
        service: 'GPKG Double Safari Tent',
        start: '2026-09-09',
        end: '2026-09-13',
        basis: 'fi',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'elewana-double-safari-tent',
            basis: 'fi',
            rate: 1244.4,
            qty: 1,
            guestIds: guestIds.slice(0, 2),
            start: '2026-09-09',
            end: '2026-09-13',
          },
          {
            id: 'r2',
            type: 'elewana-cior-two-children',
            basis: 'fi',
            rate: 933.3,
            qty: 1,
            guestIds: guestIds.slice(2),
            start: '2026-09-09',
            end: '2026-09-13',
          },
        ],
        extras: [],
        customExtras: [
          customExtra('ser-balloon', 'Hot-air balloon safari with bush breakfast', balloonNet, {
            qty: 1,
            timeUnit: 'flight',
            qtyLabel: '1 flight',
            rack: balloonSell,
            pax: 4,
          }),
          customExtra('ser-conc-adult', 'Concession Fee — Adult', serFeeNets[0], {
            qty: 4,
            timeUnit: 'days',
            qtyLabel: '4 days',
            rack: serFeeSells[0],
            pax: 2,
          }),
          customExtra('ser-park-adult', 'Park Fee — Adult', serFeeNets[1], {
            qty: 4,
            timeUnit: 'days',
            qtyLabel: '4 days',
            rack: serFeeSells[1],
            pax: 2,
          }),
          customExtra('ser-park-child', 'Park Fees — Child (5 to 15.99 yrs)', serFeeNets[2], {
            qty: 4,
            timeUnit: 'days',
            qtyLabel: '4 days',
            rack: serFeeSells[2],
            pax: 2,
          }),
          customExtra('ser-conc-child', 'Concession Fees — Child (5 to 15.99 yrs)', serFeeNets[3], {
            qty: 4,
            timeUnit: 'days',
            qtyLabel: '4 days',
            rack: serFeeSells[3],
            pax: 2,
          }),
        ],
        promotion: null,
        holds: [],
        notes: '',
      },
      blendedMarginPct([...serRoomNets, ...serFeeNets, balloonNet], [
        sellFromNet(serRoomNets[0] + serRoomNets[1], 47),
        ...serFeeSells,
        balloonSell,
      ]),
    ),
    serviceCard(
      it,
      'accommodation',
      next(),
      'Elewana The Manor at Ngorongoro',
      '2 room(s) · Full Board',
      '2 night(s)',
      manorSell,
      [
        { label: 'Location', value: 'Ngorongoro' },
        { label: 'Rooms', value: 'GPKG Stable Cottage' },
        { label: 'Basis', value: 'Full Board' },
        { label: 'Dates', value: formatRange('2026-09-13', '2026-09-15') },
        { label: 'Guests', value: '4 pax' },
      ],
      {
        location: 'Ngorongoro',
        supplier: 'Elewana The Manor at Ngorongoro',
        service: 'GPKG Stable Cottage',
        start: '2026-09-13',
        end: '2026-09-15',
        basis: 'fb',
        discount: 0,
        rooms: [
          {
            id: 'r1',
            type: 'elewana-stable-cottage',
            basis: 'fb',
            rate: 1140.7,
            qty: 2,
            guestIds,
            start: '2026-09-13',
            end: '2026-09-15',
          },
        ],
        extras: [],
        customExtras: [
          customExtra('manor-ncca-adult', 'NCCA Park Fees — Adult', manorFeeNets[0], {
            qty: 2,
            timeUnit: 'days',
            qtyLabel: '2 days',
            rack: manorFeeSells[0],
            pax: 2,
          }),
          customExtra('manor-ncca-child', 'NCCA Park Fees — Child (5 to 15.99 yrs)', manorFeeNets[1], {
            qty: 2,
            timeUnit: 'days',
            qtyLabel: '2 days',
            rack: manorFeeSells[1],
            pax: 2,
          }),
        ],
        promotion: null,
        holds: [],
        notes: '',
      },
      blendedMarginPct([...manorRoomNets, ...manorFeeNets], [
        sellFromNet(manorRoomNets[0], 46.99),
        ...manorFeeSells,
      ]),
    ),
    serviceCard(
      it,
      'transportation',
      next(),
      'Cheli & Peacock Safaris Nairobi',
      '1 vehicle(s)',
      '4 PAX',
      sellFromNet(50, 72.22),
      [
        { label: 'Service', value: 'Nairobi One Way Transfer' },
        { label: 'Vehicles', value: 'Sedan' },
        { label: 'Date', value: formatRange('2026-09-01', '2026-09-01') },
      ],
      {
        location: 'Nairobi',
        supplier: 'Cheli & Peacock Safaris Nairobi',
        service: 'Nairobi One Way Transfer',
        transMode: 'transfer',
        transDate: '2026-09-01',
        hireStart: '',
        hireEnd: '',
        pickup: 'JKIA',
        dropoff: 'Hemingways Nairobi',
        timeFrom: '10:00',
        timeTo: '11:30',
        discount: 0,
        vehicles: [{ id: 'v1', type: 'Sedan', cap: 4, rate: 50, guestIds }],
        extras: [],
        customExtras: [],
      },
      72.22,
    ),
    serviceCard(
      it,
      'transportation',
      next(),
      'Cheli & Peacock Safaris Nairobi',
      '1 vehicle(s)',
      '4 PAX',
      sellFromNet(250, 40.48),
      [
        { label: 'Service', value: 'Nairobi Full Day Car Hire and Driver' },
        { label: 'Vehicles', value: 'Safari Vehicle' },
        { label: 'Date', value: formatRange('2026-09-02', '2026-09-02') },
      ],
      {
        location: 'Nairobi',
        supplier: 'Cheli & Peacock Safaris Nairobi',
        service: 'Nairobi Full Day Car Hire and Driver',
        transMode: 'hire',
        transDate: '',
        hireStart: '2026-09-02',
        hireEnd: '2026-09-02',
        pickup: 'Hemingways Nairobi',
        dropoff: 'Hemingways Nairobi',
        timeFrom: '08:00',
        timeTo: '17:00',
        discount: 0,
        vehicles: [{ id: 'v1', type: 'Safari Vehicle', cap: 6, rate: 250, guestIds }],
        extras: [],
        customExtras: [],
      },
      40.48,
    ),
    serviceCard(
      it,
      'transportation',
      next(),
      'Cheli & Peacock Safaris Nairobi',
      '1 vehicle(s)',
      '4 PAX',
      sellFromNet(50, 72.22),
      [
        { label: 'Service', value: 'Nairobi One Way Transfer' },
        { label: 'Vehicles', value: 'Sedan' },
        { label: 'Date', value: formatRange('2026-09-03', '2026-09-03') },
      ],
      {
        location: 'Nairobi',
        supplier: 'Cheli & Peacock Safaris Nairobi',
        service: 'Nairobi One Way Transfer',
        transMode: 'transfer',
        transDate: '2026-09-03',
        hireStart: '',
        hireEnd: '',
        pickup: 'Hemingways Nairobi',
        dropoff: 'Wilson Airport',
        timeFrom: '07:00',
        timeTo: '08:00',
        discount: 0,
        vehicles: [{ id: 'v1', type: 'Sedan', cap: 4, rate: 50, guestIds }],
        extras: [],
        customExtras: [],
      },
      72.22,
    ),
    serviceCard(
      it,
      'flight',
      next(),
      'AirKenya Wilson1',
      'WILSON TO LOISABA OW',
      '4 PAX',
      sellFromNet(534.5, 27.96) + sellFromNet(267.25, 28),
      [
        { label: 'Service', value: 'WILSON TO LOISABA OW' },
        { label: 'Date', value: formatRange('2026-09-03', '2026-09-03') },
        { label: 'Pax', value: '2A, 2Y' },
      ],
      {
        location: 'Nairobi',
        supplier: 'AirKenya Wilson1',
        service: 'WILSON TO LOISABA OW',
        flightMode: 'oneway',
        departDate: '2026-09-03',
        returnDate: '',
        capacity: 12,
        qty: 1,
        discount: 0,
        pax: { adult: 2, youth: 2, child: 0, infant: 0 },
        rates: { adult: 267.25, youth: 133.625, child: 0, infant: 0 },
        fareLines: [
          { route: 'WIL – LOI', pax: 2, net: 534.5, rack: sellFromNet(534.5, 27.96) },
          { route: 'WIL – LOI (teens)', pax: 2, net: 267.25, rack: sellFromNet(267.25, 28) },
        ],
        extras: [],
        customExtras: [],
        promotion: null,
      },
      27.96,
    ),
    serviceCard(
      it,
      'flight',
      next(),
      'AirKenya Central Kenya1',
      'LOISABA TO MARA OW',
      '4 PAX',
      sellFromNet(855.8, 27.96) + sellFromNet(427.9, 28),
      [
        { label: 'Service', value: 'LOISABA TO MARA OW' },
        { label: 'Date', value: formatRange('2026-09-06', '2026-09-06') },
        { label: 'Pax', value: '2A, 2Y' },
      ],
      {
        location: 'Loisaba',
        supplier: 'AirKenya Central Kenya1',
        service: 'LOISABA TO MARA OW',
        flightMode: 'oneway',
        departDate: '2026-09-06',
        returnDate: '',
        capacity: 12,
        qty: 1,
        discount: 0,
        pax: { adult: 2, youth: 2, child: 0, infant: 0 },
        rates: { adult: 427.9, youth: 213.95, child: 0, infant: 0 },
        fareLines: [
          { route: 'LOI – MRE', pax: 2, net: 855.8, rack: sellFromNet(855.8, 27.96) },
          { route: 'LOI – MRE (teens)', pax: 2, net: 427.9, rack: sellFromNet(427.9, 28) },
        ],
        extras: [],
        customExtras: [],
        promotion: null,
      },
      27.96,
    ),
    serviceCard(
      it,
      'flight',
      next(),
      'AirKenya Mara1',
      'MARA TO KOGATENDE OW',
      '4 PAX',
      sellFromNet(1275.8, 28) + sellFromNet(637.9, 28),
      [
        { label: 'Service', value: 'MARA TO KOGATENDE OW' },
        { label: 'Date', value: formatRange('2026-09-09', '2026-09-09') },
        { label: 'Pax', value: '2A, 2Y' },
      ],
      {
        location: 'Masai Mara',
        supplier: 'AirKenya Mara1',
        service: 'MARA TO KOGATENDE OW',
        flightMode: 'oneway',
        departDate: '2026-09-09',
        returnDate: '',
        capacity: 12,
        qty: 1,
        discount: 0,
        pax: { adult: 2, youth: 2, child: 0, infant: 0 },
        rates: { adult: 637.9, youth: 318.95, child: 0, infant: 0 },
        fareLines: [
          { route: 'MRE – KTD', pax: 2, net: 1275.8, rack: sellFromNet(1275.8, 28) },
          { route: 'MRE – KTD (teens)', pax: 2, net: 637.9, rack: sellFromNet(637.9, 28) },
        ],
        extras: [],
        customExtras: [],
        promotion: null,
      },
      28,
    ),
    serviceCard(
      it,
      'flight',
      next(),
      'Auric Air Serengeti1',
      'SEN - SERENGETI NORTH to MANYARA',
      '4 PAX',
      sellFromNet(465, 25) + sellFromNet(232.5, 25),
      [
        { label: 'Service', value: 'SEN - SERENGETI NORTH to MANYARA' },
        { label: 'Date', value: formatRange('2026-09-13', '2026-09-13') },
        { label: 'Pax', value: '2A, 2Y' },
      ],
      {
        location: 'Serengeti',
        supplier: 'Auric Air Serengeti1',
        service: 'SEN - SERENGETI NORTH to MANYARA',
        flightMode: 'oneway',
        departDate: '2026-09-13',
        returnDate: '',
        capacity: 12,
        qty: 1,
        discount: 0,
        pax: { adult: 2, youth: 2, child: 0, infant: 0 },
        rates: { adult: 232.5, youth: 116.25, child: 0, infant: 0 },
        fareLines: [
          { route: 'SEN – LKY', pax: 2, net: 465, rack: sellFromNet(465, 25) },
          { route: 'SEN – LKY (teens)', pax: 2, net: 232.5, rack: sellFromNet(232.5, 25) },
        ],
        extras: [],
        customExtras: [],
        promotion: null,
      },
      25,
    ),
    serviceCard(
      it,
      'flight',
      next(),
      'Auric Air Manyara1',
      'MANYARA to KILIMANJARO',
      '4 PAX',
      sellFromNet(329, 24.89) + sellFromNet(164.5, 25),
      [
        { label: 'Service', value: 'MANYARA to KILIMANJARO' },
        { label: 'Date', value: formatRange('2026-09-15', '2026-09-15') },
        { label: 'Pax', value: '2A, 2Y' },
      ],
      {
        location: 'Ngorongoro',
        supplier: 'Auric Air Manyara1',
        service: 'MANYARA to KILIMANJARO',
        flightMode: 'oneway',
        departDate: '2026-09-15',
        returnDate: '',
        capacity: 12,
        qty: 1,
        discount: 0,
        pax: { adult: 2, youth: 2, child: 0, infant: 0 },
        rates: { adult: 164.5, youth: 82.25, child: 0, infant: 0 },
        fareLines: [
          { route: 'LKY – JRO', pax: 2, net: 329, rack: sellFromNet(329, 24.89) },
          { route: 'LKY – JRO (teens)', pax: 2, net: 164.5, rack: sellFromNet(164.5, 25) },
        ],
        extras: [],
        customExtras: [],
        promotion: null,
      },
      24.89,
    ),
    serviceCard(
      it,
      'activity',
      next(),
      'Cheli and Peacock Safaris Kenya',
      '6 activities',
      '02 Sep 2026',
      45 + 36 + 50 + 160 + 80 + 25,
      [
        { label: 'Location', value: 'Nairobi' },
        { label: 'Service', value: 'Giraffe Centre Entrance Fee' },
        { label: 'Date', value: formatRange('2026-09-02', '2026-09-02') },
      ],
      {
        location: 'Nairobi',
        supplier: 'Cheli and Peacock Safaris Kenya',
        service: 'Giraffe Centre Entrance Fee',
        startDate: '2026-09-02',
        endDate: '2026-09-02',
        discount: 0,
        days: ['2026-09-02'],
        activities: [
          { id: 'a1', name: 'Giraffe Centre Entrance Fee', rate: 45, start: '2026-09-02', end: '2026-09-02', guestIds: [] },
          { id: 'a2', name: 'Karen Blixen Museum Entry Fee', rate: 36, start: '2026-09-02', end: '2026-09-02', guestIds: [] },
          {
            id: 'a3',
            name: 'Sheldrick Wildlife Trust Nairobi Orphanage Visit',
            rate: 50,
            start: '2026-09-02',
            end: '2026-09-02',
            guestIds: [],
          },
          {
            id: 'a4',
            name: 'Nairobi National Park Entrance Fees - Adult',
            rate: 160,
            start: '2026-09-02',
            end: '2026-09-02',
            guestIds: [],
          },
          {
            id: 'a5',
            name: 'Nairobi National Park Entrance Fees - Child (3 - 17.99 yrs)',
            rate: 80,
            start: '2026-09-02',
            end: '2026-09-02',
            guestIds: [],
          },
          {
            id: 'a6',
            name: 'Vehicle & Driver Nairobi National Park Entry Fees',
            rate: 25,
            start: '2026-09-02',
            end: '2026-09-02',
            guestIds: [],
          },
        ],
        extras: [],
        customExtras: [],
      },
      0,
    ),
    serviceCard(
      it,
      'other',
      next(),
      'KE AMREF Flying Doctors',
      'Amref Silver: Kenya/Tanzania/Zanzibar 30 days',
      '4 PAX',
      sellFromNet(64, 20),
      [
        { label: 'Service', value: 'Amref Silver: Kenya/Tanzania/Zanzibar 30 days' },
        { label: 'Date', value: formatRange('2026-09-01', '2026-09-01') },
      ],
      {
        location: 'Nairobi',
        supplier: 'KE AMREF Flying Doctors',
        service: 'Amref Silver: Kenya/Tanzania/Zanzibar 30 days',
        description: 'Amref Silver: Kenya/Tanzania/Zanzibar 30 days',
        startDate: '2026-09-01',
        endDate: '2026-09-30',
        qty: 4,
        price: 16,
        discount: 0,
        activities: [],
      },
      20,
    ),
    serviceCard(
      it,
      'other',
      next(),
      'Umbato Meet and Assist Services',
      'JKIA Meet & Assist (Arrival)',
      '4 PAX',
      sellFromNet(75, 16.67),
      [
        { label: 'Service', value: 'JKIA Meet & Assist (Arrival)' },
        { label: 'Date', value: formatRange('2026-09-01', '2026-09-01') },
      ],
      {
        location: 'Nairobi',
        supplier: 'Umbato Meet and Assist Services',
        service: 'JKIA Meet & Assist (Arrival)',
        description: 'JKIA Meet & Assist (Arrival)',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
        qty: 1,
        price: 75,
        discount: 0,
        activities: [],
      },
      16.67,
    ),
  ]
}

/** Builder "added services" mirrored from the itinerary destination / dates. */
export function buildSeedServices(it: Itinerary): AddedService[] {
  if (it.id === 'CPS5688') return buildCsvSeedServices(it)

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
            type: 'generic-double',
            basis: 'fb',
            rate: Math.round(stayPrice / nights / 2),
            qty: 1,
            guestIds: guestIds.slice(0, Math.min(2, guestIds.length)),
            start: it.travelDateFrom,
            end: it.travelDateTo,
          },
          {
            id: 'r2',
            type: guestIds.length > 2 ? 'Twin' : 'Double',
            basis: 'fb',
            rate: Math.round(stayPrice / nights / 2),
            qty: 1,
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
