import { nightsBetween, parseMoney, rackOf } from '@/shared/lib/helpers'
import { roomTypeLabel } from '@/shared/lib/catalogs'
import type { AddedService, QuoteGroup, ServiceTab } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'
import {
  asActivities,
  asHireRoutes,
  asRooms,
  asVehicles,
  consolidateHireRoutes,
  extraObjects,
  flightAutoQty,
  nights,
  roomQty,
  transportDays,
  usedGuestIds,
} from '@/features/builder/builderUtils'

export type SummaryServiceType =
  | 'accommodation'
  | 'flight'
  | 'transfer'
  | 'disposal'
  | 'activity'
  | 'extra'
  | 'other'

export type SummaryLine = {
  type: SummaryServiceType
  date: string
  supplier: string
  net: number
  rack: number
  // accommodation
  roomType?: string
  basis?: string
  rooms?: number
  pax?: number
  nights?: number
  // flight
  charter?: string
  route?: string
  // transfer
  vType?: string
  pickup?: string
  dropoff?: string
  veh?: number
  // disposal
  location?: string
  // activity / other / extra
  service?: string
  days?: number
  // extra
  qty?: string
}

export const SUMMARY_TYPE_META: Record<
  SummaryServiceType,
  { name: string; initial: string; iconBg: string; iconFg: string; tint: string; noun: string }
> = {
  accommodation: {
    name: 'Accommodation',
    initial: 'A',
    iconBg: '#ECFDF5',
    iconFg: '#059669',
    tint: '#F6FEFB',
    noun: 'stays',
  },
  flight: {
    name: 'Flight',
    initial: 'F',
    iconBg: '#EFF6FF',
    iconFg: '#2563EB',
    tint: '#F7FAFF',
    noun: 'flights',
  },
  transfer: {
    name: 'Transfer',
    initial: 'T',
    iconBg: '#FEF3C7',
    iconFg: '#D97706',
    tint: '#FFFCF3',
    noun: 'transfers',
  },
  disposal: {
    name: 'Vehicle Disposal',
    initial: 'V',
    iconBg: '#FFF1F2',
    iconFg: '#BE123C',
    tint: '#FFF8F9',
    noun: 'vehicles',
  },
  activity: {
    name: 'Activity',
    initial: 'Ac',
    iconBg: '#F3E8FF',
    iconFg: '#7E22CE',
    tint: '#FCF8FF',
    noun: 'activities',
  },
  extra: {
    name: 'Extras & Special Offers',
    initial: 'E',
    iconBg: '#E0F2FE',
    iconFg: '#0369A1',
    tint: '#F5FBFF',
    noun: 'extras',
  },
  other: {
    name: 'Other',
    initial: 'O',
    iconBg: '#F1F5F9',
    iconFg: '#475569',
    tint: '#FAFBFC',
    noun: 'services',
  },
}

const ORDER: SummaryServiceType[] = [
  'accommodation',
  'flight',
  'transfer',
  'disposal',
  'activity',
  'extra',
  'other',
]

const MARGIN_COL: [string, 'r'] = ['Cost / Sell · Margin', 'r']

const COLS: Record<SummaryServiceType, [string, 'l' | 'c' | 'r'][]> = {
  accommodation: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Room Type', 'l'],
    ['Basis', 'c'],
    ['No. of Rooms', 'c'],
    ['No. of Pax', 'c'],
    ['No. of Nights', 'c'],
    MARGIN_COL,
  ],
  flight: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Charter / Schedule', 'c'],
    ['Route', 'l'],
    ['No. of Pax', 'c'],
    MARGIN_COL,
  ],
  transfer: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['V. Type', 'l'],
    ['Pick Up', 'l'],
    ['Drop Off', 'l'],
    ['No. of Veh.', 'c'],
    ['No. of Pax', 'c'],
    MARGIN_COL,
  ],
  disposal: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['V. Type', 'l'],
    ['At Disposal In', 'l'],
    ['No. of Veh.', 'c'],
    ['No. of Days', 'c'],
    ['No. of Pax', 'c'],
    MARGIN_COL,
  ],
  activity: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Service', 'l'],
    ['No. of Pax', 'c'],
    MARGIN_COL,
  ],
  extra: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Extra', 'l'],
    ['No. of Pax', 'c'],
    ['Qty', 'c'],
    MARGIN_COL,
  ],
  other: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Service', 'l'],
    ['No. of Pax', 'c'],
    ['No. of Days', 'c'],
    MARGIN_COL,
  ],
}

