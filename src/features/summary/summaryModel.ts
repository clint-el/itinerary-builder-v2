import { nightsBetween, parseMoney, rackOf } from '@/shared/lib/helpers'
import { applyOfferToCostAndSell, roomTypeLabel } from '@/shared/lib/catalogs'
import type { AddedService, Guest, Hold, QuoteGroup, ServiceTab } from '@/shared/lib/types'
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

export type SummaryServiceType = 'accommodation' | 'flight' | 'transportation' | 'activity' | 'extra' | 'other'

export type LineDiscount = { label: string; sellDelta: number; costDelta: number }

export type SummaryLine = {
  type: SummaryServiceType
  serviceId: string
  date: string
  supplier: string
  net: number
  rack: number
  hold: 'held' | 'requested' | 'none'
  discount?: LineDiscount
  ad?: number
  ch?: number
  // accommodation
  roomType?: string
  basis?: string
  rooms?: number
  pax?: number
  nights?: number
  end?: string
  // flight
  route?: string
  charter?: string
  depart?: string
  arrive?: string
  // transportation (transfer / disposal, merged)
  kind?: 'transfer' | 'disposal'
  vType?: string
  pickup?: string
  dropoff?: string
  location?: string
  veh?: number
  days?: number
  // activity / other / extra
  service?: string
  alloc?: string
  // extra
  qty?: string
  extraKind?: 'service' | 'supplier'
}

export const SUMMARY_TYPE_META: Record<
  SummaryServiceType,
  { name: string; initial: string; iconBg: string; iconFg: string; noun: string }
> = {
  accommodation: { name: 'Accommodation', initial: 'A', iconBg: '#ECFDF5', iconFg: '#059669', noun: 'stays' },
  flight: { name: 'Flights', initial: 'F', iconBg: '#EFF6FF', iconFg: '#2563EB', noun: 'sectors' },
  transportation: { name: 'Transportation', initial: 'T', iconBg: '#FEF3C7', iconFg: '#D97706', noun: 'services' },
  activity: { name: 'Activities', initial: 'Ac', iconBg: '#F3E8FF', iconFg: '#7E22CE', noun: 'activities' },
  extra: { name: 'Extras', initial: 'E', iconBg: '#E0F2FE', iconFg: '#0369A1', noun: 'extras' },
  other: { name: 'Other Services', initial: 'O', iconBg: '#F1F5F9', iconFg: '#475569', noun: 'services' },
}

const ORDER: SummaryServiceType[] = ['accommodation', 'flight', 'transportation', 'activity', 'other']
const BY_DAY_ORDER: SummaryServiceType[] = [
  'accommodation',
  'flight',
  'transportation',
  'activity',
  'extra',
  'other',
]

function guestMix(ids: number[], guests: Guest[]): { ad: number; ch: number } {
  let ad = 0
  let ch = 0
  for (const id of ids) {
    const g = guests.find((x) => x.id === Number(id))
    if (!g) continue
    if (g.type === 'adult' || g.type === 'youth') ad += 1
    else ch += 1
  }
  return { ad, ch }
}

function holdOf(d: Record<string, unknown>): 'held' | 'requested' | 'none' {
  const holds = (Array.isArray(d.holds) ? d.holds : []) as Hold[]
  if (holds.some((h) => h.status === 'Held')) return 'held'
  if (holds.some((h) => h.status === 'Requested')) return 'requested'
  return 'none'
}

/** Flat discount and special offers come off BOTH cost and sell (supplier-granted). */
function discountOf(d: Record<string, unknown>, net: number, rack: number): LineDiscount | undefined {
  const offer = applyOfferToCostAndSell(net, rack, Number(d.discount) || 0, String(d.promotion || '') || null)
  if (offer.sellDelta <= 0 && offer.costDelta <= 0) return undefined
  return { label: offer.label, sellDelta: offer.sellDelta, costDelta: offer.costDelta }
}

function wholeUsd(n: number) {
  return `$${Math.round(n || 0).toLocaleString('en-US')}`
}

function fmtShortDate(iso?: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  return `${String(d).padStart(2, '0')} ${mon}`
}

function weekday(iso: string) {
  const dt = new Date(`${iso}T00:00:00`)
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dt.getDay()]
}

function tabToSummaryType(tab: ServiceTab): SummaryServiceType {
  if (tab === 'transportation') return 'transportation'
  return tab
}

