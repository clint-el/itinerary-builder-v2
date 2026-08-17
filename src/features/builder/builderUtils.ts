import {
  ACC_RATE,
  BASIS,
  EXTRAS_CATALOG,
  GUESTS,
  applyOfferToCostAndSell,
  roomTypeId,
  TAB_META,
} from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import type {
  ActivityItem,
  AddedService,
  CustomExtra,
  FlightInstance,
  Guest,
  HireRoute,
  Room,
  ServiceTab,
  Vehicle,
} from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'

export const TYPE_META = {
  adult: { label: 'Adult', bg: '#F3F4F6', bd: '#E5E7EB', fg: '#525252' },
  youth: { label: 'Youth', bg: '#F3F4F6', bd: '#E5E7EB', fg: '#525252' },
  child: { label: 'Child', bg: '#F3F4F6', bd: '#E5E7EB', fg: '#525252' },
  infant: { label: 'Infant', bg: '#F3F4F6', bd: '#E5E7EB', fg: '#525252' },
} as const

export const RAIL: {
  tab: ServiceTab
  label: string
  color: string
  iconBg: string
}[] = [
  { tab: 'accommodation', label: 'Stay', color: '#059669', iconBg: '#D1FAE5' },
  { tab: 'transportation', label: 'Transport', color: '#D97706', iconBg: '#FEF3C7' },
  { tab: 'flight', label: 'Flight', color: '#2563EB', iconBg: '#DBEAFE' },
  { tab: 'activity', label: 'Activity', color: '#DB2777', iconBg: '#FCE7F3' },
  { tab: 'other', label: 'Other', color: '#475569', iconBg: '#E2E8F0' },
]