const GRID: Record<SummaryServiceType, string> = {
  accommodation: '86px minmax(160px,1.7fr) minmax(150px,1.5fr) 76px 104px 92px 104px minmax(160px,1.3fr)',
  flight: '86px minmax(160px,1.6fr) 150px minmax(120px,1.2fr) 92px minmax(160px,1.3fr)',
  transfer:
    '86px minmax(150px,1.5fr) minmax(90px,1fr) minmax(130px,1.3fr) minmax(130px,1.3fr) 92px 92px minmax(160px,1.3fr)',
  disposal:
    '86px minmax(150px,1.5fr) minmax(90px,1fr) minmax(170px,1.7fr) 92px 100px 92px minmax(160px,1.3fr)',
  activity: '86px minmax(150px,1.5fr) minmax(220px,2.2fr) 92px minmax(160px,1.3fr)',
  extra: '86px minmax(150px,1.5fr) minmax(220px,2.2fr) 92px 96px minmax(160px,1.3fr)',
  other: '86px minmax(150px,1.5fr) minmax(220px,2.2fr) 92px 104px minmax(160px,1.3fr)',
}

function wholeUsd(n: number) {
  return `$${Math.round(n || 0).toLocaleString('en-US')}`
}

function marginRow(s: Pick<SummaryLine, 'net' | 'rack'>) {
  const net = s.net || 0
  const rack = s.rack || 0
  const mg = rack > 0 ? Math.round(((rack - net) / rack) * 100) : 0
  return `${wholeUsd(net)} / ${wholeUsd(rack)}  ·  ${mg}%`
}

function tabToSummaryType(tab: ServiceTab): SummaryServiceType {
  if (tab === 'transportation') return 'transfer'
  return tab
}

function fmtShortDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][
    m - 1
  ]
  return `${String(d).padStart(2, '0')} ${mon}`
}

function weekday(iso: string) {
  const dt = new Date(`${iso}T00:00:00`)
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    dt.getDay()
  ]
}

function cellValues(type: SummaryServiceType, s: SummaryLine): string[] {
  switch (type) {
    case 'accommodation':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.roomType || '—',
        s.basis || '—',
        String(s.rooms ?? '—'),
        String(s.pax ?? '—'),
        String(s.nights ?? '—'),
        marginRow(s),
      ]
    case 'flight':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.charter || '—',
        s.route || '—',
        String(s.pax ?? '—'),
        marginRow(s),
      ]
    case 'transfer':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.vType || '—',
        s.pickup || '—',
        s.dropoff || '—',
        String(s.veh ?? '—'),
        String(s.pax ?? '—'),
        marginRow(s),
      ]
    case 'disposal':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.vType || '—',
        s.location || '—',
        String(s.veh ?? '—'),
        String(s.days ?? '—'),
        String(s.pax ?? '—'),
        marginRow(s),
      ]
    case 'activity':
      return [fmtShortDate(s.date), s.supplier, s.service || '—', String(s.pax ?? '—'), marginRow(s)]
    case 'extra':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.service || '—',
        String(s.pax ?? '—'),
        s.qty || '—',
        marginRow(s),
      ]
    case 'other':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.service || '—',
        String(s.pax ?? '—'),
        String(s.days ?? '—'),
        marginRow(s),
      ]
  }
}

function extraQtyLabel(ex: { qty?: number; timeUnit?: string; qtyLabel?: string }) {
  if (ex.qtyLabel) return ex.qtyLabel
  if (ex.qty && ex.timeUnit) return `${ex.qty} ${ex.timeUnit}`
  if (ex.qty) return String(ex.qty)
  return '1'
}

function extraRackOf(ex: { price: number; rack?: number }) {
  return ex.rack != null ? ex.rack : rackOf(ex.price)
}

