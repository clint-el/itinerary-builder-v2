import { nightsBetween, parseMoney, rackOf } from '@/shared/lib/helpers'
import type { AddedService, QuoteGroup, ServiceTab } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'
import {
  asActivities,
  asRooms,
  asVehicles,
  flightAutoQty,
  nights,
  roomQty,
  usedGuestIds,
} from '@/features/builder/builderUtils'

export type SummaryServiceType =
  | 'accommodation'
  | 'flight'
  | 'transfer'
  | 'activity'
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
  // activity / other
  service?: string
  days?: number
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
  activity: {
    name: 'Activity',
    initial: 'Ac',
    iconBg: '#F3E8FF',
    iconFg: '#7E22CE',
    tint: '#FCF8FF',
    noun: 'activities',
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
  'activity',
  'other',
]

const COLS: Record<SummaryServiceType, [string, 'l' | 'c'][]> = {
  accommodation: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Room Type', 'l'],
    ['Basis', 'c'],
    ['No. of Rooms', 'c'],
    ['No. of Pax', 'c'],
    ['No. of Nights', 'c'],
  ],
  flight: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Charter / Schedule', 'c'],
    ['Route', 'l'],
    ['No. of Pax', 'c'],
  ],
  transfer: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['V. Type', 'l'],
    ['Pick Up', 'l'],
    ['Drop Off', 'l'],
    ['No. of Veh.', 'c'],
    ['No. of Pax', 'c'],
  ],
  activity: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Service', 'l'],
    ['No. of Pax', 'c'],
  ],
  other: [
    ['Date', 'l'],
    ['Supplier', 'l'],
    ['Service', 'l'],
    ['No. of Pax', 'c'],
    ['No. of Days', 'c'],
  ],
}

const GRID: Record<SummaryServiceType, string> = {
  accommodation: '86px minmax(160px,1.7fr) minmax(150px,1.5fr) 76px 104px 92px 104px',
  flight: '86px minmax(160px,1.6fr) 150px minmax(120px,1.2fr) 92px',
  transfer:
    '86px minmax(150px,1.5fr) minmax(90px,1fr) minmax(130px,1.3fr) minmax(130px,1.3fr) 92px 92px',
  activity: '86px minmax(150px,1.5fr) minmax(220px,2.2fr) 92px',
  other: '86px minmax(150px,1.5fr) minmax(220px,2.2fr) 92px 104px',
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
      ]
    case 'flight':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.charter || '—',
        s.route || '—',
        String(s.pax ?? '—'),
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
      ]
    case 'activity':
      return [fmtShortDate(s.date), s.supplier, s.service || '—', String(s.pax ?? '—')]
    case 'other':
      return [
        fmtShortDate(s.date),
        s.supplier,
        s.service || '—',
        String(s.pax ?? '—'),
        String(s.days ?? '—'),
      ]
  }
}

