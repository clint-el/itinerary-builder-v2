import { nightsBetween, parseMoney, rackOf } from '@/shared/lib/helpers'
import { applyOfferToCostAndSell, roomTypeLabel } from '@/shared/lib/catalogs'
import { getPayableEntity, payableEntityFromSupplierName, reservationEmailFor } from '@/shared/lib/payableEntities'
import { payableEntityIdOf } from '@/shared/lib/lifecycleRules'
import type {
  AddedService,
  DietaryStatus,
  Guest,
  GuestDetail,
  Hold,
  LifecycleLogEntry,
  QuoteGroup,
  ServiceTab,
  SupplierVoucherStatus,
  VoucherLineAnswer,
  VoucherLineOutcome,
  VoucherMeta,
} from '@/shared/lib/types'
import {
  asActivities,
  asFlights,
  asHireRoutes,
  asRooms,
  asVehicles,
  consolidateHireRoutes,
  extraObjects,
  flightAutoQty,
  nights,
  transportDays,
  usedGuestIds,
} from '@/features/builder/builderUtils'

export type SummaryServiceType = 'accommodation' | 'flight' | 'transportation' | 'activity' | 'extra' | 'other'

export type LineDiscount = { label: string; sellDelta: number; costDelta: number }

export type SummaryLine = {
  type: SummaryServiceType
  serviceId: string
  /** Stable id for exactly this row within its service (`${serviceId}#${n}`) — the unit a
   *  supplier ticks on a voucher, since one AddedService can explode into several rows
   *  (rooms, fare lines, vehicles, extras). Optional at push time — `linesFromServices` /
   *  `linesFromQuoteGroups` always assign it via `assignLineIds` before returning. */
  lineId?: string
  date: string
  supplier: string
  /** Property / operating-unit display name on the line. */
  propertyName?: string
  payableEntityId?: string
  payableEntityName?: string
  net: number
  /** PR-F54 — destination line moved from another sub-quote. */
  reconfirmRequired?: boolean
  formerSourceRef?: string
  rack: number
  hold: 'held' | 'requested' | 'none'
  /** Mirrors AddedService.depositPaid — drives the voucher deposit guard (BR-43). */
  depositPaid?: boolean
  discount?: LineDiscount
  /** How this line’s total was computed — drives the rate column, never invent a per-head split for `'unit'`. */
  chargePer: 'person' | 'unit'
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
  { name: string; initial: string; iconBg: string; iconFg: string }
> = {
  accommodation: { name: 'Accommodation', initial: 'A', iconBg: '#ECFDF5', iconFg: '#059669' },
  flight: { name: 'Flights', initial: 'F', iconBg: '#EFF6FF', iconFg: '#2563EB' },
  transportation: { name: 'Transportation', initial: 'T', iconBg: '#E0F2FE', iconFg: '#0369A1' },
  activity: { name: 'Activities', initial: 'C', iconBg: '#FEF3C7', iconFg: '#B45309' },
  extra: { name: 'Extras', initial: 'E', iconBg: '#E0F2FE', iconFg: '#0369A1' },
  other: { name: 'Other services', initial: 'O', iconBg: '#F3F4F6', iconFg: '#525252' },
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

/** Age-band counts on a flight fare line → summary Ad/Ch buckets (youth with adults). */
function fareBandMix(fare: {
  adult?: number
  youth?: number
  child?: number
  infant?: number
}): { ad: number; ch: number } {
  return {
    ad: (fare.adult || 0) + (fare.youth || 0),
    ch: (fare.child || 0) + (fare.infant || 0),
  }
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
          // Extras: absolute price × qty (units), never ÷ headcount — see computeDraftTotals.
          chargePer: 'unit',
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
          chargePer: 'person',
          net: parentNet,
          rack: parentRack,
          hold,
        })
      } else {
        const weights = rooms.map((r) => {
          const rn = nights(r.start || start, r.end || end) || 1
          return Math.max(0.01, (Number(r.rate) || 0) * rn)
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
            rooms: 1,
            pax: room.guestIds.length,
            ad: mix.ad,
            ch: mix.ch,
            nights: nights(rStart, rEnd),
            chargePer: 'person',
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
              chargePer: 'unit',
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
            chargePer: 'unit',
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
          chargePer: 'unit',
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
      const flights = asFlights(d)
      const date = flights[0]?.departDate || String(d.departDate || '')
      const departTime = flights[0]?.departTime || String(d.departTime || '')
      const returnTime = d.flightMode === 'return' ? String(d.returnTime || '') : ''
      const paxCount = totalPax || flightAutoQty(d)
      const supplier = String(d.supplier || svc.title)
      const charter = /charter/i.test(service) ? 'Charter' : 'Schedule'
      const fareLines = (Array.isArray(d.fareLines) ? d.fareLines : []) as {
        route: string
        pax: number
        net: number
        rack: number
        adult?: number
        youth?: number
        child?: number
        infant?: number
      }[]
      const groupStart = lines.length
      if (fareLines.length) {
        fareLines.forEach((fare) => {
          const fareMix = fareBandMix(fare)
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
            ad: fareMix.ad,
            ch: fareMix.ch,
            // Scheduled fares are per-passenger today; `'unit'` remains available for charter later.
            chargePer: 'person',
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
          chargePer: 'person',
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
            chargePer: a.guestIds.length > 0 ? 'person' : 'unit',
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
          chargePer: 'unit',
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
          chargePer: a.guestIds.length > 0 ? 'person' : 'unit',
          net: aNet,
          rack: aNet,
          hold,
        })
      }
    } else {
      // qty × price in computeDraftTotals — qty is units, not guest headcount.
      lines.push({
        type: 'other',
        serviceId: svc.id,
        date: String(d.startDate || ''),
        supplier,
        service: String(d.description || d.service || 'Other'),
        pax: Number(d.qty) || undefined,
        alloc: 'All guests',
        days: nightsBetween(String(d.startDate || ''), String(d.endDate || '')) || 1,
        chargePer: 'unit',
        net: parentNet,
        rack: parentRack,
        hold,
      })
    }
    pushExtras(groupStart, String(d.startDate || ''), Number(d.qty) || 0, supplier)
  }

  const depositPaidByService = new Map(services.map((svc) => [svc.id, !!svc.depositPaid]))
  const draftByService = new Map(services.map((svc) => [svc.id, (svc.draft || {}) as Record<string, unknown>]))
  for (const l of lines) {
    l.depositPaid = depositPaidByService.get(l.serviceId) || undefined
    l.propertyName = l.supplier
    const d = draftByService.get(l.serviceId) || {}
    const entityId = String(d.payableEntityId || '')
    if (entityId) {
      const entity = getPayableEntity(entityId)
      l.payableEntityId = entity.id
      l.payableEntityName = entity.legalName
    } else {
      const entity = payableEntityFromSupplierName(l.supplier)
      l.payableEntityId = entity.id
      l.payableEntityName = entity.legalName
    }
  }
  return assignLineIds(lines)
}