/** Hemingways transfer portfolio (cost pass-through — no markup/commission). */
export const TRANS_SERVICES = [
  // Nairobi airport / hotel
  { title: 'JKIA to Hemingways Nairobi (3-pax)', price: 55, unit: 'per transfer' },
  { title: 'Hemingways Nairobi to JKIA (3-pax)', price: 55, unit: 'per transfer' },
  { title: 'JKIA to Hemingways Nairobi (5-pax)', price: 75, unit: 'per transfer' },
  { title: 'Hemingways Nairobi to JKIA (5-pax)', price: 75, unit: 'per transfer' },
  { title: 'Wilson to Hemingways Nairobi (3-pax)', price: 45, unit: 'per transfer' },
  { title: 'Hemingways Nairobi to Wilson (3-pax)', price: 45, unit: 'per transfer' },
  { title: 'Wilson to Hemingways Nairobi (5-pax)', price: 65, unit: 'per transfer' },
  { title: 'Hemingways Nairobi to Wilson (5-pax)', price: 65, unit: 'per transfer' },
  // Watamu coastal
  { title: 'Malindi Airport to Hemingways Watamu', price: 80, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Malindi Airport', price: 80, unit: 'per transfer' },
  { title: 'Moi International Airport to Hemingways Watamu', price: 180, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Moi International Airport', price: 180, unit: 'per transfer' },
  { title: 'Vipingo Airstrip to Hemingways Watamu', price: 120, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Vipingo Airstrip', price: 120, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Medina Palms', price: 40, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Nderit House', price: 40, unit: 'per transfer' },
  { title: 'Hemingways Watamu to Ishara Mara', price: 250, unit: 'per transfer' },
  // Ol Seki / Laikipia–Mara inter-camp
  { title: 'Ol Seki to Asilia Naboisho', price: 90, unit: 'per transfer' },
  { title: 'Ol Seki to JW Marriott', price: 90, unit: 'per transfer' },
  { title: "Ol Seki to Karen Blixen", price: 90, unit: 'per transfer' },
  { title: "Ol Seki to Richard's River", price: 90, unit: 'per transfer' },
  { title: 'Ol Seki to Mara Nyika', price: 90, unit: 'per transfer' },
  // Legacy demo routes still used by seed itineraries
  { title: 'Nairobi One Way Transfer', price: 50, unit: 'per transfer' },
  { title: 'Nairobi Return Transfer', price: 110, unit: 'per transfer' },
  { title: 'Airport Pick-up Transfer', price: 55, unit: 'per transfer' },
  { title: 'Airport Drop-off Transfer', price: 55, unit: 'per transfer' },
  { title: 'Nairobi Full Day Car Hire and Driver', price: 250, unit: 'per day' },
  { title: 'Half-Day Car Hire', price: 150, unit: 'per day' },
  { title: 'Full-Day Car Hire', price: 280, unit: 'per day' },
]

export const FLIGHT_SERVICES = [
  'WILSON TO LOISABA OW',
  'LOISABA TO MARA OW',
  'MARA TO KOGATENDE OW',
  'SEN - SERENGETI NORTH to MANYARA',
  'MANYARA to KILIMANJARO',
  'Scheduled Economy',
  'Scheduled Business',
  'Private Charter',
  'Shared Charter',
]

/** Weekday codes used by scheduled flight Options (operating days). */
export type FlightOptionDay = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun'

/**
 * A named schedule Option under a route-level flight Service. Charter-style
 * services have none — absence of Options (not a separate flag) is what
 * signals "no fixed schedule" in this prototype.
 */
export type FlightServiceOption = {
  id: string
  name: string
  flightNumber: string
  /** 24h `HH:MM` window start (inclusive). */
  startTime: string
  /** 24h `HH:MM` window end (inclusive). */
  endTime: string
  days: FlightOptionDay[]
  included: string
  excluded: string
}

const ALL_DAYS: FlightOptionDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const WEEKDAYS: FlightOptionDay[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

const DEFAULT_FLIGHT_INCLUDED =
  'Seat on the selected scheduled departure within the option’s published time window.'
const DEFAULT_FLIGHT_EXCLUDED =
  'Excess baggage, private charter deviations, ground transfers, and meals are not included.'

function flightOpt(
  partial: Omit<FlightServiceOption, 'included' | 'excluded'> &
    Partial<Pick<FlightServiceOption, 'included' | 'excluded'>>,
): FlightServiceOption {
  return {
    included: DEFAULT_FLIGHT_INCLUDED,
    excluded: DEFAULT_FLIGHT_EXCLUDED,
    ...partial,
  }
}

/**
 * Mock Options keyed by exact `FLIGHT_SERVICES` names. Services with an empty
 * array (or omitted key) are treated as charter-style — no Option field, no
 * departure-time window validation.
 */
export const FLIGHT_SERVICE_OPTIONS: Record<string, FlightServiceOption[]> = {
  'WILSON TO LOISABA OW': [
    flightOpt({
      id: 'wlo-morning',
      name: 'Morning Flight',
      flightNumber: 'FY78787',
      startTime: '07:00',
      endTime: '08:00',
      days: ALL_DAYS,
      included: 'Morning scheduled seat Wilson → Loisaba, soft-bag allowance as published.',
      excluded: 'Afternoon connections, excess baggage, and lodge transfers are not included.',
    }),
    flightOpt({
      id: 'wlo-afternoon',
      name: 'Afternoon Flight',
      flightNumber: 'FY78788',
      startTime: '14:00',
      endTime: '15:30',
      days: ALL_DAYS,
    }),
  ],
  'LOISABA TO MARA OW': [
    flightOpt({
      id: 'lom-morning',
      name: 'Morning Flight',
      flightNumber: 'FY79101',
      startTime: '08:00',
      endTime: '09:00',
      days: ALL_DAYS,
    }),
    flightOpt({
      id: 'lom-midday',
      name: 'Midday Flight',
      flightNumber: 'FY79102',
      startTime: '11:30',
      endTime: '12:30',
      days: WEEKDAYS,
    }),
  ],
  'MARA TO KOGATENDE OW': [
    flightOpt({
      id: 'mtk-daily',
      name: 'Daily Connection',
      flightNumber: 'FY80220',
      startTime: '09:00',
      endTime: '10:30',
      days: ALL_DAYS,
    }),
  ],
  'SEN - SERENGETI NORTH to MANYARA': [
    flightOpt({
      id: 'sen-morning',
      name: 'Morning Hop',
      flightNumber: 'SA4401',
      startTime: '06:30',
      endTime: '07:30',
      days: WEEKDAYS,
    }),
    flightOpt({
      id: 'sen-evening',
      name: 'Evening Hop',
      flightNumber: 'SA4402',
      startTime: '16:00',
      endTime: '17:00',
      days: WEEKDAYS,
    }),
  ],
  'MANYARA to KILIMANJARO': [
    flightOpt({
      id: 'mtkili-am',
      name: 'Morning Flight',
      flightNumber: 'SA4510',
      startTime: '07:15',
      endTime: '08:15',
      days: ALL_DAYS,
    }),
  ],
  'Scheduled Economy': [
    flightOpt({
      id: 'econ-morning',
      name: 'Morning Flight',
      flightNumber: 'KQ310',
      startTime: '07:00',
      endTime: '08:00',
      days: ALL_DAYS,
      included: 'Economy seat on the morning scheduled service, standard soft-bag allowance.',
      excluded: 'Business cabin upgrades, meals, and inter-terminal transfers are not included.',
    }),
    flightOpt({
      id: 'econ-afternoon',
      name: 'Afternoon Flight',
      flightNumber: 'KQ318',
      startTime: '13:00',
      endTime: '14:00',
      days: ALL_DAYS,
    }),
  ],
  'Scheduled Business': [
    flightOpt({
      id: 'biz-morning',
      name: 'Morning Flight',
      flightNumber: 'KQ310J',
      startTime: '07:00',
      endTime: '08:00',
      days: ALL_DAYS,
      included: 'Business cabin seat, priority boarding, and elevated soft-bag allowance.',
      excluded: 'Lounge access outside partner agreements and ground transfers are not included.',
    }),
    flightOpt({
      id: 'biz-evening',
      name: 'Evening Flight',
      flightNumber: 'KQ322J',
      startTime: '17:30',
      endTime: '18:30',
      days: WEEKDAYS,
    }),
  ],
  'Private Charter': [],
  'Shared Charter': [],
}

export function optionsForFlightService(service: string): FlightServiceOption[] {
  if (!service) return []
  return FLIGHT_SERVICE_OPTIONS[service] ?? []
}

/** Single generic choice when the service has no fixed schedule (charter). */
export const CHARTER_FLIGHT_OPTION: FlightServiceOption = flightOpt({
  id: 'charter-departure',
  name: 'Charter departure',
  flightNumber: 'CHARTER',
  startTime: '00:00',
  endTime: '23:59',
  days: ALL_DAYS,
  included: 'Private or shared charter aircraft for the booked sector and party size.',
  excluded: 'Landing fees outside the quote, positioning legs, and catering are not included unless stated.',
})

/** Options shown in the Add flight dropdown for the current Service. */
export function addableFlightOptions(service: string): FlightServiceOption[] {
  const opts = optionsForFlightService(service)
  if (opts.length > 0) return opts
  if (/charter/i.test(service)) return [CHARTER_FLIGHT_OPTION]
  return []
}

export function findFlightServiceOption(
  service: string,
  optionId: string,
): FlightServiceOption | undefined {
  if (!optionId) return undefined
  if (optionId === CHARTER_FLIGHT_OPTION.id) return CHARTER_FLIGHT_OPTION
  return optionsForFlightService(service).find((o) => o.id === optionId)
}

/** Parse `HH:MM` (24h) to minutes since midnight; null if unparseable. */
export function flightTimeToMinutes(time: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(time || '').trim())
  if (!m) return null
  const hours = Number(m[1])
  const mins = Number(m[2])
  if (hours > 23 || mins > 59) return null
  return hours * 60 + mins
}

function formatFlightClock(time: string): string {
  const mins = flightTimeToMinutes(time)
  if (mins == null) return time
  const hours = Math.floor(mins / 60)
  const minutes = mins % 60
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const h12 = hours % 12 || 12
  return `${h12}:${String(minutes).padStart(2, '0')} ${ampm}`
}

export function formatFlightOptionDays(days: FlightOptionDay[]): string {
  if (days.length === 7) return 'Mon–Sun'
  if (
    days.length === 5 &&
    WEEKDAYS.every((d) => days.includes(d)) &&
    !days.includes('Sat') &&
    !days.includes('Sun')
  ) {
    return 'Mon–Fri'
  }
  return days.join(', ')
}

export function formatFlightOptionWindow(option: FlightServiceOption): string {
  return `${formatFlightClock(option.startTime)}–${formatFlightClock(option.endTime)}`
}

/** Dropdown / trigger label: name + flight # · window · days. */
export function formatFlightOptionLabel(option: FlightServiceOption): string {
  return `${option.name} — ${option.flightNumber} · ${formatFlightOptionWindow(option)} · ${formatFlightOptionDays(option.days)}`
}

/** True when `departTime` (`HH:MM`) is inside the option window (inclusive). */
export function isDepartTimeInFlightOptionWindow(
  departTime: string,
  option: FlightServiceOption,
): boolean {
  const t = flightTimeToMinutes(departTime)
  const start = flightTimeToMinutes(option.startTime)
  const end = flightTimeToMinutes(option.endTime)
  if (t == null || start == null || end == null) return true
  return t >= start && t <= end
}

const JS_DAY_TO_OPTION: FlightOptionDay[] = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Weekday of an ISO `YYYY-MM-DD` date (local), or null if unparseable. */
export function weekdayFromIsoDate(iso: string): FlightOptionDay | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  return JS_DAY_TO_OPTION[d.getDay()] ?? null
}

/** True when `departDate` falls on one of the option's operating days. */
export function isDepartDateOnFlightOptionDay(
  departDate: string,
  option: FlightServiceOption,
): boolean {
  const day = weekdayFromIsoDate(departDate)
  if (!day) return true
  return option.days.includes(day)
}

export const HOLD_STATUS_STYLE = {
  Requested: { headerBg: '#D97706', headerFg: '#FFFFFF', bodyBg: '#FFFBEB', borderColor: '#FDE68A' },
  Held: { headerBg: '#06AEE8', headerFg: '#FFFFFF', bodyBg: '#F0F9FF', borderColor: '#BAE6FD' },
  Released: { headerBg: '#16A34A', headerFg: '#FFFFFF', bodyBg: '#F0FDF4', borderColor: '#BBF7D0' },
  Expired: { headerBg: '#D1D5DB', headerFg: '#374151', bodyBg: '#F9FAFB', borderColor: '#E5E7EB' },
} as const

export type PricingRow = { id: string; type: string; charge: string; net: number; rack: number }

export type AuditEntry = { reason: string; user: string; at: string }

/** Prototype nights helper — defaults to 1 when dates missing. */
export function nights(start: string, end: string) {
  if (!start || !end) return 1
  const d = (new Date(end).getTime() - new Date(start).getTime()) / 86400000
  return d > 0 ? Math.round(d) : 1
}

/** Car hire bills per day of the hire window; a one-off transfer is a single flat rate. */
export function transportDays(draft: Record<string, unknown>) {
  if (draft.transMode !== 'hire') return 1
  return nights(String(draft.hireStart || ''), String(draft.hireEnd || ''))
}

export function findGuest(id: number, guests: Guest[] = GUESTS): Guest | undefined {
  return guests.find((g) => g.id === Number(id))
}

export function usedGuestIds(list: { guestIds: number[] }[]) {
  return list.reduce<number[]>((acc, item) => acc.concat(item.guestIds), [])
}

/**
 * Greedy fill: clear each bucket, then pour unassigned guests into buckets in
 * order up to each item's capacity. Shared by Stay / Transport / Flight.
 */
export function autoAssignByCapacity<T extends { guestIds: number[] }>(
  items: T[],
  guests: Guest[],
  getCap: (item: T) => number,
): T[] {
  const pool = guests.map((g) => g.id)
  const next = items.map((item) => ({ ...item, guestIds: [] as number[] }))
  next.forEach((item) => {
    const cap = getCap(item)
    while (pool.length && item.guestIds.length < cap) {
      item.guestIds.push(pool.shift()!)
    }
  })
  return next
}

export function guestChipStyle(g: Guest) {
  const m = TYPE_META[g.type] || TYPE_META.adult
  const residency = g.residency
  const resLabel =
    residency === 'citizen' ? 'C' : residency === 'nonResident' || !g.resident ? 'NR' : 'R'
  const resBg =
    resLabel === 'C' ? '#DBEAFE' : resLabel === 'R' ? '#ECFDF5' : '#FEF3C7'
  const resFg =
    resLabel === 'C' ? '#1D4ED8' : resLabel === 'R' ? '#059669' : '#B45309'
  return {
    bg: m.bg,
    bd: m.bd,
    fg: m.fg,
    meta: `${m.label === 'Youth' ? 'Child' : m.label} · ${g.age}`,
    lead: !!g.lead,
    resLabel,
    resBg,
    resFg,
  }
}

export function asRooms(draft: Record<string, unknown>): Room[] {
  const rooms = (Array.isArray(draft.rooms) ? draft.rooms : []) as Room[]
  return rooms.map((room) => ({ ...room, type: roomTypeId(room.type) }))
}

export function asVehicles(draft: Record<string, unknown>): Vehicle[] {
  const raw = (Array.isArray(draft.vehicles) ? draft.vehicles : []) as (Vehicle & {
    departDate?: string
  })[]
  return raw.map((v) => ({
    ...v,
    // Legacy single departDate → dateFrom (and dateTo if missing).
    dateFrom: String(v.dateFrom || v.departDate || ''),
    dateTo: String(v.dateTo || v.dateFrom || v.departDate || ''),
  }))
}

export function asFlights(draft: Record<string, unknown>): FlightInstance[] {
  const defaultCap = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 5)
  if (Array.isArray(draft.flights)) {
    return (draft.flights as FlightInstance[]).map((f, i) => ({
      id: f.id || `f${i + 1}`,
      cap: Math.max(1, Number(f.cap) || defaultCap),
      guestIds: Array.isArray(f.guestIds) ? f.guestIds.map(Number) : [],
      optionId: String(f.optionId || ''),
      optionName: String(f.optionName || ''),
      departDate: String(f.departDate || ''),
      departTime: String(f.departTime || ''),
    }))
  }
  // Legacy drafts / seeds without a `flights` array.
  if (draft.departDate || draft.departTime || draft.flightOptionId) {
    return [
      {
        id: 'f1',
        cap: defaultCap,
        guestIds: [],
        optionId: String(draft.flightOptionId || ''),
        optionName: '',
        departDate: String(draft.departDate || ''),
        departTime: String(draft.departTime || ''),
      },
    ]
  }
  return []
}

/** Keep top-level depart fields in sync with the first flight (summary, policy, sort). */
export function flightDepartMeta(flights: FlightInstance[]) {
  const first = flights[0]
  return {
    departDate: first?.departDate || '',
    departTime: first?.departTime || '',
    qty: Math.max(1, flights.length),
  }
}

export function asHireRoutes(draft: Record<string, unknown>): HireRoute[] {
  return (Array.isArray(draft.hireRoutes) ? draft.hireRoutes : []) as HireRoute[]
}

export type HireServiceLine = { date: string; location: string; days: number }

/** Consecutive days at the same pickup/drop-off consolidate into a single billed line. */
export function consolidateHireRoutes(routes: HireRoute[]): HireServiceLine[] {
  const sorted = [...routes].filter((r) => r.date).sort((a, b) => a.date.localeCompare(b.date))
  const result: HireServiceLine[] = []
  for (const r of sorted) {
    const location =
      r.pickup && r.dropoff && r.pickup !== r.dropoff ? `${r.pickup} – ${r.dropoff}` : r.pickup || r.dropoff || '—'
    const last = result[result.length - 1]
    if (last) {
      const expectedNext = new Date(`${last.date}T00:00:00`).getTime() + last.days * 86400000
      if (last.location === location && new Date(`${r.date}T00:00:00`).getTime() === expectedNext) {
        last.days += 1
        continue
      }
    }
    result.push({ date: r.date, location, days: 1 })
  }
  return result
}

export function asActivities(draft: Record<string, unknown>): ActivityItem[] {
  return (Array.isArray(draft.activities) ? draft.activities : []) as ActivityItem[]
}

export function asCustomExtras(draft: Record<string, unknown>): (CustomExtra & { custom?: boolean })[] {
  return (Array.isArray(draft.customExtras) ? draft.customExtras : []) as (CustomExtra & {
    custom?: boolean
  })[]
}

export function asExtraIds(draft: Record<string, unknown>): string[] {
  return (Array.isArray(draft.extras) ? draft.extras : []) as string[]
}

export function extraObjects(draft: Record<string, unknown>) {
  const ids = asExtraIds(draft)
  const custom = asCustomExtras(draft)
  return ids
    .map((id) => EXTRAS_CATALOG.find((c) => c.id === id))
    .filter(Boolean)
    .concat(custom) as {
    id: string
    title: string
    price: number
    mandatory?: boolean
    custom?: boolean
    qty?: number
    timeUnit?: string
  }[]
}

export function flightAutoQty(draft: Record<string, unknown>) {
  // Explicit Flights & PAX instances drive qty when present.
  if (Array.isArray(draft.flights) && draft.flights.length > 0) {
    return draft.flights.length
  }
  const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
  const totalPax =
    (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
  const capacity = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 1)
  if (totalPax <= 0) return 1
  // Legacy squeeze/split for drafts that never materialised a flights array.
  if (draft.overflowMode === 'squeeze' || totalPax <= capacity) return 1
  return Math.max(1, Math.ceil(totalPax / capacity))
}

export function roomPriceBreakdown(
  room: Room,
  defaultStart: string,
  defaultEnd: string,
  guests: Guest[] = GUESTS,
) {
  const typeCounts: Record<string, number> = {}
  room.guestIds.forEach((gid) => {
    const g = findGuest(gid, guests)
    if (!g) return
    const key = `${g.type}_${g.resident ? 'res' : 'nonres'}`
    typeCounts[key] = (typeCounts[key] || 0) + 1
  })
  const rStart = room.start || defaultStart
  const rEnd = room.end || defaultEnd
  const rNights = nights(rStart, rEnd)
  const priceRows = Object.keys(typeCounts).map((key) => {
    const [t, resKey] = key.split('_') as [keyof typeof ACC_RATE, string]
    const isRes = resKey === 'res'
    const rateSet = ACC_RATE[t] || ACC_RATE.adult
    const rate = isRes ? rateSet.resident : rateSet.nonResident
    const qty = typeCounts[key]
    const net = qty * rate.net * rNights
    const rack = qty * rate.rack * rNights
    const label = `${TYPE_META[t]?.label || t} · ${isRes ? 'Resident' : 'Non-Resident'}`
    return { qty, label, net, rack }
  })
  const netTotal = priceRows.reduce((sum, x) => sum + x.net, 0)
  const rackTotal = priceRows.reduce((sum, x) => sum + x.rack, 0)
  return { priceRows, netTotal, rackTotal, rStart, rEnd, rNights, roomCount: 1 }
}

export function computeDraftTotals(
  tab: ServiceTab,
  draft: Record<string, unknown>,
  pricingRows?: { net: number; rack: number }[],
  guests: Guest[] = GUESTS,
) {
  if (tab === 'accommodation') {
    const extras = extraObjects(draft)
    const extrasNet = extras.reduce((sum, e) => sum + e.price, 0)
    if (draft.priceOverride && pricingRows && pricingRows.length > 0) {
      const roomNet = pricingRows.reduce((sum, r) => sum + (r.net || 0), 0)
      const roomRack = pricingRows.reduce((sum, r) => sum + (r.rack || 0), 0)
      return { net: roomNet + extrasNet, rack: roomRack + rackOf(extrasNet) }
    }
    const rooms = asRooms(draft)
    const roomNet = rooms.reduce(
      (sum, r) =>
        sum + roomPriceBreakdown(r, String(draft.start || ''), String(draft.end || ''), guests).netTotal,
      0,
    )
    const roomRack = rooms.reduce(
      (sum, r) =>
        sum + roomPriceBreakdown(r, String(draft.start || ''), String(draft.end || ''), guests).rackTotal,
      0,
    )
    return { net: roomNet + extrasNet, rack: roomRack + rackOf(extrasNet) }
  }
  if (tab === 'transportation') {
    const vehicles = asVehicles(draft)
    const extras = extraObjects(draft)
    const extrasNet = extras.reduce((sum, e) => sum + e.price, 0)
    const days = transportDays(draft)
    const vehiclesNet = vehicles.reduce((sum, v) => sum + v.rate, 0) * days
    return { net: vehiclesNet + extrasNet, rack: rackOf(vehiclesNet) + rackOf(extrasNet) }
  }
  if (tab === 'flight') {
    const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
    const rates = (draft.rates || {}) as Record<string, number>
    const extras = extraObjects(draft)
    const extrasNet = extras.reduce((sum, e) => sum + e.price, 0)
    const qty = flightAutoQty(draft)
    const base =
      (['adult', 'youth', 'child', 'infant'] as const).reduce(
        (sum, k) => sum + (pax[k] || 0) * (rates[k] || 0),
        0,
      ) * qty
    return { net: base + extrasNet, rack: rackOf(base) + rackOf(extrasNet) }
  }
  if (tab === 'activity') {
    const activities = asActivities(draft)
    const extras = extraObjects(draft)
    const extrasNet = extras.reduce((sum, e) => sum + e.price * (e.qty || 1), 0)
    const net = activities.reduce((sum, a) => sum + a.rate * a.guestIds.length, 0)
    const rack = activities.reduce((sum, a) => sum + rackOf(a.rate * a.guestIds.length), 0)
    return { net: net + extrasNet, rack: rack + rackOf(extrasNet) }
  }
  // Other: prefer line items (activities) when present; otherwise qty × unit price.
  const extras = extraObjects(draft)
  const extrasNet = extras.reduce((sum, e) => sum + e.price * (e.qty || 1), 0)
  const activities = asActivities(draft)
  if (activities.length > 0) {
    const net = activities.reduce((sum, a) => sum + a.rate * a.guestIds.length, 0)
    const rack = activities.reduce((sum, a) => sum + rackOf(a.rate * a.guestIds.length), 0)
    return { net: net + extrasNet, rack: rack + rackOf(extrasNet) }
  }
  const other = (Number(draft.qty) || 0) * (Number(draft.price) || 0)
  return { net: other + extrasNet, rack: rackOf(other) + rackOf(extrasNet) }
}

export function buildAddedService(
  tab: ServiceTab,
  draft: Record<string, unknown>,
  seq: number,
  pricingRows?: PricingRow[],
  guests: Guest[] = GUESTS,
): AddedService {
  const meta = TAB_META[tab]
  const { net: draftNet, rack: draftRack } = computeDraftTotals(tab, draft, pricingRows, guests)
  const offer = applyOfferToCostAndSell(
    draftNet,
    draftRack,
    Number(draft.discount) || 0,
    String(draft.promotion || '') || null,
  )
  const clientPays = offer.sell
  const costAfter = offer.cost
  const cardMargin = clientPays - costAfter
  const marginPct = clientPays > 0 ? Math.round((cardMargin / clientPays) * 100) : 0

  const rooms = asRooms(draft)
  const vehicles = asVehicles(draft)
  const activities = asActivities(draft)
  const accUsed = usedGuestIds(rooms)
  const transUsed = usedGuestIds(vehicles)
  const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
  const totalPax = (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
  const autoQty = flightAutoQty(draft)
  const basisKey = String(draft.basis || 'bb') as keyof typeof BASIS
  const roomCount = rooms.length

  let title = String(draft.supplier || meta.label)
  let subtitle = meta.label
  let dateMeta = 'Set date'
  let details: { label: string; value: string }[] = []

  if (tab === 'accommodation') {
    title = String(draft.supplier || 'Accommodation')
    subtitle = `${roomCount} room(s) · ${BASIS[basisKey] || basisKey}`
    const roomStarts = rooms.map((r) => String(r.start || draft.start || '').trim()).filter(Boolean).sort()
    const roomEnds = rooms.map((r) => String(r.end || draft.end || '').trim()).filter(Boolean).sort()
    const stayStart = roomStarts[0] || String(draft.start || '')
    const stayEnd = roomEnds[roomEnds.length - 1] || String(draft.end || '')
    dateMeta = `${nights(stayStart, stayEnd)} night(s)`
    details = [
      { label: 'Location', value: String(draft.location || '—') },
      { label: 'Rooms', value: String(roomCount) },
      { label: 'Basis', value: BASIS[basisKey] || basisKey },
      { label: 'Dates', value: `${stayStart || 'TBD'} – ${stayEnd || 'TBD'}` },
      { label: 'Guests', value: `${accUsed.length} pax` },
    ]
  } else if (tab === 'transportation') {
    const transExtras = extraObjects(draft)
    title = String(draft.supplier || 'Transportation')
    subtitle = `${vehicles.length} vehicle(s)`
    dateMeta = `${transUsed.length} PAX`
    details = [
      { label: 'Service', value: String(draft.service || '—') },
      { label: 'Vehicles', value: vehicles.map((v) => v.type).join(', ') || '—' },
      { label: 'Location', value: String(draft.location || '—') },
      ...(transExtras.length ? [{ label: 'Extras', value: String(transExtras.length) }] : []),
    ]
  } else if (tab === 'flight') {
    const flights = asFlights(draft)
    const flightUsed = usedGuestIds(flights)
    const flightPax = flightUsed.length || totalPax
    title = String(draft.supplier || 'Flight')
    subtitle = `${flightPax} passenger(s) · ${flights.length} flight(s)`
    dateMeta = flights[0]?.departDate || 'Set date'
    details = [
      { label: 'Route', value: `${draft.flightFrom || 'TBD'} – ${draft.flightTo || 'TBD'}` },
      { label: 'Passengers', value: String(flightPax) },
      { label: 'Flights', value: String(flights.length) },
      {
        label: 'Depart',
        value:
          [flights[0]?.departDate || draft.departDate, flights[0]?.departTime || draft.departTime]
            .filter(Boolean)
            .join(' · ') || 'TBD',
      },
    ]
  } else if (tab === 'activity') {
    title = String(draft.supplier || 'Activity')
    subtitle = `${activities.length} activity(ies)`
    dateMeta = String(draft.startDate || activities[0]?.start || 'Set date')
    details = [
      { label: 'Activities', value: String(activities.length) },
      { label: 'Date', value: String(draft.startDate || activities[0]?.start || '—') },
    ]
  } else {
    title = String(draft.supplier || draft.description || 'Other line item')
    subtitle =
      activities.length > 0
        ? `${activities.length} item(s)`
        : `Qty ${draft.qty || 1}`
    dateMeta = String(draft.startDate || 'Other')
    details = [
      {
        label: 'Description',
        value: String(draft.description || activities[0]?.name || '—'),
      },
      {
        label: activities.length > 0 ? 'Items' : 'Qty',
        value: String(activities.length > 0 ? activities.length : draft.qty || 1),
      },
    ]
  }

  return {
    id: `s${seq}`,
    tab,
    title,
    subtitle,
    meta: dateMeta,
    details,
    price: clientPays,
    priceLabel: formatUsd(clientPays),
    // Store gross so summary can re-apply offers from draft; labels show post-offer figures.
    net: draftNet,
    rack: draftRack,
    netLabel: formatUsd(costAfter),
    rackLabel: formatUsd(clientPays),
    margin: cardMargin,
    marginPct,
    marginColor: cardMargin >= 0 ? '#0B7A48' : '#B91C1C',
    fg: meta.fg,
    bg: meta.bg,
    initial: meta.initial,
    expanded: true,
    lineStatus: 'New',
    supplierStatus: 'None',
    draft: structuredClone({
      ...draft,
      ...(tab === 'accommodation' ? { rooms } : {}),
      ...(tab === 'flight' ? { qty: autoQty } : {}),
    }),
  }
}

function missing(value: unknown) {
  return !String(value ?? '').trim()
}

/** Required fields that must be set before a draft can be added to the itinerary. */
export function draftMissingRequirements(
  tab: ServiceTab,
  draft: Record<string, unknown>,
): string[] {
  const needed: string[] = []

  if (tab === 'accommodation') {
    if (missing(draft.location)) needed.push('Location')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
    const rooms = asRooms(draft)
    if (rooms.length === 0) needed.push('At least one room')
    else if (
      rooms.some((r) => missing(r.start || draft.start) || missing(r.end || draft.end))
    ) {
      needed.push('Room stay dates')
    }
    return needed
  }

  if (tab === 'transportation') {
    if (missing(draft.location)) needed.push('Location')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
    const vehicles = asVehicles(draft)
    if (vehicles.length === 0) needed.push('At least one vehicle')
    else if (vehicles.some((v) => missing(v.dateFrom) || missing(v.dateTo))) {
      needed.push('Vehicle date from / date to')
    }
    return needed
  }

  if (tab === 'flight') {
    if (missing(draft.flightFrom)) needed.push('From')
    if (missing(draft.flightTo)) needed.push('To')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
    const flights = asFlights(draft)
    if (flights.length === 0) needed.push('At least one flight')
    else if (!flights.some((f) => !missing(f.departDate)) && missing(draft.departDate)) {
      needed.push('Departure date')
    }
    return needed
  }

  if (tab === 'activity') {
    if (missing(draft.location)) needed.push('Location')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (asActivities(draft).length === 0) needed.push('At least one activity')
    return needed
  }

  // other
  if (missing(draft.supplier) && missing(draft.description)) needed.push('Supplier or description')
  if (missing(draft.startDate)) needed.push('Start date')
  if (asActivities(draft).length === 0 && !(Number(draft.qty) > 0 && Number(draft.price) > 0)) {
    needed.push('At least one item or a priced quantity')
  }
  return needed
}

export function canAddDraft(tab: ServiceTab, draft: Record<string, unknown>) {
  return draftMissingRequirements(tab, draft).length === 0
}

function firstDate(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? '').trim()
    if (text) return text
  }
  return ''
}

/** The date a service starts on, used to keep the itinerary in chronological order. */
export function serviceStartDate(service: AddedService): string {
  const d = (service.draft || {}) as Record<string, unknown>
  if (service.tab === 'accommodation') return firstDate(d.start)
  if (service.tab === 'transportation') {
    const vehicles = asVehicles(d)
    return d.transMode === 'hire'
      ? firstDate(d.hireStart, vehicles[0]?.dateFrom)
      : firstDate(vehicles[0]?.dateFrom, d.transDate)
  }
  if (service.tab === 'flight') {
    const flights = asFlights(d)
    return firstDate(flights[0]?.departDate, d.departDate)
  }
  return firstDate(d.startDate, asActivities(d)[0]?.start)
}

/**
 * Chronological order by start date. Dateless services sort last, and the sort
 * is stable so services sharing a date keep their existing relative order.
 */
export function sortServicesByDate(services: AddedService[]): AddedService[] {
  return services.slice().sort((a, b) => {
    const dateA = serviceStartDate(a)
    const dateB = serviceStartDate(b)
    if (!dateA && !dateB) return 0
    if (!dateA) return 1
    if (!dateB) return -1
    return dateA.localeCompare(dateB)
  })
}