export function linesFromServices(services: AddedService[], guests: Guest[]): SummaryLine[] {
  const lines: SummaryLine[] = []

  for (const svc of services) {
    const d = (svc.draft || {}) as Record<string, unknown>
    const type = tabToSummaryType(svc.tab)
    const net = Number(svc.net) || Math.round((svc.price || 0) / 1.3)
    const rack = Number(svc.rack) || svc.price || 0

    const extras = extraObjects(d) as {
      id: string
      title: string
      price: number
      rack?: number
      qty?: number
      timeUnit?: string
      qtyLabel?: string
      pax?: number
      custom?: boolean
    }[]
    const extrasNet = extras.reduce((sum, e) => sum + e.price, 0)
    const extrasRack = extras.reduce((sum, e) => sum + (e.rack != null ? e.rack : rackOf(e.price)), 0)
    const parentNet = net - extrasNet
    const parentRack = rack - extrasRack
    const hold = holdOf(d)

    const applyDiscount = (groupStart: number) => {
      const disc = discountOf(d, parentNet, parentRack)
      if (!disc) return
      const group = lines.slice(groupStart)
      const totalRack = group.reduce((a, l) => a + l.rack, 0) || 1
      const totalNet = group.reduce((a, l) => a + l.net, 0) || 1
      for (const l of group) {
        l.discount = {
          label: disc.label,
          sellDelta: Math.round(disc.sellDelta * (l.rack / totalRack) * 100) / 100,
          costDelta: Math.round(disc.costDelta * (l.net / totalNet) * 100) / 100,
        }
      }
    }

    const pushExtras = (groupStart: number, date: string, pax: number, supplier: string) => {
      applyDiscount(groupStart)
      for (const ex of extras) {
        lines.push({
          type: 'extra',
          serviceId: svc.id,
          date,
          supplier,
          service: ex.title,
          pax: ex.pax ?? pax,
          qty:
            ex.qtyLabel ||
            (ex.qty && ex.timeUnit ? `${ex.qty} ${ex.timeUnit}` : ex.qty ? String(ex.qty) : '1'),
          extraKind: ex.custom ? 'supplier' : 'service',
          net: ex.price,
          rack: ex.rack != null ? ex.rack : rackOf(ex.price),
          hold,
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
      const groupStart = lines.length

      if (rooms.length === 0) {
        lines.push({
          type,
          serviceId: svc.id,
          date: start,
          end,
          supplier,
          roomType: 'Room',
          basis: defaultBasis.toUpperCase(),
          rooms: 1,
          pax: paxAll,
          nights: nights(start, end),
          net: parentNet,
          rack: parentRack,
          hold,
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
          const mix = guestMix(room.guestIds, guests)
          lines.push({
            type,
            serviceId: svc.id,
            date: rStart,
            end: rEnd,
            supplier,
            roomType: roomTypeLabel(room.type),
            basis: String(room.basis || defaultBasis).toUpperCase(),
            rooms: roomQty(room),
            pax: room.guestIds.length,
            ad: mix.ad,
            ch: mix.ch,
            nights: nights(rStart, rEnd),
            net: Math.round(parentNet * share * 100) / 100,
            rack: Math.round(parentRack * share * 100) / 100,
            hold,
          })
        })
      }
      pushExtras(groupStart, start, paxAll || 1, supplier)
      continue
    }

    if (type === 'transportation' && d.transMode === 'hire') {
      const vehicles = asVehicles(d)
      const paxCount = usedGuestIds(vehicles).length
      const serviceLines = consolidateHireRoutes(asHireRoutes(d))
      const supplier = String(d.supplier || d.service || svc.title)
      const groupStart = lines.length

      if (serviceLines.length) {
        serviceLines.forEach((line) => {
          const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
          vehicleLines.forEach((vehicle) => {
            const lineNet = vehicle.rate * line.days
            const mix = guestMix(vehicle.guestIds, guests)
            lines.push({
              type,
              kind: 'disposal',
              serviceId: svc.id,
              date: line.date,
              supplier,
              vType: vehicle.type,
              location: line.location,
              veh: 1,
              days: line.days,
              pax: vehicle.guestIds.length || paxCount,
              ad: mix.ad,
              ch: mix.ch,
              net: lineNet,
              rack: rackOf(lineNet),
              hold,
            })
          })
        })
        pushExtras(groupStart, serviceLines[0].date, paxCount, supplier)
      } else {
        const date = String(d.hireStart || '')
        const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
        const totalRate = vehicleLines.reduce((sum, vehicle) => sum + vehicle.rate, 0) || 1
        vehicleLines.forEach((vehicle) => {
          const share = vehicle.rate / totalRate
          const mix = guestMix(vehicle.guestIds, guests)
          lines.push({
            type,
            kind: 'disposal',
            serviceId: svc.id,
            date,
            supplier,
            vType: vehicle.type,
            location: String(d.location || '—'),
            veh: 1,
            days: transportDays(d),
            pax: vehicle.guestIds.length || paxCount,
            ad: mix.ad,
            ch: mix.ch,
            net: Math.round(parentNet * share * 100) / 100,
            rack: Math.round(parentRack * share * 100) / 100,
            hold,
          })
        })
        pushExtras(groupStart, date, paxCount, supplier)
      }
      continue
    }

    if (type === 'transportation') {
      const vehicles = asVehicles(d)
      const date = String(d.transDate || '')
      const paxCount = usedGuestIds(vehicles).length
      const supplier = String(d.supplier || d.service || svc.title)
      const vehicleLines = vehicles.length ? vehicles : [{ type: 'Vehicle', rate: parentNet, guestIds: [] }]
      const totalRate = vehicleLines.reduce((sum, vehicle) => sum + vehicle.rate, 0) || 1
      const groupStart = lines.length
      vehicleLines.forEach((vehicle) => {
        const share = vehicle.rate / totalRate
        const mix = guestMix(vehicle.guestIds, guests)
        lines.push({
          type,
          kind: 'transfer',
          serviceId: svc.id,
          date,
          supplier,
          vType: vehicle.type,
          pickup: String(d.pickup || '—'),
          dropoff: String(d.dropoff || '—'),
          veh: 1,
          pax: vehicle.guestIds.length || paxCount,
          ad: mix.ad,
          ch: mix.ch,
          net: Math.round(parentNet * share * 100) / 100,
          rack: Math.round(parentRack * share * 100) / 100,
          hold,
        })
      })
      pushExtras(groupStart, date, paxCount, supplier)
      continue
    }

    if (type === 'flight') {
      const pax = (d.pax || {}) as Record<string, number>
      const mix = { ad: (pax.adult || 0) + (pax.youth || 0), ch: (pax.child || 0) + (pax.infant || 0) }
      const totalPax = mix.ad + mix.ch
      const service = String(d.service || '')
      const date = String(d.departDate || '')
      const departTime = String(d.departTime || '')
      const returnTime = d.flightMode === 'return' ? String(d.returnTime || '') : ''
      const paxCount = totalPax || flightAutoQty(d)
      const supplier = String(d.supplier || svc.title)
      const charter = /charter/i.test(service) ? 'Charter' : 'Schedule'
      const fareLines = (Array.isArray(d.fareLines) ? d.fareLines : []) as {
        route: string
        pax: number
        net: number
        rack: number
      }[]
      const groupStart = lines.length
      if (fareLines.length) {
        fareLines.forEach((fare) => {
          lines.push({
            type,
            serviceId: svc.id,
            date,
            supplier,
            charter,
            route: fare.route,
            depart: departTime,
            arrive: returnTime,
            pax: fare.pax,
            ad: mix.ad,
            ch: mix.ch,
            net: fare.net,
            rack: fare.rack,
            hold,
          })
        })
      } else {
        lines.push({
          type,
          serviceId: svc.id,
          date,
          supplier,
          charter,
          route: String(d.location || service || '—'),
          depart: departTime,
          arrive: returnTime,
          pax: paxCount,
          ad: mix.ad,
          ch: mix.ch,
          net: parentNet,
          rack: parentRack,
          hold,
        })
      }
      pushExtras(groupStart, date, paxCount, supplier)
      continue
    }

    if (type === 'activity') {
      const activities = asActivities(d)
      const supplier = String(d.supplier || svc.title)
      const groupStart = lines.length
      if (activities.length) {
        for (const a of activities) {
          const mix = guestMix(a.guestIds, guests)
          const aNet = a.guestIds.length > 0 ? a.rate * a.guestIds.length : a.rate
          const aRack = aNet
          lines.push({
            type,
            serviceId: svc.id,
            date: String(a.start || d.startDate || ''),
            supplier,
            service: a.name,
            pax: a.guestIds.length || undefined,
            ad: mix.ad,
            ch: mix.ch,
            net: aNet,
            rack: aRack,
            hold,
          })
        }
      } else {
        lines.push({
          type,
          serviceId: svc.id,
          date: String(d.startDate || ''),
          supplier,
          service: String(d.service || svc.subtitle || 'Activity'),
          pax: undefined,
          net: parentNet,
          rack: parentRack,
          hold,
        })
      }
      pushExtras(groupStart, String(d.startDate || ''), 0, supplier)
      continue
    }

    const supplier = String(d.supplier || svc.title)
    const activities = asActivities(d)
    const groupStart = lines.length
    if (activities.length) {
      for (const a of activities) {
        const mix = guestMix(a.guestIds, guests)
        const aNet = a.guestIds.length > 0 ? a.rate * a.guestIds.length : a.rate
        lines.push({
          type: 'other',
          serviceId: svc.id,
          date: String(a.start || d.startDate || ''),
          supplier,
          service: a.name,
          pax: a.guestIds.length || undefined,
          ad: mix.ad,
          ch: mix.ch,
          alloc: a.guestIds.length === 1 ? 'Single guest' : a.guestIds.length ? undefined : 'All guests',
          days: nightsBetween(String(a.start || d.startDate || ''), String(a.end || d.endDate || '')) || 1,
          net: aNet,
          rack: aNet,
          hold,
        })
      }
    } else {
      lines.push({
        type: 'other',
        serviceId: svc.id,
        date: String(d.startDate || ''),
        supplier,
        service: String(d.description || d.service || 'Other'),
        pax: Number(d.qty) || undefined,
        alloc: 'All guests',
        days: nightsBetween(String(d.startDate || ''), String(d.endDate || '')) || 1,
        net: parentNet,
        rack: parentRack,
        hold,
      })
    }
    pushExtras(groupStart, String(d.startDate || ''), Number(d.qty) || 0, supplier)
  }
  return lines
}

/** Fallback when only quote groups exist (no builder services). */
export function linesFromQuoteGroups(groups: QuoteGroup[]): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const g of groups) {
    const type: SummaryServiceType =
      g.icon === 'flight' ? 'flight' : g.icon === 'vehicle' ? 'transportation' : 'accommodation'
    for (const sv of g.services) {
      const amount = parseMoney(sv.subtotal)
      const net = Math.round((amount / 1.3) * 100) / 100
      lines.push({
        type,
        serviceId: g.id,
        date: String(sv.dates || '').split(/[–-]/)[0]?.trim() || '',
        supplier: g.name,
        roomType: type === 'accommodation' ? sv.title : undefined,
        basis: type === 'accommodation' ? (sv.sub || 'BB').replace(/^[·\s]+/, '') : undefined,
        rooms: type === 'accommodation' ? Number(sv.qty) || 1 : undefined,
        pax: Number(String(sv.alloc || '').match(/(\d+)/)?.[1] || 0) || undefined,
        nights: type === 'accommodation' ? Number(sv.nights) || undefined : undefined,
        charter: type === 'flight' ? 'Schedule' : undefined,
        route: type === 'flight' ? sv.title : undefined,
        kind: type === 'transportation' ? 'transfer' : undefined,
        vType: type === 'transportation' ? sv.sub || sv.title : undefined,
        pickup: type === 'transportation' ? g.loc : undefined,
        dropoff: type === 'transportation' ? '—' : undefined,
        veh: type === 'transportation' ? Number(sv.qty) || 1 : undefined,
        service: sv.title,
        net,
        rack: amount,
        hold: 'none',
      })
    }
  }
  return lines
}

// ---------------------------------------------------------------------------
// Cards: type -> supplier/stay blocks -> rows (+ nested extras), matching the
// v2 design's grouped layout. Every table gets Hold + separate Cost/Sell/Margin
// columns instead of a single combined string.
// ---------------------------------------------------------------------------

export type SummaryCell = { label: string; align: 'l' | 'c' | 'r' }

export type SummaryRow = {
  isChild: boolean
  cells: string[]
  meta?: string
  kind?: 'service' | 'supplier'
}

export type SummaryBlock = {
  key: string
  name: string
  meta: string
  subtotal: string
  rows: SummaryRow[]
}

export type SummaryCard = {
  type: SummaryServiceType
  name: string
  initial: string
  iconBg: string
  iconFg: string
  countLabel: string
  subtotal: string
  headers: SummaryCell[]
  blocks: SummaryBlock[]
}

function mgnPct(net: number, rack: number) {
  return rack > 0 ? Math.round(((rack - net) / rack) * 100) : 0
}

function priceCells(l: SummaryLine): string[] {
  const costEff = costEffOf(l)
  const sellEff = sellEffOf(l)
  const pct = mgnPct(costEff, sellEff)
  const holdLabel = l.hold === 'held' ? 'On hold' : l.hold === 'requested' ? 'Requested' : '—'
  let marginCell = pct ? `${pct}%` : '—'
  if (l.discount) {
    const discPct = l.rack > 0 ? Math.round((l.discount.sellDelta / l.rack) * 100) : 0
    marginCell += `  ·  ↓${discPct}%`
  }
  return [holdLabel, wholeUsd(costEff), wholeUsd(sellEff), marginCell]
}

function guestsCell(l: SummaryLine): string {
  if (l.ad || l.ch) return [l.ad ? `${l.ad} ad` : null, l.ch ? `${l.ch} ch` : null].filter(Boolean).join(' · ')
  return l.pax != null ? String(l.pax) : '—'
}

function perGuestPriceCell(l: SummaryLine): string {
  const costEff = costEffOf(l)
  const sellEff = sellEffOf(l)
  const adults = l.ad || 0
  const children = l.ch || 0
  const weightedGuests = adults + children * 0.6
  if (!weightedGuests) return '—'
  const costAdult = costEff / weightedGuests
  const sellAdult = sellEff / weightedGuests
  const parts = []
  if (adults) parts.push(`Ad ${wholeUsd(costAdult)} / ${wholeUsd(sellAdult)}`)
  if (children) parts.push(`Ch ${wholeUsd(costAdult * 0.6)} / ${wholeUsd(sellAdult * 0.6)}`)
  return parts.join(' · ')
}

function combinedPriceCell(l: SummaryLine): string {
  const costEff = costEffOf(l)
  const sellEff = sellEffOf(l)
  const margin = mgnPct(costEff, sellEff)
  const discount = l.discount && l.rack > 0 ? ` · ↓${Math.round((l.discount.sellDelta / l.rack) * 100)}%` : ''
  return `${wholeUsd(costEff)} / ${wholeUsd(sellEff)} · ${margin}%${discount}`
}

export const GRID: Record<SummaryServiceType, string> = {
  accommodation:
    '76px minmax(180px,1.8fr) minmax(200px,2fr) 56px 62px 54px 62px 78px 176px 168px',
  flight:
    '76px minmax(180px,1.7fr) 104px minmax(132px,1.2fr) minmax(150px,1.4fr) 54px 78px 176px 168px',
  transportation:
    '76px minmax(180px,1.5fr) minmax(90px,1fr) minmax(140px,1.4fr) minmax(130px,1.3fr) 58px 58px 54px 78px 176px 168px',
  activity: '76px minmax(180px,1.5fr) minmax(200px,2fr) 54px 78px 176px 168px',
  other:
    '76px minmax(180px,1.5fr) minmax(200px,1.9fr) 54px 58px minmax(120px,1fr) 78px 176px 168px',
  extra: '76px minmax(180px,1.6fr) minmax(220px,2.2fr) 54px 84px 78px 176px 168px',
}

const HOLD_COL: SummaryCell = { label: 'Hold', align: 'c' }
const PRICE_COLS: SummaryCell[] = [
  HOLD_COL,
  { label: 'Per Adult / Child (USD)', align: 'r' },
  { label: 'Cost / Sell · Margin (USD)', align: 'r' },
]

const HEADERS: Record<SummaryServiceType, SummaryCell[]> = {
  accommodation: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'Room Type', align: 'l' },
    { label: 'Basis', align: 'c' },
    { label: 'Rooms', align: 'c' },
    { label: 'Pax', align: 'c' },
    { label: 'Nights', align: 'c' },
    ...PRICE_COLS,
  ],
  flight: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'Charter / Schedule', align: 'c' },
    { label: 'Route', align: 'l' },
    { label: 'Flight Date & Time', align: 'l' },
    { label: 'Pax', align: 'c' },
    ...PRICE_COLS,
  ],
  transportation: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'V. Type', align: 'l' },
    { label: 'Pick Up / At Disposal In', align: 'l' },
    { label: 'Drop off', align: 'l' },
    { label: 'Veh.', align: 'c' },
    { label: 'Days', align: 'c' },
    { label: 'Pax', align: 'c' },
    ...PRICE_COLS,
  ],
  activity: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'Service', align: 'l' },
    { label: 'Pax', align: 'c' },
    ...PRICE_COLS,
  ],
  other: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'Service', align: 'l' },
    { label: 'Pax', align: 'c' },
    { label: 'Days', align: 'c' },
    { label: 'Allocation', align: 'l' },
    ...PRICE_COLS,
  ],
  extra: [
    { label: 'Date', align: 'l' },
    { label: 'Supplier', align: 'l' },
    { label: 'Extra', align: 'l' },
    { label: 'Pax', align: 'c' },
    { label: 'Qty', align: 'c' },
    ...PRICE_COLS,
  ],
}