/** Stable per-row id within a service (`${serviceId}#${n}`) — see SummaryLine.lineId. */
function assignLineIds(lines: SummaryLine[]): SummaryLine[] {
  const counters = new Map<string, number>()
  for (const l of lines) {
    const n = counters.get(l.serviceId) || 0
    l.lineId = `${l.serviceId}#${n}`
    counters.set(l.serviceId, n + 1)
  }
  return lines
}

/** Fallback when only quote groups exist (no builder services). */
export function linesFromQuoteGroups(groups: QuoteGroup[]): SummaryLine[] {
  const lines: SummaryLine[] = []
  for (const g of groups) {
    const type: SummaryServiceType =
      g.icon === 'flight' ? 'flight' : g.icon === 'vehicle' ? 'transportation' : 'accommodation'
    const chargePer: SummaryLine['chargePer'] =
      type === 'transportation' ? 'unit' : 'person'
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
        chargePer,
        net,
        rack: amount,
        hold: 'none',
      })
    }
  }
  return assignLineIds(lines)
}

// ---------------------------------------------------------------------------
// Cards: one flat table per service type — Arrival → Departure, Supplier, the
// type's own columns, Pax, Hold, then whichever value columns "Values shown"
// asks for. Transfers and vehicles at disposal get a card each; service-scoped
// extras hang off their parent stay as indented child rows.
// ---------------------------------------------------------------------------

/** Card-level split of SummaryServiceType: transportation shows as two cards. */
export type SummaryCardType =
  | 'accommodation'
  | 'flight'
  | 'transfer'
  | 'disposal'
  | 'activity'
  | 'extra'
  | 'other'

export const SUMMARY_CARD_META: Record<
  SummaryCardType,
  { name: string; initial: string; iconBg: string; iconFg: string; tint: string }
> = {
  accommodation: { name: 'Accommodation', initial: 'A', iconBg: '#ECFDF5', iconFg: '#059669', tint: '#F6FEFB' },
  flight: { name: 'Flights', initial: 'F', iconBg: '#EFF6FF', iconFg: '#2563EB', tint: '#F8FAFF' },
  transfer: { name: 'Transfers', initial: 'T', iconBg: '#E0F2FE', iconFg: '#0369A1', tint: '#F6FBFF' },
  disposal: { name: 'Vehicles at disposal', initial: 'V', iconBg: '#F3E8FF', iconFg: '#7C3AED', tint: '#FBF8FF' },
  activity: { name: 'Activities', initial: 'C', iconBg: '#FEF3C7', iconFg: '#B45309', tint: '#FFFDF5' },
  extra: { name: 'Extras', initial: 'E', iconBg: '#E0F2FE', iconFg: '#0369A1', tint: '#F7FBFF' },
  other: { name: 'Other services', initial: 'O', iconBg: '#F3F4F6', iconFg: '#525252', tint: '#FAFAFB' },
}

const CARD_ORDER: SummaryCardType[] = [
  'accommodation',
  'flight',
  'transfer',
  'disposal',
  'activity',
  'extra',
  'other',
]

export function cardTypeOf(l: SummaryLine): SummaryCardType {
  if (l.type === 'transportation') return l.kind === 'disposal' ? 'disposal' : 'transfer'
  return l.type
}

type Align = 'l' | 'c' | 'r'

/** Presentation hint for one body cell — the page maps it to type scale and colour. */
export type SummaryCellTone = 'plain' | 'date' | 'name' | 'meta' | 'hold' | 'cost' | 'sell' | 'margin'

export type SummaryHeaderCell = { label: string; align: Align }

export type SummaryBodyCell = { value: string; align: Align; tone: SummaryCellTone; color?: string }

export type SummaryTableRow =
  | { kind: 'line'; key: string; cells: SummaryBodyCell[] }
  | { kind: 'extra'; key: string; label: string; meta: string; value: string }

export type SummaryTable = {
  gridCols: string
  headers: SummaryHeaderCell[]
  rows: SummaryTableRow[]
}

export type SummaryCard = SummaryTable & {
  type: SummaryCardType
  name: string
  initial: string
  iconBg: string
  iconFg: string
  tint: string
  countLabel: string
}

function mgnPct(net: number, rack: number) {
  return rack > 0 ? Math.round(((rack - net) / rack) * 100) : 0
}

function marginColor(pct: number) {
  if (pct >= 30) return '#059669'
  if (pct >= 15) return '#B45309'
  if (pct > 0) return '#931115'
  return '#A1A1A1'
}

function holdCell(l: SummaryLine): { value: string; color: string } {
  if (l.hold === 'held') return { value: 'On hold', color: '#0369A1' }
  if (l.hold === 'requested') return { value: 'Requested', color: '#B45309' }
  return { value: '—', color: '#A1A1A1' }
}

function guestsCell(l: SummaryLine): string {
  if (l.ad || l.ch) return [l.ad ? `${l.ad} Ad` : null, l.ch ? `${l.ch} Ch` : null].filter(Boolean).join(' · ')
  return l.pax != null ? String(l.pax) : '—'
}

export type PriceDisplayMode = 'cost' | 'sell' | 'all'