export function linesFromServices(services: AddedService[]): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const svc of services) {
    const d = (svc.draft || {}) as Record<string, unknown>
    const type = tabToSummaryType(svc.tab)
    const net = Number(svc.net) || Math.round((svc.price || 0) / 1.3)
    const rack = Number(svc.rack) || svc.price || 0

    // Extras attached to a service become their own "Extras & Special Offers" line(s),
    // so they must be peeled out of the parent service's rolled-up net/rack.
    const extras = extraObjects(d) as {
      id: string
      title: string
      price: number
      rack?: number
      qty?: number
      timeUnit?: string
      qtyLabel?: string
      pax?: number
    }[]
    const extrasNet = extras.reduce((sum, e) => sum + e.price, 0)
    const extrasRack = extras.reduce((sum, e) => sum + extraRackOf(e), 0)
    const parentNet = net - extrasNet
    const parentRack = rack - extrasRack
    const pushExtras = (date: string, pax: number, supplier: string) => {
      for (const ex of extras) {
        lines.push({
          type: 'extra',
          date,
          supplier,
          service: ex.title,
          pax: ex.pax ?? pax,
          qty: extraQtyLabel(ex),
          net: ex.price,
          rack: extraRackOf(ex),
        })
      }
    }

    if (type === 'accommodation') {
      const rooms = asRooms(d)
      const start = String(d.start || rooms[0]?.start || '')
      const end = String(d.end || rooms[0]?.end || '')
      const defaultBasis = String(d.basis || 'bb')
      const supplier = String(d.supplier || svc.title)
      const paxAll = usedGuestIds(rooms).length

      if (rooms.length === 0) {
        lines.push({
          type,
          date: start,
          supplier,
          roomType: 'Room',
          basis: defaultBasis.toUpperCase(),
          rooms: 1,
          pax: paxAll,
          nights: nights(start, end),
          net: parentNet,
          rack: parentRack,
        })
      } else {
        const weights = rooms.map((r) => {
          const rn = nights(r.start || start, r.end || end) || 1
          return Math.max(0.01, (Number(r.rate) || 0) * roomQty(r) * rn)
        })
        const totalW = weights.reduce((a, b) => a + b, 0)
        rooms.forEach((room, i) => {
          const rStart = room.start || start
          const rEnd = room.end || end
          const share = weights[i] / totalW
          lines.push({
            type,
            date: rStart,
            supplier,
            roomType: roomTypeLabel(room.type),
            basis: String(room.basis || defaultBasis).toUpperCase(),
            rooms: roomQty(room),
            pax: room.guestIds.length,
            nights: nights(rStart, rEnd),
            net: Math.round(parentNet * share * 100) / 100,
            rack: Math.round(parentRack * share * 100) / 100,
          })
        })
      }
      pushExtras(start, paxAll || 1, supplier)
      continue
    }

    if (type === 'transfer' && d.transMode === 'hire') {
      const vehicles = asVehicles(d)
      const paxCount = usedGuestIds(vehicles).length
      const serviceLines = consolidateHireRoutes(asHireRoutes(d))
      const supplier = String(d.supplier || d.service || svc.title)

      if (serviceLines.length) {
        serviceLines.forEach((line) => {
          const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
          vehicleLines.forEach((vehicle) => {
            const lineNet = vehicle.rate * line.days
            lines.push({
              type: 'disposal',
              date: line.date,
              supplier,
              vType: vehicle.type,
              location: line.location,
              veh: 1,
              days: line.days,
              pax: vehicle.guestIds.length || paxCount,
              net: lineNet,
              rack: rackOf(lineNet),
            })
          })
        })
        pushExtras(serviceLines[0].date, paxCount, supplier)
      } else {
        const date = String(d.hireStart || '')
        const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
        const totalRate = vehicleLines.reduce((sum, vehicle) => sum + vehicle.rate, 0) || 1
        vehicleLines.forEach((vehicle) => {
          const share = vehicle.rate / totalRate
          lines.push({
            type: 'disposal',
            date,
            supplier,
            vType: vehicle.type,
            location: String(d.location || '—'),
            veh: 1,
            days: transportDays(d),
            pax: vehicle.guestIds.length || paxCount,
            net: Math.round(parentNet * share * 100) / 100,
            rack: Math.round(parentRack * share * 100) / 100,
          })
        })
        pushExtras(date, paxCount, supplier)
      }
      continue
    }

    if (type === 'transfer') {
      const vehicles = asVehicles(d)
      const date = String(d.transDate || '')
      const paxCount = usedGuestIds(vehicles).length
      const supplier = String(d.supplier || d.service || svc.title)
      const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
      const totalRate = vehicleLines.reduce((sum, vehicle) => sum + vehicle.rate, 0) || 1
      vehicleLines.forEach((vehicle) => {
        const share = vehicle.rate / totalRate
        lines.push({
          type,
          date,
          supplier,
          vType: vehicle.type,
          pickup: String(d.pickup || '—'),
          dropoff: String(d.dropoff || '—'),
          veh: 1,
          pax: vehicle.guestIds.length || paxCount,
          net: Math.round(parentNet * share * 100) / 100,
          rack: Math.round(parentRack * share * 100) / 100,
        })
      })
      pushExtras(date, paxCount, supplier)
      continue
    }

    if (type === 'flight') {
      const pax = (d.pax || {}) as Record<string, number>
      const totalPax =
        (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
      const service = String(d.service || '')
      const date = String(d.departDate || '')
      const paxCount = totalPax || flightAutoQty(d)
      const supplier = String(d.supplier || svc.title)
      const fareLines = (Array.isArray(d.fareLines) ? d.fareLines : []) as {
        route: string
        pax: number
        net: number
        rack: number
      }[]
      if (fareLines.length) {
        fareLines.forEach((fare) => {
          lines.push({
            type,
            date,
            supplier,
            charter: /charter/i.test(service) ? 'Charter' : 'Schedule',
            route: fare.route,
            pax: fare.pax,
            net: fare.net,
            rack: fare.rack,
          })
        })
      } else {
        lines.push({
          type,
          date,
          supplier,
          charter: /charter/i.test(service) ? 'Charter' : 'Schedule',
          route: String(d.location || service || '—'),
          pax: paxCount,
          net: parentNet,
          rack: parentRack,
        })
      }
      pushExtras(date, paxCount, supplier)
      continue
    }

    if (type === 'activity') {
      const activities = asActivities(d)
      if (activities.length) {
        for (const a of activities) {
          const aNet = a.guestIds.length > 0 ? a.rate * a.guestIds.length : a.rate
          const aRack = aNet // activity fees in seed are typically 0% margin unless overridden
          lines.push({
            type,
            date: String(a.start || d.startDate || ''),
            supplier: String(d.supplier || svc.title),
            service: a.name,
            pax: a.guestIds.length || undefined,
            net: aNet,
            rack: aRack,
          })
        }
      } else {
        lines.push({
          type,
          date: String(d.startDate || ''),
          supplier: String(d.supplier || svc.title),
          service: String(d.service || svc.subtitle || 'Activity'),
          pax: undefined,
          net: parentNet,
          rack: parentRack,
        })
      }
      pushExtras(String(d.startDate || ''), 0, String(d.supplier || svc.title))
      continue
    }

    const activities = asActivities(d)
    if (activities.length) {
      for (const a of activities) {
        const aNet = a.guestIds.length > 0 ? a.rate * a.guestIds.length : a.rate
        lines.push({
          type: 'other',
          date: String(a.start || d.startDate || ''),
          supplier: String(d.supplier || svc.title),
          service: a.name,
          pax: a.guestIds.length || undefined,
          days: nightsBetween(String(a.start || d.startDate || ''), String(a.end || d.endDate || '')) || 1,
          net: aNet,
          rack: aNet,
        })
      }
      pushExtras(String(d.startDate || ''), 0, String(d.supplier || svc.title))
    } else {
      lines.push({
        type: 'other',
        date: String(d.startDate || ''),
        supplier: String(d.supplier || svc.title),
        service: String(d.description || d.service || 'Other'),
        pax: Number(d.qty) || undefined,
        days: nightsBetween(String(d.startDate || ''), String(d.endDate || '')) || 1,
        net: parentNet,
        rack: parentRack,
      })
      pushExtras(String(d.startDate || ''), Number(d.qty) || 0, String(d.supplier || svc.title))
    }
  }
  return lines
}

