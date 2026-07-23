import {
  ACC_RATE,
  BASIS,
  EXTRAS_CATALOG,
  GUESTS,
  TAB_META,
} from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import type {
  ActivityItem,
  AddedService,
  CustomExtra,
  Guest,
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

export const TRANS_SERVICES = [
  'Nairobi One Way Transfer',
  'Nairobi Return Transfer',
  'Airport Pick-up Transfer',
  'Airport Drop-off Transfer',
  'Half-Day Car Hire',
  'Full-Day Car Hire',
]

export const FLIGHT_SERVICES = [
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
  return (Array.isArray(draft.rooms) ? draft.rooms : []) as Room[]
}

export function asVehicles(draft: Record<string, unknown>): Vehicle[] {
  return (Array.isArray(draft.vehicles) ? draft.vehicles : []) as Vehicle[]
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
    .concat(custom) as { id: string; title: string; price: number; mandatory?: boolean; custom?: boolean }[]
}

export function roomQty(room: Room) {
  return Math.max(1, Number(room.qty) || 1)
}

export function flightAutoQty(draft: Record<string, unknown>) {
  const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
  const totalPax =
    (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
  const capacity = Math.max(1, Number(draft.capacity) || 1)
  if (totalPax <= 0) return 1
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
  return { priceRows, netTotal, rackTotal, rStart, rEnd, rNights, roomCount: roomQty(room) }
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
    const net = vehicles.reduce((sum, v) => sum + v.rate, 0)
    return { net, rack: rackOf(net) }
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
  const clientPays = Math.max(0, draftRack - (Number(draft.discount) || 0))
  const cardMargin = clientPays - draftNet
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
  const roomCount = rooms.reduce((sum, r) => sum + roomQty(r), 0)

  let title = String(draft.supplier || meta.label)
  let subtitle = meta.label
  let dateMeta = 'Set date'
  let details: { label: string; value: string }[] = []

  if (tab === 'accommodation') {
    title = String(draft.supplier || 'Accommodation')
    subtitle = `${roomCount || rooms.length} room(s) · ${BASIS[basisKey] || basisKey}`
    dateMeta = `${accNightsN} night(s)`
    details = [
      { label: 'Location', value: String(draft.location || '—') },
      { label: 'Rooms', value: String(roomCount || rooms.length) },
      { label: 'Basis', value: BASIS[basisKey] || basisKey },
      { label: 'Dates', value: `${draft.start || 'TBD'} – ${draft.end || 'TBD'}` },
      { label: 'Guests', value: `${accUsed.length} pax` },
    ]
  } else if (tab === 'transportation') {
    title = String(draft.supplier || 'Transportation')
    subtitle = `${vehicles.length} vehicle(s)`
    dateMeta = `${transUsed.length} PAX`
    details = [
      { label: 'Service', value: String(draft.service || '—') },
      { label: 'Vehicles', value: vehicles.map((v) => v.type).join(', ') || '—' },
      {
        label: 'Dates',
        value:
          draft.transMode === 'hire'
            ? `${draft.hireStart || 'TBD'} – ${draft.hireEnd || 'TBD'}`
            : String(draft.transDate || 'TBD'),
      },
      { label: 'Location', value: String(draft.location || '—') },
      { label: 'Pickup', value: String(draft.pickup || '—') },
      { label: 'Drop-off', value: String(draft.dropoff || '—') },
      { label: 'Time', value: `${draft.timeFrom || 'TBD'} – ${draft.timeTo || 'TBD'}` },
    ]
  } else if (tab === 'flight') {
    title = String(draft.supplier || 'Flight')
    subtitle = `${totalPax} passenger(s) · qty ${autoQty}`
    dateMeta = eligible ? 'Eligible' : 'Check capacity'
    details = [
      { label: 'Passengers', value: String(totalPax) },
      { label: 'Qty', value: String(autoQty) },
      { label: 'Capacity', value: String(draft.capacity) },
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
    net: draftNet,
    rack: draftRack,
    netLabel: formatUsd(draftNet),
    rackLabel: formatUsd(draftRack),
    margin: cardMargin,
    marginPct,
    marginColor: cardMargin >= 0 ? '#0B7A48' : '#B91C1C',
    fg: meta.fg,
    bg: meta.bg,
    initial: meta.initial,
    expanded: true,
    draft: structuredClone({
      ...draft,
      ...(tab === 'flight' ? { qty: autoQty } : {}),
    }),
  }
}