/** Departure of a line: stays run to the last night, multi-day disposals to the final day. */
function lineEndDate(l: SummaryLine): string {
  if (l.end) return l.end
  const span = l.nights || (l.days ? l.days - 1 : 0)
  if (!span || !l.date) return l.date
  return isoAddDaysLocal(l.date, span)
}

function serviceDescOf(l: SummaryLine): string {
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

type Column = {
  label: string
  align: Align
  track: string
  tone: SummaryCellTone
  value: (l: SummaryLine) => string
  color?: (l: SummaryLine) => string
}

const COL_DATES: Column = {
  label: 'Arrival → Departure',
  align: 'l',
  track: '156px',
  tone: 'date',
  value: (l) => `${fmtShortDate(l.date)}  →  ${fmtShortDate(lineEndDate(l))}`,
}

const COL_SUPPLIER: Column = {
  label: 'Supplier',
  align: 'l',
  track: 'minmax(150px,1.3fr)',
  tone: 'name',
  value: (l) => l.supplier,
}

const COL_SERVICE: Column = {
  label: 'Service',
  align: 'l',
  track: 'minmax(190px,2fr)',
  tone: 'name',
  value: serviceDescOf,
}

const COL_PAX: Column = {
  label: 'Pax',
  align: 'c',
  track: '96px',
  tone: 'meta',
  value: guestsCell,
}

const COL_HOLD: Column = {
  label: 'Hold',
  align: 'c',
  track: '96px',
  tone: 'hold',
  value: (l) => holdCell(l).value,
  color: (l) => holdCell(l).color,
}

function columnsFor(type: SummaryCardType, mode: PriceDisplayMode): Column[] {
  const base: Column[] = (() => {
    switch (type) {
      case 'accommodation':
        return [
          COL_DATES,
          COL_SUPPLIER,
          {
            label: 'Room / basis',
            align: 'l',
            track: 'minmax(190px,2fr)',
            tone: 'name',
            value: (l) => [l.roomType, l.basis].filter(Boolean).join('  ·  ') || '—',
          },
          { label: 'Nights', align: 'c', track: '74px', tone: 'plain', value: (l) => (l.nights ? String(l.nights) : '—') },
          { label: 'Rooms', align: 'c', track: '70px', tone: 'plain', value: (l) => (l.rooms ? String(l.rooms) : '—') },
          COL_PAX,
          COL_HOLD,
        ]
      case 'flight':
        return [
          COL_DATES,
          COL_SUPPLIER,
          COL_SERVICE,
          {
            label: 'Times',
            align: 'c',
            track: '116px',
            tone: 'meta',
            value: (l) => (l.depart && l.arrive ? `${l.depart} → ${l.arrive}` : l.depart || '—'),
          },
          COL_PAX,
          COL_HOLD,
        ]
      case 'transfer':
        return [
          COL_DATES,
          COL_SUPPLIER,
          COL_SERVICE,
          { label: 'Vehicle', align: 'l', track: 'minmax(110px,1fr)', tone: 'plain', value: (l) => l.vType || '—' },
          COL_PAX,
          COL_HOLD,
        ]
      case 'disposal':
        return [
          COL_DATES,
          COL_SUPPLIER,
          COL_SERVICE,
          { label: 'Days', align: 'c', track: '70px', tone: 'plain', value: (l) => (l.days ? String(l.days) : '—') },
          COL_PAX,
          COL_HOLD,
        ]
      case 'extra':
        return [
          COL_DATES,
          COL_SUPPLIER,
          COL_SERVICE,
          { label: 'Qty', align: 'c', track: '92px', tone: 'meta', value: (l) => l.qty || '—' },
          COL_PAX,
          COL_HOLD,
        ]
      case 'other':
        return [
          COL_DATES,
          COL_SUPPLIER,
          COL_SERVICE,
          {
            label: 'Allocation',
            align: 'l',
            track: 'minmax(130px,1.1fr)',
            tone: 'plain',
            value: (l) => l.alloc || 'All guests',
          },
          COL_PAX,
          COL_HOLD,
        ]
      default:
        return [COL_DATES, COL_SUPPLIER, COL_SERVICE, COL_PAX, COL_HOLD]
    }
  })()

  const value: Column[] = []
  if (mode === 'cost' || mode === 'all') {
    value.push({ label: 'Cost', align: 'r', track: '104px', tone: 'cost', value: (l) => wholeUsd(costEffOf(l)) })
  }
  if (mode === 'sell' || mode === 'all') {
    value.push({ label: 'Sell', align: 'r', track: '104px', tone: 'sell', value: (l) => wholeUsd(sellEffOf(l)) })
  }
  if (mode === 'all') {
    value.push({
      label: 'Margin',
      align: 'r',
      track: '92px',
      tone: 'margin',
      value: (l) => {
        const pct = mgnPct(costEffOf(l), sellEffOf(l))
        return pct ? `${pct}%` : '—'
      },
      color: (l) => marginColor(mgnPct(costEffOf(l), sellEffOf(l))),
    })
  }
  return base.concat(value)
}

/** One table for a set of lines of the same card type, with optional nested extras. */
function buildTable(
  type: SummaryCardType,
  items: SummaryLine[],
  mode: PriceDisplayMode,
  extrasByLine: Map<string, SummaryLine[]> | null,
): SummaryTable {
  const cols = columnsFor(type, mode)
  const rows: SummaryTableRow[] = []
  items.forEach((l, i) => {
    const key = l.lineId || `${l.serviceId}#${i}`
    rows.push({
      kind: 'line',
      key,
      cells: cols.map((c) => ({
        value: c.value(l) || '—',
        align: c.align,
        tone: c.tone,
        color: c.color?.(l),
      })),
    })
    for (const [j, x] of (extrasByLine?.get(key) || []).entries()) {
      rows.push({
        kind: 'extra',
        key: `${key}-x${j}`,
        label: x.service || 'Extra',
        meta: [x.qty, fmtShortDate(x.date)].filter(Boolean).join('  ·  '),
        value: wholeUsd(mode === 'sell' ? sellEffOf(x) : costEffOf(x)),
      })
    }
  })
  return {
    gridCols: cols.map((c) => c.track).join(' '),
    headers: cols.map((c) => ({ label: c.label, align: c.align })),
    rows,
  }
}

function sellEffOf(l: SummaryLine) {
  return l.rack - (l.discount?.sellDelta || 0)
}

function costEffOf(l: SummaryLine) {
  return l.net - (l.discount?.costDelta || 0)
}

/**
 * Extras that belong to one stay sit under it as child rows; supplier-wide extras (and extras
 * on anything other than a stay) get their own card, matching the Summary Layout doc.
 */
function splitExtras(lines: SummaryLine[]): {
  nested: Map<string, SummaryLine[]>
  loose: SummaryLine[]
} {
  const staysByService = new Map<string, SummaryLine>()
  for (const l of lines) {
    if (l.type === 'accommodation' && !staysByService.has(l.serviceId)) staysByService.set(l.serviceId, l)
  }
  const nested = new Map<string, SummaryLine[]>()
  const loose: SummaryLine[] = []
  for (const x of lines.filter((l) => l.type === 'extra')) {
    const parent = x.extraKind === 'supplier' ? undefined : staysByService.get(x.serviceId)
    if (!parent?.lineId) {
      loose.push(x)
      continue
    }
    const arr = nested.get(parent.lineId) || []
    arr.push(x)
    nested.set(parent.lineId, arr)
  }
  return { nested, loose }
}

export function buildSummaryCards(lines: SummaryLine[], mode: PriceDisplayMode = 'all'): SummaryCard[] {
  const { nested, loose } = splitExtras(lines)

  return CARD_ORDER.map((type) => {
    const items =
      type === 'extra'
        ? loose.slice()
        : lines.filter((l) => l.type !== 'extra' && cardTypeOf(l) === type).slice()
    if (!items.length) return null
    items.sort((a, b) => (a.date || '').localeCompare(b.date || ''))

    const m = SUMMARY_CARD_META[type]
    const table = buildTable(type, items, mode, type === 'accommodation' ? nested : null)
    const nestedCount =
      type === 'accommodation' ? table.rows.filter((r) => r.kind === 'extra').length : 0

    return {
      ...table,
      type,
      name: m.name,
      initial: m.initial,
      iconBg: m.iconBg,
      iconFg: m.iconFg,
      tint: m.tint,
      countLabel:
        `${items.length} ${items.length === 1 ? 'line' : 'lines'}` +
        (nestedCount ? `  ·  ${nestedCount} extras` : ''),
    }
  }).filter(Boolean) as SummaryCard[]
}

export type SummaryDayGroup = SummaryTable & {
  key: string
  name: string
  initial: string
  iconBg: string
  iconFg: string
  tint: string
}

export type SummaryDayBlock = {
  key: string
  dayNum: string
  dateLabel: string
  weekday: string
  groups: SummaryDayGroup[]
}

/** Day-by-day view: the same per-type tables, cut by date instead of by service type. */
export function buildSummaryDayGroups(
  lines: SummaryLine[],
  mode: PriceDisplayMode = 'all',
): SummaryDayBlock[] {
  const dates = [...new Set(lines.map((l) => l.date).filter(Boolean))].sort()
  const first = dates[0]
  if (!first) return []
  const dayNo = (iso: string) =>
    Math.round(
      (new Date(`${iso}T00:00:00`).getTime() - new Date(`${first}T00:00:00`).getTime()) / 86400000,
    ) + 1

  return dates.map((date) => {
    const onDay = lines.filter((l) => l.date === date)
    return {
      key: date,
      dayNum: `Day ${dayNo(date)}`,
      dateLabel: fmtShortDate(date),
      weekday: weekday(date),
      groups: CARD_ORDER.map((type) => {
        const items = onDay.filter((l) => cardTypeOf(l) === type)
        if (!items.length) return null
        const m = SUMMARY_CARD_META[type]
        return {
          ...buildTable(type, items, mode, null),
          key: date + type,
          name: m.name,
          initial: m.initial,
          iconBg: m.iconBg,
          iconFg: m.iconFg,
          tint: m.tint,
        }
      }).filter(Boolean) as SummaryDayGroup[],
    }
  })
}

export type SummaryPriceGroupItem = { key: string; supplier: string; desc: string; value: string }

export type SummaryPriceGroup = {
  key: SummaryServiceType
  name: string
  subtotal: string
  countLabel: string
  items: SummaryPriceGroupItem[]
  lines: SummaryLine[]
}

/** Pricing sidebar grouping — transfers and disposals roll up as one "Transportation". */
export function buildPriceGroups(lines: SummaryLine[]): SummaryPriceGroup[] {
  const order: SummaryServiceType[] = [
    'accommodation',
    'flight',
    'transportation',
    'activity',
    'extra',
    'other',
  ]
  return order
    .map((type) => {
      const items = lines.filter((l) => l.type === type)
      if (!items.length) return null
      return {
        key: type,
        name: SUMMARY_TYPE_META[type].name,
        subtotal: wholeUsd(items.reduce((a, l) => a + sellEffOf(l), 0)),
        countLabel: `${items.length} ${items.length === 1 ? 'item' : 'items'}`,
        items: items.map((l, i) => ({
          key: l.lineId || `${l.serviceId}#${i}`,
          supplier: l.supplier,
          desc: serviceDescOf(l),
          value: wholeUsd(sellEffOf(l)),
        })),
        lines: items,
      }
    })
    .filter(Boolean) as SummaryPriceGroup[]
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
  note: string
  noteColor: string
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
  const discounts: SummaryDiscount[] = [...byLabel.entries()].map(([label, d]) => {
    const pct = grossSell > 0 ? `−${Math.round((d.sellDelta / grossSell) * 100)}%` : '—'
    return {
      label,
      pct,
      note: `Applied to cost & sell · ${pct}`,
      noteColor: '#059669',
      sellDelta: `−${wholeUsd(d.sellDelta)}`,
      costDelta: d.costDelta > 0 ? `−${wholeUsd(d.costDelta)}` : 'Unchanged',
    }
  })

  const margin = sell - netCost
  const marginPct = sell ? Math.round((margin / sell) * 100) : 0

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
    ],
  }
}