/** Fallback when only quote groups exist (no builder services). */
export function linesFromQuoteGroups(groups: QuoteGroup[]): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const g of groups) {
    const type: SummaryServiceType =
      g.icon === 'flight' ? 'flight' : g.icon === 'vehicle' ? 'transfer' : 'accommodation'
    for (const sv of g.services) {
      const amount = parseMoney(sv.subtotal)
      const net = Math.round((amount / 1.3) * 100) / 100
      lines.push({
        type,
        date: String(sv.dates || '').split(/[–-]/)[0]?.trim() || '',
        supplier: g.name,
        roomType: type === 'accommodation' ? sv.title : undefined,
        basis: type === 'accommodation' ? (sv.sub || 'BB').replace(/^[·\s]+/, '') : undefined,
        rooms: type === 'accommodation' ? Number(sv.qty) || 1 : undefined,
        pax: Number(String(sv.alloc || '').match(/(\d+)/)?.[1] || 0) || undefined,
        nights: type === 'accommodation' ? Number(sv.nights) || undefined : undefined,
        charter: type === 'flight' ? 'Schedule' : undefined,
        route: type === 'flight' ? sv.title : undefined,
        vType: type === 'transfer' ? sv.sub || sv.title : undefined,
        pickup: type === 'transfer' ? g.loc : undefined,
        dropoff: type === 'transfer' ? '—' : undefined,
        veh: type === 'transfer' ? Number(sv.qty) || 1 : undefined,
        service: sv.title,
        net,
        rack: amount,
      })
    }
  }
  return lines
}

