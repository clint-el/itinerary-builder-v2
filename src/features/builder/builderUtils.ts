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

export function guestChipStyle(g: Guest) {
  const m = TYPE_META[g.type] || TYPE_META.adult
  return {
    bg: m.bg,
    bd: m.bd,
    fg: m.fg,
    meta: `${m.label} · ${g.age}`,
    lead: !!g.lead,
    resLabel: g.resident ? 'R' : 'NR',
    resBg: g.resident ? '#ECFDF5' : '#FEF3C7',
    resFg: g.resident ? '#059669' : '#B45309',
  }
}

export function asRooms(draft: Record<string, unknown>): Room[] {
  const rooms = (Array.isArray(draft.rooms) ? draft.rooms : []) as Room[]
  return rooms.map((room) => ({ ...room, type: roomTypeId(room.type) }))
}

export function asVehicles(draft: Record<string, unknown>): Vehicle[] {
  return (Array.isArray(draft.vehicles) ? draft.vehicles : []) as Vehicle[]
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
  const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
  const totalPax =
    (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
  const capacity = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 1)
  if (totalPax <= 0) return 1
  // Squeeze keeps everyone on one flight (supplier approval). Split adds flights.
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
    const net = activities.reduce((sum, a) => sum + a.rate * a.guestIds.length, 0)
    return { net, rack: activities.reduce((sum, a) => sum + rackOf(a.rate * a.guestIds.length), 0) }
  }
  // Other: prefer line items (activities) when present; otherwise qty × unit price.
  const activities = asActivities(draft)
  if (activities.length > 0) {
    const net = activities.reduce((sum, a) => sum + a.rate * a.guestIds.length, 0)
    return { net, rack: activities.reduce((sum, a) => sum + rackOf(a.rate * a.guestIds.length), 0) }
  }
  const other = (Number(draft.qty) || 0) * (Number(draft.price) || 0)
  return { net: other, rack: rackOf(other) }
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
  const totalCapacity = (Number(draft.capacity) || 1) * autoQty
  const eligible = totalPax > 0 && totalPax <= totalCapacity
  const accNightsN = nights(String(draft.start || ''), String(draft.end || ''))
  const basisKey = String(draft.basis || 'bb') as keyof typeof BASIS
  const roomCount = rooms.length

  let title = String(draft.supplier || meta.label)
  let subtitle = meta.label
  let dateMeta = 'Set date'
  let details: { label: string; value: string }[] = []

  if (tab === 'accommodation') {
    title = String(draft.supplier || 'Accommodation')
    subtitle = `${roomCount} room(s) · ${BASIS[basisKey] || basisKey}`
    dateMeta = `${accNightsN} night(s)`
    details = [
      { label: 'Location', value: String(draft.location || '—') },
      { label: 'Rooms', value: String(roomCount) },
      { label: 'Basis', value: BASIS[basisKey] || basisKey },
      { label: 'Dates', value: `${draft.start || 'TBD'} – ${draft.end || 'TBD'}` },
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
    title = String(draft.supplier || 'Flight')
    subtitle = `${totalPax} passenger(s) · qty ${autoQty}`
    dateMeta = eligible ? 'Eligible' : 'Check capacity'
    details = [
      { label: 'Route', value: `${draft.flightFrom || 'TBD'} – ${draft.flightTo || 'TBD'}` },
      { label: 'Passengers', value: String(totalPax) },
      { label: 'Qty', value: String(autoQty) },
      { label: 'Capacity', value: String(draft.capacity) },
      {
        label: 'Depart',
        value: [draft.departDate, draft.departTime].filter(Boolean).join(' · ') || 'TBD',
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
    if (missing(draft.start)) needed.push('Start date')
    if (missing(draft.end)) needed.push('End date')
    if (asRooms(draft).length === 0) needed.push('At least one room')
    return needed
  }

  if (tab === 'transportation') {
    if (missing(draft.location)) needed.push('Location')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
    return needed
  }

  if (tab === 'flight') {
    if (missing(draft.flightFrom)) needed.push('From')
    if (missing(draft.flightTo)) needed.push('To')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
    if (missing(draft.departDate)) needed.push('Departure date')
    return needed
  }

  if (tab === 'activity') {
    if (missing(draft.location)) needed.push('Location')
    if (missing(draft.supplier)) needed.push('Supplier')
    if (missing(draft.service)) needed.push('Service')
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
    return d.transMode === 'hire' ? firstDate(d.hireStart) : firstDate(d.transDate)
  }
  if (service.tab === 'flight') return firstDate(d.departDate)
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