export function linesFromServices(services: AddedService[]): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const svc of services) {
    const d = (svc.draft || {}) as Record<string, unknown>
    const type = tabToSummaryType(svc.tab)
    const net = Number(svc.net) || Math.round((svc.price || 0) / 1.3)
    const rack = Number(svc.rack) || svc.price || 0

    if (type === 'accommodation') {
      const rooms = asRooms(d)
      const roomCount = rooms.reduce((sum, r) => sum + roomQty(r), 0) || rooms.length || 1
      const pax = usedGuestIds(rooms).length
      const start = String(d.start || rooms[0]?.start || '')
      const end = String(d.end || rooms[0]?.end || '')
      const basisKey = String(d.basis || 'bb')
      lines.push({
        type,
        date: start,
        supplier: String(d.supplier || svc.title),
        roomType: rooms.map((r) => r.type).filter(Boolean).join(', ') || 'Room',
        basis: String(basisKey || 'bb').toUpperCase(),
        rooms: roomCount,
        pax,
        nights: nights(start, end),
        net,
        rack,
      })
      continue
    }

    if (type === 'transfer') {
      const vehicles = asVehicles(d)
      const date =
        d.transMode === 'hire'
          ? String(d.hireStart || '')
          : String(d.transDate || '')
      lines.push({
        type,
        date,
        supplier: String(d.supplier || d.service || svc.title),
        vType: vehicles.map((v) => v.type).join(', ') || 'Vehicle',
        pickup: String(d.pickup || '—'),
        dropoff: String(d.dropoff || '—'),
        veh: vehicles.length || 1,
        pax: usedGuestIds(vehicles).length,
        net,
        rack,
      })
      continue
    }

    if (type === 'flight') {
      const pax = (d.pax || {}) as Record<string, number>
      const totalPax =
        (pax.adult || 0) + (pax.youth || 0) + (pax.child || 0) + (pax.infant || 0)
      const service = String(d.service || '')
      lines.push({
        type,
        date: String(d.departDate || ''),
        supplier: String(d.supplier || svc.title),
        charter: /charter/i.test(service) ? 'Charter' : 'Schedule',
        route: String(d.location || service || '—'),
        pax: totalPax || flightAutoQty(d),
        net,
        rack,
      })
      continue
    }

    if (type === 'activity') {
      const activities = asActivities(d)
      if (activities.length) {
        for (const a of activities) {
          const aNet = a.rate * a.guestIds.length
          lines.push({
            type,
            date: String(a.start || d.startDate || ''),
            supplier: String(d.supplier || svc.title),
            service: a.name,
            pax: a.guestIds.length,
            net: aNet,
            rack: rackOf(aNet),
          })
        }
      } else {
        lines.push({
          type,
          date: String(d.startDate || ''),
          supplier: String(d.supplier || svc.title),
          service: String(d.service || svc.subtitle || 'Activity'),
          pax: 0,
          net,
          rack,
        })
      }
      continue
    }

    const activities = asActivities(d)
    if (activities.length) {
      for (const a of activities) {
        const aNet = a.rate * a.guestIds.length
        lines.push({
          type: 'other',
          date: String(a.start || d.startDate || ''),
          supplier: String(d.supplier || svc.title),
          service: a.name,
          pax: a.guestIds.length,
          days: nightsBetween(String(d.startDate || ''), String(d.endDate || '')) || 1,
          net: aNet,
          rack: rackOf(aNet),
        })
      }
    } else {
      lines.push({
        type: 'other',
        date: String(d.startDate || ''),
        supplier: String(d.supplier || svc.title),
        service: String(d.description || d.service || 'Other'),
        pax: Number(d.qty) || 1,
        days: nightsBetween(String(d.startDate || ''), String(d.endDate || '')) || 1,
        net,
        rack,
      })
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
  headers: { label: string; align: 'l' | 'c' }[]
  rows: { cells: string[] }[]
}

export function buildSummaryCards(lines: SummaryLine[]): SummaryCard[] {
  return ORDER.map((type) => {
    const items = lines.filter((s) => s.type === type)
    if (!items.length) return null
    const m = SUMMARY_TYPE_META[type]
    let countLabel = `${items.length} ${m.noun}`
    if (type === 'accommodation') {
      const nts = items.reduce((a, s) => a + (s.nights || 0), 0)
      countLabel = `${items.length} stays · ${nts} nights`
    }
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
      rows: items.map((s) => ({ cells: cellValues(type, s) })),
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
        rows: items.map((s) => ({ cells: cellValues(type, s) })),
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
    return s.service || '—'
  }

  const priceGroups = ORDER.map((type) => {
    const gi = lines.filter((s) => s.type === type)
    if (!gi.length) return null
    const sub = gi.reduce((a, s) => a + (s.net || 0), 0)
    return {
      name: SUMMARY_TYPE_META[type].name,
      subtotal: formatUsd(sub),
      items: gi.map((s) => ({
        supplier: s.supplier,
        desc: descOf(s),
        value: formatUsd(s.net || 0),
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