export type SummaryCard = {
  type: SummaryServiceType
  name: string
  initial: string
  iconBg: string
  iconFg: string
  tint: string
  countLabel: string
  gridCols: string
  headers: { label: string; align: 'l' | 'c' | 'r' }[]
  rows: { cells: string[] }[]
}

const SINGULAR_NOUN: Record<string, string> = {
  stays: 'stay',
  flights: 'flight',
  transfers: 'transfer',
  vehicles: 'vehicle',
  activities: 'activity',
  extras: 'extra',
  services: 'service',
}

function nounLabel(count: number, noun: string) {
  return count === 1 ? SINGULAR_NOUN[noun] || noun : noun
}

/** Same date + supplier consecutive rows share a stay; blank repeated Date/Supplier cells. */
function mergeSupplierRows(items: SummaryLine[], rows: { cells: string[] }[]) {
  rows.forEach((row, i) => {
    const prev = items[i - 1]
    const cur = items[i]
    if (i > 0 && prev && cur && cur.date === prev.date && cur.supplier === prev.supplier) {
      row.cells[0] = ''
      row.cells[1] = ''
    }
  })
  return rows
}

function accommodationCountLabel(items: SummaryLine[]) {
  const stays: Record<string, number> = {}
  items.forEach((s) => {
    const k = `${s.supplier}|${s.date}`
    stays[k] = Math.max(stays[k] || 0, s.nights || 0)
  })
  const keys = Object.keys(stays)
  const nts = keys.reduce((a, k) => a + stays[k], 0)
  return `${keys.length} ${nounLabel(keys.length, 'stays')} · ${nts} ${nounLabel(nts, 'nights')}`
}

export function buildSummaryCards(lines: SummaryLine[]): SummaryCard[] {
  return ORDER.map((type) => {
    const items = lines.filter((s) => s.type === type)
    if (!items.length) return null
    const m = SUMMARY_TYPE_META[type]
    const countLabel =
      type === 'accommodation'
        ? accommodationCountLabel(items)
        : `${items.length} ${nounLabel(items.length, m.noun)}`
    return {
      type,
      name: m.name,
      initial: m.initial,
      iconBg: m.iconBg,
      iconFg: m.iconFg,
      tint: m.tint,
      countLabel,
      gridCols: GRID[type],
      headers: COLS[type].map(([label, align]) => ({ label, align })),
      rows: mergeSupplierRows(items, items.map((s) => ({ cells: cellValues(type, s) }))),
    }
  }).filter(Boolean) as SummaryCard[]
}