function rowCells(type: SummaryServiceType, l: SummaryLine): string[] {
  switch (type) {
    case 'accommodation':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.roomType || '—',
        l.basis || '—',
        String(l.rooms ?? '—'),
        String(l.pax ?? ((l.ad || 0) + (l.ch || 0) || '—')),
        String(l.nights ?? '—'),
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
    case 'flight':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.charter || '—',
        l.route || '—',
        `${fmtShortDate(l.date)} · ${l.depart || '—'} → ${l.arrive || '—'}`,
        String(l.pax ?? ((l.ad || 0) + (l.ch || 0) || '—')),
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
    case 'transportation':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.vType || '—',
        l.kind === 'disposal' ? l.location || '—' : l.pickup || '—',
        l.kind === 'disposal' ? '—' : l.dropoff || '—',
        String(l.veh ?? '—'),
        String(l.days ?? '—'),
        String(l.pax ?? '—'),
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
    case 'activity':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.service || '—',
        String(l.pax ?? ((l.ad || 0) + (l.ch || 0) || '—')),
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
    case 'other':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.service || '—',
        String(l.pax ?? '—'),
        String(l.days ?? '—'),
        l.alloc || 'All guests',
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
    case 'extra':
      return [
        fmtShortDate(l.date),
        l.supplier,
        l.service || '—',
        String(l.pax ?? '—'),
        l.qty || '—',
        priceCells(l)[0],
        perGuestPriceCell(l),
        combinedPriceCell(l),
      ]
  }
}