export type PaymentHistoryRow = {
  date: string
  label: string
  method: string
  amount: string
  status: 'Paid' | 'Due' | 'Overdue'
  statusBg: string
  statusFg: string
}

export type PaymentHistory = {
  sellTotal: string
  paid: string
  outstanding: string
  paidPct: number
  paidPctLabel: string
  finalDue: string
  finalDueNote: string
  finalDueColor: string
  arrivalNote: string
  rows: PaymentHistoryRow[]
}

function fmtPayDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]
  return `${String(d).padStart(2, '0')} ${mon} ${y}`
}

function isoFromDate(dt: Date) {
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

/** Client payment schedule against sell total — prototype instalments for the summary card. */
export function buildPaymentHistory(sellTotal: number, arrivalIso?: string): PaymentHistory {
  const arrival = arrivalIso || '2026-09-01'
  const arrivalD = new Date(`${arrival}T00:00:00`)
  const dayMs = 86400000
  const minus = (days: number) => new Date(arrivalD.getTime() - days * dayMs)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const schedule = [
    { label: 'Deposit (25%)', pct: 0.25, due: minus(81), method: 'Bank transfer · PMT-1041', paid: true },
    { label: 'Second instalment (35%)', pct: 0.35, due: minus(53), method: 'Bank transfer · PMT-1102', paid: true },
    { label: 'Final balance (40%)', pct: 0.4, due: minus(14), method: 'Awaiting payment', paid: false },
  ]

  const rows: PaymentHistoryRow[] = schedule.map((x) => {
    const overdue = !x.paid && x.due < today
    return {
      date: fmtPayDate(isoFromDate(x.due)),
      label: x.label,
      method: x.method,
      amount: wholeUsd(sellTotal * x.pct),
      status: x.paid ? 'Paid' : overdue ? 'Overdue' : 'Due',
      statusBg: x.paid ? '#ECFDF5' : overdue ? '#FEF2F2' : '#FFFBEB',
      statusFg: x.paid ? '#059669' : overdue ? '#B91C1C' : '#B45309',
    }
  })

  const paid = schedule.filter((x) => x.paid).reduce((a, x) => a + sellTotal * x.pct, 0)
  const finalDue = schedule[schedule.length - 1].due
  const daysToFinal = Math.round((finalDue.getTime() - today.getTime()) / dayMs)
  const paidPct = sellTotal ? Math.round((paid / sellTotal) * 100) : 0

  return {
    sellTotal: wholeUsd(sellTotal),
    paid: wholeUsd(paid),
    outstanding: wholeUsd(Math.max(0, sellTotal - paid)),
    paidPct,
    paidPctLabel: `${paidPct}% of sell total`,
    finalDue: fmtPayDate(isoFromDate(finalDue)),
    finalDueNote: daysToFinal >= 0 ? `Due in ${daysToFinal} days` : `${Math.abs(daysToFinal)} days overdue`,
    finalDueColor: daysToFinal >= 0 ? '#B45309' : '#B91C1C',
    arrivalNote: `Full payment required before arrival · ${fmtPayDate(arrival)}`,
    rows,
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
  lineId: string
  serviceId: string
  date: string
  typeLabel: string
  service: string
  detail: string
  pax: string
  value: string
  isExtra: boolean
  parentLineId?: string
  propertyName?: string
  outcome: VoucherLineOutcome | 'pending'
  reason?: string
  depositPaid: boolean
  reconfirmRequired?: boolean
  formerSourceRef?: string
}

export type VoucherResponseState =
  | 'Not issued'
  | 'Awaiting supplier'
  | 'Supplier submitted'
  | 'Recorded by planner'

export type VoucherGuestRow = { name: string; role: string; status: DietaryStatus; text: string }

export type VoucherRoomRow = { room: string; who: string; meta: string }

export type VoucherNote = { key: string; label: string; text: string }

export type VoucherCard = {
  entityId: string
  supplier: string
  supplierEmail: string
  propertyNames: string[]
  initials: string
  ref: string
  kind: 'standard' | 'cancellation_only'
  dateRange: string
  countLabel: string
  holdLabel: string
  holdFg: string
  holdBg: string
  showValue: boolean
  totalLabel: string
  total: string
  totalNum: number
  gridCols: string
  headers: SummaryHeaderCell[]
  rows: VoucherRow[]
  deposit: string
  depositRule: string
  depositDue: string
  issued: boolean
  /** Current non-superseded token, for building the demo "open supplier link" URL. */
  activeToken?: string
  voucherStatus?: SupplierVoucherStatus | null
  responseState: VoucherResponseState
  changedSinceIssued: boolean
  depositGuardCount: number
  note: string
  issuedAt?: string
  issuedTo: string[]
  resendCount: number
  submittedByName?: string
  submittedByEmail?: string
  leadGuest: string
  partyMix: string
  agency: string
  rooms: VoucherRoomRow[]
  guestRoster: VoucherGuestRow[]
  guestCoverageLabel: string
  /** Requirement coverage as the voucher header states it, with its own tone. */
  dietLine: string
  dietColor: string
  paxRows: { key: string; name: string; bandLabel: string }[]
  /** Notes captured on this supplier's service lines and printed on the request. */
  supplierNotes: VoucherNote[]
  hasDiscount: boolean
  discountRows: { key: string; label: string; from: string; to: string; tag: string }[]
  discountNote: string
  emailLine: string
  sendHistory: { recipient: string; sentAt: string; deliveryStatus: string; via: string }[]
  pendingRequestLatest: boolean
  responsePill: { label: string; bg: string; fg: string }
  responseHint: string
  responseSummary: string
  /** Lines the supplier could not hold — recorded, never removed from the itinerary (RU-08). */
  responseRejected: { key: string; text: string }[]
  responseAwaitText: string
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

/** Demo reservations email — prefers payable entity address. */
export function supplierEmailFor(nameOrEntityId: string): string {
  if (nameOrEntityId.startsWith('pe-')) {
    return reservationEmailFor(getPayableEntity(nameOrEntityId))
  }
  return reservationEmailFor(payableEntityFromSupplierName(nameOrEntityId))
}

/** Guests served by a payable entity across all its property lines. */
export function guestsServedByEntity(
  services: AddedService[],
  entityId: string,
  guests: Guest[],
): Guest[] {
  const ids = new Set<number>()
  for (const svc of services) {
    if (payableEntityIdOf(svc) !== entityId) continue
    const d = (svc.draft || {}) as Record<string, unknown>
    for (const r of asRooms(d)) r.guestIds.forEach((id) => ids.add(id))
    for (const v of asVehicles(d)) v.guestIds.forEach((id) => ids.add(id))
    for (const a of asActivities(d)) a.guestIds.forEach((id) => ids.add(id))
  }
  const served = guests.filter((g) => ids.has(g.id))
  return served.length ? served : guests
}

/** @deprecated Use guestsServedByEntity — kept for transitional call sites. */
export function guestsServedBySupplier(
  services: AddedService[],
  supplier: string,
  guests: Guest[],
): Guest[] {
  const entity = payableEntityFromSupplierName(supplier)
  return guestsServedByEntity(services, entity.id, guests)
}

function dietaryStatusOf(gd: GuestDetail | undefined): DietaryStatus {
  if (!gd) return 'not_captured'
  if (gd.dietaryStatus) return gd.dietaryStatus
  return gd.dietary ? 'recorded' : 'not_captured'
}

function dietaryPrintText(status: DietaryStatus, text?: string): string {
  if (status === 'recorded') return text || ''
  if (status === 'none') return 'No special requirements'
  return 'Not yet advised — to follow'
}

/** Every guest a supplier serves, each carrying its three-state requirement (BR-21/22). */
export function buildVoucherGuestRoster(
  served: Guest[],
  guestDetails: GuestDetail[],
): { rows: VoucherGuestRow[]; recordedCount: number; total: number } {
  const rows: VoucherGuestRow[] = served.map((g) => {
    const gd = guestDetails[g.id - 1]
    const status = dietaryStatusOf(gd)
    return {
      name: g.name,
      role: g.type === 'youth' ? 'Child' : g.type[0].toUpperCase() + g.type.slice(1),
      status,
      text: dietaryPrintText(status, gd?.dietary),
    }
  })
  return { rows, recordedCount: rows.filter((r) => r.status === 'recorded').length, total: rows.length }
}

/** Signature of served-guest requirement state — a later add/edit compared to this is what
 *  "changed since issued" means (BR-24/29), not merely "some rows are still blank". */
export function voucherGuestSignature(served: Guest[], guestDetails: GuestDetail[]): string {
  return served
    .map((g) => {
      const gd = guestDetails[g.id - 1]
      const status = dietaryStatusOf(gd)
      return `${g.id}:${status}:${status === 'recorded' ? gd?.dietary || '' : ''}`
    })
    .join('|')
}

/** Full issue snapshot — guest requirements + commercial line facts (PR-F24). */
export function voucherIssueSignature(
  lines: SummaryLine[],
  served: Guest[],
  guestDetails: GuestDetail[],
): string {
  const guestPart = voucherGuestSignature(served, guestDetails)
  const linePart = lines
    .map((l) =>
      [l.lineId, l.serviceId, l.date, l.net, l.rack, l.pax, l.propertyName || l.supplier].join(':'),
    )
    .sort()
    .join('|')
  return `${guestPart}||${linePart}`
}

export function isPayableVoucherLine(l: SummaryLine): boolean {
  return costEffOf(l) > 0
}

export type VoucherOutstandingSummary = { issued: number; awaiting: number; label: string }

export function voucherOutstandingSummary(
  voucherMeta: Record<string, VoucherMeta> = {},
): VoucherOutstandingSummary {
  const entries = Object.values(voucherMeta).filter((m) => m.issued)
  const awaiting = entries.filter((m) => !m.submittedAt).length
  const issued = entries.length
  const label =
    issued === 0
      ? 'No vouchers issued'
      : awaiting
        ? `${awaiting} of ${issued} voucher${issued === 1 ? '' : 's'} awaiting supplier`
        : `${issued} voucher${issued === 1 ? '' : 's'} answered`
  return { issued, awaiting, label }
}

function voucherRoomRowsForEntity(
  items: SummaryLine[],
  services: AddedService[],
  entityId: string,
  guests: Guest[],
): VoucherRoomRow[] {
  const rooms: { line: SummaryLine; guestIds: number[] }[] = []
  for (const svc of services) {
    if (payableEntityIdOf(svc) !== entityId) continue
    const d = (svc.draft || {}) as Record<string, unknown>
    const svcRooms = asRooms(d)
    const stayLines = items.filter((l) => l.type === 'accommodation' && l.serviceId === svc.id)
    stayLines.forEach((line, i) => rooms.push({ line, guestIds: svcRooms[i]?.guestIds || [] }))
  }
  return rooms.map(({ line, guestIds }) => {
    const names = guestIds.map((id) => guests.find((g) => g.id === id)?.name).filter(Boolean) as string[]
    const expected = (line.ad || 0) + (line.ch || 0)
    const who =
      names.length && names.length === expected
        ? names.join(', ')
        : names.length
          ? `${names.join(', ')} — allocation to confirm`
          : 'Allocation to confirm'
    return {
      room: line.roomType || 'Room',
      who,
      meta: [fmtShortDate(line.date), line.nights ? `${line.nights} nights` : null, line.basis]
        .filter(Boolean)
        .join('  ·  '),
    }
  })
}

function parentLineIdForExtra(
  extra: SummaryLine,
  sorted: SummaryLine[],
): string | undefined {
  if (extra.type !== 'extra' || extra.extraKind === 'supplier') return undefined
  const parent = sorted.find(
    (l) => l.serviceId === extra.serviceId && l.type === 'accommodation' && l.lineId,
  )
  return parent?.lineId
}

/** One voucher per payable legal entity (PR-F02), omitting $0 lines (PR-F04). */
export function buildVouchers(
  lines: SummaryLine[],
  mode: VoucherValueMode,
  metaRef: string,
  services: AddedService[],
  guests: Guest[],
  guestDetails: GuestDetail[],
  agency: string,
  supplierVouchers: Record<string, SupplierVoucherStatus> = {},
  voucherLineAnswers: Record<string, VoucherLineAnswer> = {},
  voucherMeta: Record<string, VoucherMeta> = {},
): VoucherCard[] {
  const show = mode !== 'none'
  const payableLines = lines.filter(isPayableVoucherLine)
  const byEntity = new Map<string, SummaryLine[]>()
  for (const l of payableLines) {
    const entityId = l.payableEntityId || payableEntityFromSupplierName(l.supplier).id
    const arr = byEntity.get(entityId) || []
    arr.push(l)
    byEntity.set(entityId, arr)
  }

  const sortedEntityIds = [...byEntity.keys()].sort((a, b) => {
    const aFirst = byEntity.get(a)?.find((l) => l.date)?.date || ''
    const bFirst = byEntity.get(b)?.find((l) => l.date)?.date || ''
    return aFirst.localeCompare(bFirst)
  })

  const seqByEntity = new Map<string, number>()
  sortedEntityIds.forEach((entityId, index) => {
    const persisted = voucherMeta[entityId]?.voucherSeq
    seqByEntity.set(entityId, persisted ?? index + 1)
  })

  const cards = sortedEntityIds.map((entityId) => {
    const items = byEntity.get(entityId) || []
    const legalName = items[0]?.payableEntityName || getPayableEntity(entityId).legalName
    const propertyNames = [...new Set(items.map((l) => l.propertyName || l.supplier).filter(Boolean))]
    const sorted = items.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    const valueOf = (l: SummaryLine) => (mode === 'sell' ? sellEffOf(l) : costEffOf(l))
    const cost = sorted.reduce((a, l) => a + costEffOf(l), 0)
    const totalNum = sorted.reduce((a, l) => a + valueOf(l), 0)
    const rule = depositRuleFor(legalName)
    const first = sorted.find((l) => l.date)?.date || ''
    const last = [...sorted].reverse().find((l) => l.date)?.date || first
    const meta = voucherMeta[entityId]
    const isIssued = !!meta?.issued
    const voucherStatus = supplierVouchers[entityId] || null
    const kind = meta?.kind || 'standard'
    const seq = seqByEntity.get(entityId) || 1
    const ref = meta?.voucherRef || `${metaRef} / V${String(seq).padStart(2, '0')}`

    const responseState: VoucherResponseState = !isIssued
      ? 'Not issued'
      : !meta?.submittedAt
        ? 'Awaiting supplier'
        : meta.submittedVia === 'staff'
          ? 'Recorded by planner'
          : 'Supplier submitted'

    const [holdLabel, holdFg, holdBg] = voucherStatus === 'Confirmed'
      ? (['Supplier hold — confirmed', '#15803D', '#DCFCE7'] as const)
      : voucherStatus === 'Rejected'
        ? (['Supplier rejected', '#B91C1C', '#FEE2E2'] as const)
        : voucherStatus === 'Partial'
          ? (['Partial hold', '#B45309', '#FEF3C7'] as const)
          : isIssued
            ? (['Hold requested', '#B45309', '#FEF3C7'] as const)
            : (['No hold', '#A1A1A1', '#F1F5F9'] as const)

    const year = (last || first || '').slice(0, 4) || ''
    const dateRange =
      first && last
        ? `${fmtShortDate(first)} – ${fmtShortDate(last)}${year ? ` ${year}` : ''}`
        : 'Dates TBC'

    const served = guestsServedByEntity(services, entityId, guests)
    const roster = buildVoucherGuestRoster(served, guestDetails)
    const servedAdults = served.filter((g) => g.type === 'adult' || g.type === 'youth').length
    const servedChildren = served.length - servedAdults
    const partyMix =
      `${served.length} guest${served.length === 1 ? '' : 's'}` +
      (servedAdults || servedChildren
        ? ` · ${[servedAdults ? `${servedAdults} adult${servedAdults === 1 ? '' : 's'}` : null, servedChildren ? `${servedChildren} child${servedChildren === 1 ? '' : 'ren'}` : null].filter(Boolean).join(' · ')}`
        : '')
    const currentContentSig = voucherIssueSignature(sorted, served, guestDetails)
    const changedSinceIssued =
      isIssued && !!meta?.contentSignature && meta.contentSignature !== currentContentSig

    let depositGuardCount = 0
    const rows: VoucherRow[] = sorted.map((l) => {
      const answer = l.lineId ? voucherLineAnswers[l.lineId] : undefined
      const outcome: VoucherRow['outcome'] = answer?.outcome ?? 'pending'
      if (outcome === 'deposit_held_back') depositGuardCount += 1
      const end = lineEndDate(l)
      const propertyPrefix =
        propertyNames.length > 1 && l.propertyName ? `${l.propertyName} · ` : ''
      return {
        lineId: l.lineId || `${l.serviceId}#0`,
        serviceId: l.serviceId,
        date:
          end && end !== l.date ? `${fmtShortDate(l.date)} → ${fmtShortDate(end)}` : fmtShortDate(l.date),
        typeLabel: voucherTypeLabel(l),
        service: `${propertyPrefix}${voucherDesc(l)}`,
        detail: voucherDetail(l) || '—',
        pax: l.pax != null ? String(l.pax) : '—',
        value: wholeUsd(valueOf(l)),
        isExtra: l.type === 'extra',
        parentLineId: parentLineIdForExtra(l, sorted),
        propertyName: l.propertyName || l.supplier,
        outcome,
        reason: answer?.reason,
        depositPaid: !!l.depositPaid,
        reconfirmRequired: l.reconfirmRequired,
        formerSourceRef: l.formerSourceRef,
      }
    })

    const notCaptured = roster.rows.filter((r) => r.status === 'not_captured').length
    const dietLine = notCaptured
      ? `${notCaptured} of ${roster.total} guest${roster.total === 1 ? '' : 's'} dietary & requirements missing`
      : roster.recordedCount
        ? `${roster.recordedCount} of ${roster.total} guest${roster.total === 1 ? '' : 's'} with dietary & requirements recorded`
        : `No dietary & requirements recorded for any of the ${roster.total} guest${roster.total === 1 ? '' : 's'}`

    const discountLines = sorted.filter((l) => (l.discount?.costDelta || 0) > 0)

    const supplierNotes: VoucherNote[] = []
    for (const svc of services) {
      if (payableEntityIdOf(svc) !== entityId) continue
      const d = (svc.draft || {}) as Record<string, unknown>
      const text = String(d.notes || '').trim()
      if (!text) continue
      const line = sorted.find((l) => l.serviceId === svc.id)
      supplierNotes.push({
        key: svc.id,
        label: line ? `${fmtShortDate(line.date)} · ${voucherDesc(line)}` : svc.title,
        text,
      })
    }

    const heldCount = rows.filter((r) => r.outcome === 'held').length
    const rejected = rows.filter((r) => r.outcome === 'rejected')
    const answeredOn = meta?.submittedAt ? fmtPayDate(meta.submittedAt.slice(0, 10)) : ''
    const responsePill =
      responseState === 'Not issued'
        ? { label: responseState, bg: '#F1F5F9', fg: '#64748B' }
        : responseState === 'Awaiting supplier'
          ? { label: responseState, bg: '#FEF3C7', fg: '#B45309' }
          : { label: responseState, bg: '#DCFCE7', fg: '#15803D' }

    const pendingRequestLatest = !!meta?.plannerNotifications?.some(
      (n) => n.kind === 'request_latest' && !n.read,
    )
    const sendHistory = (meta?.sendHistory || []).map((s) => ({
      recipient: s.recipient,
      sentAt: s.sentAt,
      deliveryStatus: s.deliveryStatus,
      via: s.via,
    }))

    return {
      entityId,
      supplier: legalName,
      supplierEmail: supplierEmailFor(entityId),
      propertyNames,
      initials: supplierInitials(legalName),
      ref,
      kind,
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
      gridCols:
        `132px 152px minmax(170px,1.3fr) minmax(190px,1.9fr) 74px` + (show ? ' 118px' : ''),
      headers: [
        { label: 'Dates', align: 'l' as Align },
        { label: 'Type', align: 'l' as Align },
        { label: 'Service', align: 'l' as Align },
        { label: 'Detail', align: 'l' as Align },
        { label: 'Pax', align: 'c' as Align },
        ...(show ? [{ label: mode === 'sell' ? 'Sell' : 'Cost', align: 'r' as Align }] : []),
      ],
      rows,
      deposit: wholeUsd(Math.round(cost * (rule.pct / 100))),
      depositRule: rule.label,
      depositDue: fmtDepositDue(first, rule),
      issued: isIssued,
      activeToken: meta?.tokens.slice().reverse().find((t) => !t.supersededAt)?.token,
      voucherStatus,
      responseState,
      changedSinceIssued,
      depositGuardCount,
      note: meta?.note || '',
      issuedAt: meta?.issuedAt,
      issuedTo: meta?.issuedTo || [],
      resendCount: meta?.resendCount || 0,
      submittedByName: meta?.submittedByName,
      submittedByEmail: meta?.submittedByEmail,
      leadGuest: guests.find((g) => g.lead)?.name || guests[0]?.name || '',
      partyMix,
      agency,
      rooms: voucherRoomRowsForEntity(sorted, services, entityId, guests),
      guestRoster: roster.rows,
      guestCoverageLabel: `Recorded for ${roster.recordedCount} of ${roster.total} guest${roster.total === 1 ? '' : 's'}`,
      dietLine,
      dietColor: notCaptured ? '#B45309' : '#15803D',
      paxRows: served.map((g) => {
        const band = g.type === 'infant' ? 'Infant' : g.type === 'adult' ? 'Adult' : 'Child'
        return {
          key: String(g.id),
          name: g.name,
          bandLabel: g.lead ? `${band} Lead` : band,
        }
      }),
      supplierNotes,
      hasDiscount: discountLines.length > 0,
      discountRows: discountLines.map((l, i) => ({
        key: l.lineId || `${l.serviceId}#${i}`,
        label: `${fmtShortDate(l.date)} · ${voucherDesc(l)}`,
        from: wholeUsd(l.net),
        to: wholeUsd(costEffOf(l)),
        tag: l.discount?.label || '',
      })),
      discountNote:
        'The supplier is paid the adjusted cost — agree it with them before they invoice.',
      emailLine: meta?.issuedAt
        ? `Request sent ${fmtPayDate(meta.issuedAt.slice(0, 10))} to ${meta.issuedTo.join(', ') || supplierEmailFor(entityId)}` +
          (meta.resendCount ? `  ·  resent ${meta.resendCount}×` : '') +
          '  ·  confirmation link included'
        : '',
      sendHistory,
      pendingRequestLatest,
      responsePill,
      responseHint:
        responseState === 'Awaiting supplier'
          ? 'Supplier ticks the lines they can hold and submits from the link'
          : responseState === 'Not issued'
            ? ''
            : 'Per-line outcome recorded against the itinerary',
      responseSummary: meta?.submittedAt
        ? `${heldCount} service line${heldCount === 1 ? '' : 's'} on hold  ·  ` +
          `${rejected.length ? `${rejected.length} rejected` : 'nothing rejected'}  ·  ` +
          `${responseState === 'Recorded by planner' ? 'recorded by planner ' : 'submitted by supplier '}${answeredOn}`
        : '',
      responseRejected: rejected.map((r) => ({
        key: r.lineId,
        text: `${r.date} · ${r.service}${r.reason ? ` — ${r.reason}` : ''}`,
      })),
      responseAwaitText: `Waiting on ${legalName} to submit from the link in their email. If they reply by email instead, record their per-line answer here.`,
    }
  })

  return cards.sort((a, b) => (a.first || '').localeCompare(b.first || ''))
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

/** Newest-first lifecycle status log for the Summary Activity tab. */
export function buildLifecycleActivityLog(entries: LifecycleLogEntry[] | undefined): LifecycleLogEntry[] {
  if (!entries?.length) return []
  return [...entries].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}