export type SummaryDay = {
  dayNum: string
  dateLabel: string
  weekday: string
  groups: SummaryCard[]
}

export function buildSummaryDays(lines: SummaryLine[]): SummaryDay[] {
  const groups: Record<string, SummaryLine[]> = {}
  for (const s of lines) {
    const key = s.date || 'undated'
    ;(groups[key] = groups[key] || []).push(s)
  }
  const keys = Object.keys(groups).sort()
  const firstDated = keys.find((k) => k !== 'undated')
  const first = firstDated ? new Date(`${firstDated}T00:00:00`) : new Date()

  return keys.map((iso) => {
    const dayServices = groups[iso]
    const dayGroups = ORDER.map((type) => {
      const items = dayServices.filter((s) => s.type === type)
      if (!items.length) return null
      const m = SUMMARY_TYPE_META[type]
      return {
        type,
        name: m.name,
        initial: m.initial,
        iconBg: m.iconBg,
        iconFg: m.iconFg,
        tint: m.tint,
        countLabel: '',
        gridCols: GRID[type],
        headers: COLS[type].map(([label, align]) => ({ label, align })),
        rows: mergeSupplierRows(items, items.map((s) => ({ cells: cellValues(type, s) }))),
      } satisfies SummaryCard
    }).filter(Boolean) as SummaryCard[]

    const dayNum =
      iso === 'undated'
        ? 'Day —'
        : `Day ${Math.round((new Date(`${iso}T00:00:00`).getTime() - first.getTime()) / 86400000) + 1}`

    return {
      dayNum,
      dateLabel: iso === 'undated' ? 'Undated' : `${fmtShortDate(iso)} ${iso.slice(0, 4)}`,
      weekday: iso === 'undated' ? '' : weekday(iso),
      groups: dayGroups,
    }
  })
}

export type SummaryPriceGroup = {
  name: string
  subtotal: string
  items: { supplier: string; desc: string; value: string }[]
}

export function buildSummaryPricing(lines: SummaryLine[]) {
  const descOf = (s: SummaryLine) => {
    if (s.type === 'accommodation') return s.roomType || '—'
    if (s.type === 'flight') return s.route || '—'
    if (s.type === 'transfer') return `${s.pickup || '—'} → ${s.dropoff || '—'}`
    if (s.type === 'disposal') return `${s.vType || 'Vehicle'} at disposal · ${s.location || '—'}`
    return s.service || '—'
  }

  const priceGroups = ORDER.map((type) => {
    const gi = lines.filter((s) => s.type === type)
    if (!gi.length) return null
    const sub = gi.reduce((a, s) => a + (s.rack || 0), 0)
    return {
      name: SUMMARY_TYPE_META[type].name,
      subtotal: formatUsd(sub),
      items: gi.map((s) => ({
        supplier: s.supplier,
        desc: descOf(s),
        value: formatUsd(s.rack || 0),
      })),
    }
  }).filter(Boolean) as SummaryPriceGroup[]

  const netCost = lines.reduce((a, s) => a + (s.net || 0), 0)
  const rack = lines.reduce((a, s) => a + (s.rack || 0), 0)
  const margin = rack - netCost
  const marginPct = rack ? Math.round((margin / rack) * 100) : 0
  const commission = Math.round(rack * 0.1)
  const sellTotal = rack

  return {
    priceGroups,
    pricing: [
      { label: 'Net cost', value: formatUsd(netCost), color: '#171717' },
      { label: 'Rack', value: formatUsd(rack), color: '#171717' },
      {
        label: `Margin (${marginPct}%)`,
        value: formatUsd(margin),
        color: '#059669',
      },
      {
        label: 'Agent commission (10%)',
        value: formatUsd(commission),
        color: '#171717',
      },
    ],
    sellTotal: formatUsd(sellTotal),
    sellNumber: sellTotal,
  }
}