function sellEffOf(l: SummaryLine) {
  return l.rack - (l.discount?.sellDelta || 0)
}

function costEffOf(l: SummaryLine) {
  return l.net - (l.discount?.costDelta || 0)
}

function blockKey(type: SummaryServiceType, l: SummaryLine) {
  return type === 'accommodation' ? `${l.supplier}|${l.date}` : l.supplier
}

function blockMeta(type: SummaryServiceType, group: SummaryLine[]): string {
  const first = group[0]
  if (type === 'accommodation') {
    return `${fmtShortDate(first.date)} – ${fmtShortDate(first.end)}  ·  ${first.nights} ${first.nights === 1 ? 'night' : 'nights'}  ·  ${first.basis}`
  }
  if (type === 'flight') {
    return `${group.length} ${group.length === 1 ? 'sector' : 'sectors'}`
  }
  const dates = group.map((l) => l.date).filter(Boolean).sort()
  if (!dates.length) return '—'
  return dates[0] === dates[dates.length - 1] ? fmtShortDate(dates[0]) : `${fmtShortDate(dates[0])} – ${fmtShortDate(dates[dates.length - 1])}`
}

function extraChildRow(e: SummaryLine): SummaryRow {
  return {
    isChild: true,
    kind: e.extraKind || 'service',
    meta: `${e.pax ?? 0} pax${e.qty ? `  ·  ${e.qty}` : ''}`,
    cells: [e.service || 'Extra', combinedPriceCell(e)],
  }
}

export function buildSummaryCards(lines: SummaryLine[]): SummaryCard[] {
  const extrasByService = new Map<string, SummaryLine[]>()
  for (const l of lines.filter((s) => s.type === 'extra')) {
    const arr = extrasByService.get(l.serviceId) || []
    arr.push(l)
    extrasByService.set(l.serviceId, arr)
  }

  const emittedExtras = new Set<string>()
  return ORDER.map((type) => {
    const items = lines.filter((s) => s.type === type).slice().sort((a, b) => a.date.localeCompare(b.date))
    if (!items.length) return null
    const m = SUMMARY_TYPE_META[type]

    const order: string[] = []
    const byKey = new Map<string, SummaryLine[]>()
    for (const l of items) {
      const k = blockKey(type, l)
      if (!byKey.has(k)) {
        order.push(k)
        byKey.set(k, [])
      }
      byKey.get(k)!.push(l)
    }

    const blocks: SummaryBlock[] = order.map((k) => {
      const group = byKey.get(k)!
      const first = group[0]
      const rows: SummaryRow[] = []
      let blockSell = 0
      for (const [index, l] of group.entries()) {
        const cells = rowCells(type, l)
        const previous = group[index - 1]
        if (previous?.date === l.date) cells[0] = ''
        if (previous?.supplier === l.supplier) cells[1] = ''
        rows.push({ isChild: false, cells })
        blockSell += sellEffOf(l)
      }
      for (const l of group) {
        if (emittedExtras.has(l.serviceId)) continue
        emittedExtras.add(l.serviceId)
        for (const extra of extrasByService.get(l.serviceId) || []) {
          rows.push(extraChildRow(extra))
          blockSell += sellEffOf(extra)
        }
      }
      return {
        key: k,
        name: first.supplier,
        meta: blockMeta(type, group),
        subtotal: wholeUsd(blockSell),
        rows,
      }
    })

    const cardSell = blocks.reduce((a, b) => a + parseMoney(b.subtotal), 0)
    const countLabel =
      type === 'accommodation'
        ? (() => {
            const stayCount = order.length
            const nts = order.reduce((a, k) => a + (byKey.get(k)![0].nights || 0), 0)
            return `${stayCount} ${stayCount === 1 ? 'stay' : 'stays'}  ·  ${nts} ${nts === 1 ? 'night' : 'nights'}`
          })()
        : `${items.length} ${items.length === 1 ? m.noun.replace(/s$/, '') : m.noun}`

    return {
      type,
      name: m.name,
      initial: m.initial,
      iconBg: m.iconBg,
      iconFg: m.iconFg,
      countLabel,
      subtotal: wholeUsd(cardSell),
      headers: HEADERS[type],
      blocks,
    }
  }).filter(Boolean) as SummaryCard[]
}

// ---------------------------------------------------------------------------
// By-day: one flat chronological row per service, extras included as their own rows.
// ---------------------------------------------------------------------------

export type SummaryDayItem = {
  typeLabel: string
  typeColor: string
  title: string
  detail: string
  cost: string
  sell: string
  margin: string
}

export type SummaryDay = {
  dayNum: string
  dateLabel: string
  weekday: string
  items: SummaryDayItem[]
}

const DAY_TYPE_LABEL: Record<SummaryServiceType, string> = {
  accommodation: 'Stay',
  flight: 'Flight',
  transportation: 'Transport',
  activity: 'Activity',
  extra: 'Extra',
  other: 'Service',
}

function dayTitleOf(l: SummaryLine): string {
  switch (l.type) {
    case 'accommodation':
      return `${l.supplier} — ${l.roomType || 'Room'}`
    case 'flight':
      return `${l.route || '—'}  ·  ${l.supplier}`
    case 'transportation':
      return l.kind === 'disposal' ? `${l.vType || 'Vehicle'} at disposal, ${l.location || '—'}` : `${l.pickup || '—'} → ${l.dropoff || '—'}`
    default:
      return l.service || l.supplier
  }
}

function dayDetailOf(l: SummaryLine): string {
  switch (l.type) {
    case 'accommodation':
      return `${l.basis || '—'}  ·  ${l.nights ?? '—'} nights  ·  ${guestsCell(l)}`
    case 'flight':
      return `${l.depart || '—'} → ${l.arrive || '—'}  ·  ${guestsCell(l)}`
    case 'transportation':
      return l.kind === 'disposal' ? `${l.days ?? '—'} day  ·  ${l.pax ?? '—'} pax` : `${l.vType || '—'}  ·  ${l.pax ?? '—'} pax`
    case 'other':
      return `${l.supplier}  ·  ${l.alloc || ''}`
    case 'extra':
      return `${l.supplier}  ·  ${l.qty || ''}`
    default:
      return `${l.supplier}  ·  ${guestsCell(l)}`
  }
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
    const dayNum =
      iso === 'undated'
        ? 'Day —'
        : `Day ${Math.round((new Date(`${iso}T00:00:00`).getTime() - first.getTime()) / 86400000) + 1}`

    const items = groups[iso]
      .slice()
      .sort((a, b) => BY_DAY_ORDER.indexOf(a.type) - BY_DAY_ORDER.indexOf(b.type))
      .map((l) => {
        const costEff = costEffOf(l)
        const sellEff = sellEffOf(l)
        const pct = mgnPct(costEff, sellEff)
        const m = SUMMARY_TYPE_META[l.type]
        return {
          typeLabel: DAY_TYPE_LABEL[l.type],
          typeColor: m.iconFg,
          title: dayTitleOf(l),
          detail: dayDetailOf(l),
          cost: wholeUsd(costEff),
          sell: wholeUsd(sellEff),
          margin: (pct ? `${pct}%` : '—') + (l.discount ? `  ↓${l.rack > 0 ? Math.round((l.discount.sellDelta / l.rack) * 100) : 0}%` : ''),
        }
      })

    return {
      dayNum,
      dateLabel: iso === 'undated' ? 'Undated' : `${fmtShortDate(iso)} ${iso.slice(0, 4)}`,
      weekday: iso === 'undated' ? '' : weekday(iso),
      items,
    }
  })
}

// ---------------------------------------------------------------------------
// Pricing sidebar: sell total, offers & discounts, sell-by-service-type, breakdown.
// ---------------------------------------------------------------------------

export type SummaryDiscount = {
  label: string
  pct: string
  sellDelta: string
  costDelta: string
}

export type SummaryGroupTotal = {
  name: string
  value: string
  color: string
}

export type SummaryPricing = {
  sellTotal: string
  sellNumber: number
  perPerson: string
  discounts: SummaryDiscount[]
  hasDiscounts: boolean
  discountTotal: string
  groupTotals: SummaryGroupTotal[]
  pricing: { label: string; value: string; color: string; muted?: boolean }[]
}

export function buildSummaryPricing(lines: SummaryLine[], totalGuests: number): SummaryPricing {
  const grossCost = lines.reduce((a, l) => a + (l.net || 0), 0)
  const grossSell = lines.reduce((a, l) => a + (l.rack || 0), 0)
  const netCost = lines.reduce((a, l) => a + costEffOf(l), 0)
  const sell = lines.reduce((a, l) => a + sellEffOf(l), 0)
  const offerSell = grossSell - sell
  const offerCost = grossCost - netCost

  const byLabel = new Map<string, { sellDelta: number; costDelta: number }>()
  for (const l of lines) {
    if (!l.discount) continue
    const cur = byLabel.get(l.discount.label) || { sellDelta: 0, costDelta: 0 }
    cur.sellDelta += l.discount.sellDelta
    cur.costDelta += l.discount.costDelta
    byLabel.set(l.discount.label, cur)
  }
  const discounts: SummaryDiscount[] = [...byLabel.entries()].map(([label, d]) => ({
    label,
    pct: grossSell > 0 ? `−${Math.round((d.sellDelta / grossSell) * 100)}%` : '—',
    sellDelta: `−${wholeUsd(d.sellDelta)}`,
    costDelta: d.costDelta > 0 ? `−${wholeUsd(d.costDelta)}` : 'Unchanged',
  }))

  const margin = sell - netCost
  const marginPct = sell ? Math.round((margin / sell) * 100) : 0
  const commission = Math.round(sell * 0.1)

  const groupTotals: SummaryGroupTotal[] = ORDER.map((type) => {
    const items = lines.filter((l) => l.type === type)
    if (!items.length) return null
    const value = items.reduce((a, l) => a + sellEffOf(l), 0)
    return { name: SUMMARY_TYPE_META[type].name, value: wholeUsd(value), color: SUMMARY_TYPE_META[type].iconFg }
  }).filter(Boolean) as SummaryGroupTotal[]

  return {
    sellTotal: wholeUsd(sell),
    sellNumber: sell,
    perPerson: totalGuests > 0 ? `${wholeUsd(sell / totalGuests)} per guest  ·  ${totalGuests} guests` : '',
    discounts,
    hasDiscounts: discounts.length > 0,
    discountTotal:
      offerSell > 0 || offerCost > 0
        ? `−${wholeUsd(offerSell)} sell` + (offerCost > 0 ? `  ·  −${wholeUsd(offerCost)} cost` : '')
        : '—',
    groupTotals,
    pricing: [
      { label: 'Gross cost', value: wholeUsd(grossCost), color: '#171717' },
      { label: 'Gross sell', value: wholeUsd(grossSell), color: '#171717' },
      {
        label: 'Offers on cost & sell',
        value:
          offerSell > 0 || offerCost > 0
            ? `−${wholeUsd(offerSell)} / −${wholeUsd(offerCost)}`
            : '—',
        color: '#0369A1',
      },
      { label: `Margin (${marginPct}%)`, value: wholeUsd(margin), color: '#059669' },
      { label: 'Agent commission (10%)', value: wholeUsd(commission), color: '#171717' },
    ],
  }
}

export type HoldRollup = { chip: string; summary: string; fg: string; bg: string }

/** Rolls up per-line hold state into the header chip + "Holds" meta-strip value. */
export function holdsSummaryOf(lines: SummaryLine[]): HoldRollup {
  const held = lines.filter((l) => l.hold === 'held').length
  const requested = lines.filter((l) => l.hold === 'requested').length
  const fg = requested ? '#B45309' : held ? '#0369A1' : '#8A8A90'
  const bg = requested ? '#FEF3C7' : held ? '#E0F2FE' : '#F4F4F5'
  const chip = requested ? `${requested} hold requested` : held ? `${held} on hold` : 'No holds'
  const summary =
    [held ? `${held} on hold` : null, requested ? `${requested} requested` : null].filter(Boolean).join(' · ') ||
    'No holds'
  return { chip, summary, fg, bg }
}

// ---------------------------------------------------------------------------
// Per-supplier deposit rules (contract terms) + vouchers view.
// ---------------------------------------------------------------------------

export type DepositRule = {
  match: string
  pct: number
  /** Days before first service date that the deposit is due; 0 = on confirmation / at booking. */
  days: number
  /** Short client-facing rule, e.g. "25% · 7 days". */
  shortLabel: string
  /** Longer internal label for summary / voucher footers. */
  label: string
}

const DEPOSIT_RULES: DepositRule[] = [
  {
    match: 'Hemingways',
    pct: 30,
    days: 14,
    shortLabel: '30% · 14 days',
    label: '30% on confirmation · balance 30 days before arrival',
  },
  {
    match: 'Elewana',
    pct: 25,
    days: 7,
    shortLabel: '25% · 7 days',
    label: '25% on confirmation · balance 45 days before arrival',
  },
  {
    match: 'AirKenya',
    pct: 100,
    days: 0,
    shortLabel: '100% at booking',
    label: '100% at time of booking (non-refundable)',
  },
  {
    match: 'Auric',
    pct: 100,
    days: 0,
    shortLabel: '100% at booking',
    label: '100% at time of booking (non-refundable)',
  },
  {
    match: 'Cheli',
    pct: 20,
    days: 14,
    shortLabel: '20% · 14 days',
    label: '20% on confirmation · balance 14 days before service',
  },
  {
    match: 'Balloon',
    pct: 50,
    days: 21,
    shortLabel: '50% · 21 days',
    label: '50% on confirmation · balance 21 days before flight',
  },
  {
    match: 'Amref',
    pct: 100,
    days: 0,
    shortLabel: '100% at booking',
    label: '100% at time of booking',
  },
  {
    match: 'AMREF',
    pct: 100,
    days: 0,
    shortLabel: '100% at booking',
    label: '100% at time of booking',
  },
  {
    match: 'Umbato',
    pct: 0,
    days: 0,
    shortLabel: 'On completion',
    label: 'Payable on completion',
  },
  {
    match: 'Meet and Assist',
    pct: 0,
    days: 0,
    shortLabel: 'On completion',
    label: 'Payable on completion',
  },
  {
    match: '*',
    pct: 50,
    days: 14,
    shortLabel: '50% · 14 days',
    label: '50% on confirmation · balance 14 days before service',
  },
]

export function depositRuleFor(supplier: string): DepositRule {
  return (
    DEPOSIT_RULES.find((r) => r.match !== '*' && supplier.includes(r.match)) ||
    DEPOSIT_RULES[DEPOSIT_RULES.length - 1]
  )
}

function isoAddDaysLocal(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

function fmtDepositDue(iso: string, rule: DepositRule) {
  if (!rule.days || !iso) return 'Due on confirmation'
  const dueIso = isoAddDaysLocal(iso, -rule.days)
  return `Due ${fmtShortDate(dueIso)} ${dueIso.slice(0, 4)}`
}

export type DepositRow = {
  supplier: string
  rule: string
  shortRule: string
  terms: string
  amount: string
  amountNum: number
  due: string
}

export type DepositSummary = {
  depositRows: DepositRow[]
  depositTotal: string
  depositTotalNum: number
  depositPctLabel: string
  depositPctOfSell: number
  depositBalance: string
  depositBalanceNum: number
  depositCountLabel: string
}

/** Aggregate deposit requirements by supplier from cost (what we owe). */
export function buildDepositSummary(lines: SummaryLine[], sellTotal?: number): DepositSummary {
  const bySup = new Map<string, { cost: number; first: string }>()
  for (const l of lines) {
    const cost = costEffOf(l)
    const cur = bySup.get(l.supplier) || { cost: 0, first: l.date || '' }
    cur.cost += cost
    if (l.date && (!cur.first || l.date < cur.first)) cur.first = l.date
    bySup.set(l.supplier, cur)
  }

  const rows: DepositRow[] = [...bySup.entries()]
    .map(([supplier, g]) => {
      const rule = depositRuleFor(supplier)
      const amountNum = Math.round(g.cost * (rule.pct / 100))
      const due = fmtDepositDue(g.first, rule)
      return {
        supplier,
        rule: rule.label,
        shortRule: rule.shortLabel,
        terms: `${rule.pct}% of ${wholeUsd(g.cost)}  ·  ${rule.days ? `due ${fmtShortDate(isoAddDaysLocal(g.first, -rule.days))}` : 'due on confirmation'}`,
        amount: wholeUsd(amountNum),
        amountNum,
        due,
      }
    })
    .sort((a, b) => b.amountNum - a.amountNum)

  const depositTotalNum = rows.reduce((a, r) => a + r.amountNum, 0)
  const totalCost = lines.reduce((a, l) => a + costEffOf(l), 0)
  const sell = sellTotal ?? lines.reduce((a, l) => a + sellEffOf(l), 0)
  const depositPctOfSell = sell ? Math.round((depositTotalNum / sell) * 100) : 0

  return {
    depositRows: rows,
    depositTotal: wholeUsd(depositTotalNum),
    depositTotalNum,
    depositPctLabel: (totalCost ? Math.round((depositTotalNum / totalCost) * 100) : 0) + '% of total cost',
    depositPctOfSell,
    depositBalance: wholeUsd(Math.max(0, sell - depositTotalNum)),
    depositBalanceNum: Math.max(0, sell - depositTotalNum),
    depositCountLabel: `${rows.length} supplier${rows.length === 1 ? '' : 's'}`,
  }
}

export type VoucherValueMode = 'cost' | 'sell' | 'none'

export type VoucherRow = {
  date: string
  typeLabel: string
  service: string
  detail: string
  pax: string
  value: string
  isExtra: boolean
}

export type VoucherCard = {
  supplier: string
  initials: string
  ref: string
  dateRange: string
  countLabel: string
  holdLabel: string
  holdFg: string
  holdBg: string
  showValue: boolean
  totalLabel: string
  total: string
  totalNum: number
  rows: VoucherRow[]
  deposit: string
  depositRule: string
  depositDue: string
  issued: boolean
}

function voucherDesc(l: SummaryLine) {
  switch (l.type) {
    case 'accommodation':
      return l.roomType || 'Room'
    case 'flight':
      return l.route || '—'
    case 'transportation':
      return l.kind === 'disposal'
        ? `${l.vType || 'Vehicle'} at disposal · ${l.location || '—'}`
        : `${l.pickup || '—'} → ${l.dropoff || '—'}`
    default:
      return l.service || '—'
  }
}

function voucherDetail(l: SummaryLine) {
  if (l.type === 'accommodation') {
    return [l.rooms ? `${l.rooms} room${l.rooms === 1 ? '' : 's'}` : null, l.nights ? `${l.nights} nights` : null, l.basis]
      .filter(Boolean)
      .join('  ·  ')
  }
  if (l.type === 'flight') {
    return [l.depart && l.arrive ? `${l.depart} → ${l.arrive}` : l.depart || l.arrive || null, l.charter]
      .filter(Boolean)
      .join('  ·  ')
  }
  if (l.type === 'transportation') {
    if (l.kind === 'disposal') {
      return [l.veh ? `${l.veh} vehicle` : null, l.days ? `${l.days} days` : null].filter(Boolean).join('  ·  ')
    }
    return l.vType || ''
  }
  return l.qty || l.alloc || ''
}

function voucherTypeLabel(l: SummaryLine) {
  if (l.type === 'transportation') return l.kind === 'disposal' ? 'Vehicle disposal' : 'Transfer'
  if (l.type === 'extra') return 'Extra'
  if (l.type === 'other') return 'Service'
  if (l.type === 'accommodation') return 'Accommodation'
  if (l.type === 'flight') return 'Flight'
  return 'Activity'
}

function supplierInitials(name: string) {
  const cleaned = name.replace(/^Elewana\s+/i, '')
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

/** One voucher per invoiceable supplier, cutting across the whole itinerary. */
export function buildVouchers(
  lines: SummaryLine[],
  mode: VoucherValueMode,
  metaRef: string,
  issued: Record<string, boolean> = {},
): VoucherCard[] {
  const show = mode !== 'none'
  const bySup = new Map<string, SummaryLine[]>()
  for (const l of lines) {
    const arr = bySup.get(l.supplier) || []
    arr.push(l)
    bySup.set(l.supplier, arr)
  }

  const cards = [...bySup.entries()].map(([name, items]) => {
    const sorted = items.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const valueOf = (l: SummaryLine) => (mode === 'sell' ? sellEffOf(l) : costEffOf(l))
    const cost = sorted.reduce((a, l) => a + costEffOf(l), 0)
    const totalNum = sorted.reduce((a, l) => a + valueOf(l), 0)
    const rule = depositRuleFor(name)
    const first = sorted.find((l) => l.date)?.date || ''
    const last = [...sorted].reverse().find((l) => l.date)?.date || first
    const isIssued = !!issued[name]
    const holds = sorted.map((l) => l.hold)
    const [holdLabel, holdFg, holdBg] = isIssued
      ? (['Voucher issued', '#15803D', '#DCFCE7'] as const)
      : holds.includes('requested')
        ? (['Hold requested', '#B45309', '#FEF3C7'] as const)
        : holds.includes('held')
          ? (['On hold', '#0369A1', '#E0F2FE'] as const)
          : (['No hold', '#A1A1A1', '#F1F5F9'] as const)

    const year = (last || first || '').slice(0, 4) || ''
    const dateRange =
      first && last
        ? `${fmtShortDate(first)} – ${fmtShortDate(last)}${year ? ` ${year}` : ''}`
        : 'Dates TBC'

    return {
      supplier: name,
      initials: supplierInitials(name),
      first,
      dateRange,
      countLabel: `${sorted.length} service line${sorted.length === 1 ? '' : 's'}`,
      holdLabel,
      holdFg,
      holdBg,
      showValue: show,
      totalLabel: mode === 'sell' ? 'Sell total' : 'Cost total',
      total: wholeUsd(totalNum),
      totalNum,
      rows: sorted.map((l) => ({
        date: fmtShortDate(l.date),
        typeLabel: voucherTypeLabel(l),
        service: voucherDesc(l),
        detail: voucherDetail(l) || '—',
        pax: l.pax != null ? String(l.pax) : '—',
        value: wholeUsd(valueOf(l)),
        isExtra: l.type === 'extra',
      })),
      deposit: wholeUsd(Math.round(cost * (rule.pct / 100))),
      depositRule: rule.label,
      depositDue: fmtDepositDue(first, rule),
      issued: isIssued,
    }
  })

  return cards
    .sort((a, b) => (a.first || '').localeCompare(b.first || ''))
    .map((card, index) => ({
      supplier: card.supplier,
      initials: card.initials,
      ref: `${metaRef} / V${String(index + 1).padStart(2, '0')}`,
      dateRange: card.dateRange,
      countLabel: card.countLabel,
      holdLabel: card.holdLabel,
      holdFg: card.holdFg,
      holdBg: card.holdBg,
      showValue: card.showValue,
      totalLabel: card.totalLabel,
      total: card.total,
      totalNum: card.totalNum,
      rows: card.rows,
      deposit: card.deposit,
      depositRule: card.depositRule,
      depositDue: card.depositDue,
      issued: card.issued,
    }))
}

export type InclusionParagraph = { supplier: string; body: string }

const EXCLUSIONS_BODY =
  'International flights, visas and airport departure taxes; travel and cancellation insurance; premium wines, champagne and imported spirits; spa treatments and any additional private guiding not listed above; gratuities for guides, drivers and lodge staff; and all items of a personal nature.'

function basisPhrase(basis?: string) {
  const b = (basis || '').toUpperCase()
  if (b.includes('FI') || b === 'AI') return 'fully inclusive of all meals, house drinks'
  if (b.includes('FB')) return 'on full board with house drinks'
  if (b.includes('HB')) return 'on half board'
  if (b.includes('BB')) return 'on bed and breakfast'
  return basis ? `on a ${basis} basis` : 'on the meal basis shown'
}

/** Client-facing inclusion prose grouped per supplier, plus a single exclusions paragraph. */
export function buildInclusions(lines: SummaryLine[]): {
  inclusions: InclusionParagraph[]
  exclusionsBody: string
} {
  const inclusions: InclusionParagraph[] = []

  const stays = new Map<string, SummaryLine[]>()
  for (const l of lines.filter((x) => x.type === 'accommodation')) {
    const arr = stays.get(l.supplier) || []
    arr.push(l)
    stays.set(l.supplier, arr)
  }
  for (const [supplier, group] of stays) {
    const nights = Math.max(...group.map((l) => l.nights || 0))
    const basis = group[0].basis
    const rooms = [...new Set(group.map((l) => l.roomType).filter(Boolean))].join(' and ')
    const nightLabel = nights ? `${nights} night${nights === 1 ? '' : 's'}` : 'Your stay'
    inclusions.push({
      supplier,
      body: `${nightLabel}${rooms ? ` in ${rooms}` : ''} ${basisPhrase(basis)}, including statutory taxes and applicable park or conservancy fees where listed.`,
    })
  }

  const flights = lines.filter((l) => l.type === 'flight')
  const transfers = lines.filter((l) => l.type === 'transportation')
  if (flights.length || transfers.length) {
    const flightBits = flights.length
      ? `${flights.length} light-aircraft sector${flights.length === 1 ? '' : 's'}${
          flights[0]?.supplier ? ` with ${[...new Set(flights.map((f) => f.supplier))].join(' and ')}` : ''
        }`
      : null
    const transferBits = transfers.length
      ? `${transfers.length} private road transfer${transfers.length === 1 ? '' : 's'} and vehicle services`
      : null
    inclusions.push({
      supplier: 'Flights and ground transport',
      body: [flightBits, transferBits].filter(Boolean).join(', ') + ', as listed in this itinerary.',
    })
  }

  const services = lines.filter((l) => l.type === 'activity' || l.type === 'other')
  if (services.length) {
    const names = [...new Set(services.map((l) => l.service || l.supplier).filter(Boolean))]
    inclusions.push({
      supplier: 'Travel services',
      body:
        names.length <= 3
          ? `${names.join(', ')}, as arranged for this journey.`
          : `${names.slice(0, 2).join(', ')} and ${names.length - 2} further arranged services.`,
    })
  }

  return { inclusions, exclusionsBody: EXCLUSIONS_BODY }
}
