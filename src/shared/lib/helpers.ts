import type {
  Guest,
  GuestDetail,
  Itinerary,
  ItineraryStatus,
  ListFilters,
  PaymentStatus,
  SortKey,
  SplitForm,
} from './types'
import { GUESTS, LIFECYCLE_TRANSITIONS, PAYMENT_META, STATUS_META } from './catalogs'

export function inquiryRefLabel(reference: string): string {
  const base = String(reference || '').split('-')[0]
  let h = 0
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) % 900000
  return `HS-${100000 + h}`
}

export function parentReference(reference: string): string | null {
  const parts = String(reference || '').split('-')
  if (parts.length <= 1) return null
  parts.pop()
  return parts.join('-')
}

export function depthOf(reference: string): number {
  return Math.max(0, String(reference || '').split('-').length - 1)
}

/** Root CPS number from a reference (ignores split suffixes like `-1-2`). */
export function rootCpsNumber(reference: string): number {
  const base = String(reference || '').split('-')[0]
  const n = Number(base.replace(/\D/g, ''))
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Margin % from sell total using the demo rack rule (sell ≈ net × 1.3).
 * Same formula used on Summary / Quote so list chips stay consistent.
 */
export function marginPct(it: Pick<Itinerary, 'totalUsd'>): number | null {
  return marginFromSell(it.totalUsd)
}

export function marginFromSell(sell: number): number | null {
  if (!sell || sell <= 0) return null
  const net = sell / 1.3
  return Math.round(((sell - net) / sell) * 100)
}

export function parseMoney(raw?: string): number {
  return Number(String(raw || '0').replace(/[^0-9.-]/g, '')) || 0
}

export function quoteGroupsTotal(
  groups: { services: { subtotal: string }[] }[],
): number {
  return groups.reduce(
    (sum, g) => sum + g.services.reduce((s, sv) => s + parseMoney(sv.subtotal), 0),
    0,
  )
}

export function marginChip(mp: number) {
  return {
    bg: mp >= 25 ? '#DCFCE7' : mp >= 15 ? '#FEF3C7' : '#FEE2E2',
    fg: mp >= 25 ? '#166534' : mp >= 15 ? '#92400E' : '#B91C1C',
  }
}

export function holdMeta(it: Pick<Itinerary, 'reference' | 'status'>) {
  let h = 0
  const ref = String(it.reference || '')
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) % 97
  const daysLeft = (h % 6) - 1
  if (!['DRAFT', 'QUOTED', 'PREPARED'].includes(it.status)) return { hasHold: false as const }
  if (daysLeft < 0) return { hasHold: true as const, label: 'Expired', bg: '#FEE2E2', fg: '#B91C1C' }
  if (daysLeft === 0) return { hasHold: true as const, label: 'Today', bg: '#FEE2E2', fg: '#B91C1C' }
  if (daysLeft <= 2) return { hasHold: true as const, label: `${daysLeft}d left`, bg: '#FEF3C7', fg: '#92400E' }
  return { hasHold: true as const, label: `${daysLeft}d left`, bg: '#F1F5F9', fg: '#475569' }
}

export function travelProximity(from: string, to: string | undefined, isTerminal: boolean) {
  if (isTerminal || !from) return { show: false as const }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(from + 'T00:00:00')
  const end = new Date((to || from) + 'T00:00:00')
  const days = Math.round((start.getTime() - today.getTime()) / 86400000)
  if (days < 0) {
    if (end >= today) return { show: true as const, label: 'Traveling', bg: '#DBEAFE', fg: '#1D4ED8' }
    return { show: false as const }
  }
  if (days === 0) return { show: true as const, label: 'Today', bg: '#FEE2E2', fg: '#B91C1C' }
  if (days <= 7) return { show: true as const, label: `${days}d`, bg: '#FEE2E2', fg: '#B91C1C' }
  if (days <= 30) return { show: true as const, label: `${days}d`, bg: '#FEF3C7', fg: '#92400E' }
  return { show: false as const }
}

export function isTerminalStatus(status: ItineraryStatus) {
  return ['COMPLETED', 'LOST', 'CANCELLED', 'SUPERSEDED'].includes(status)
}

export function transitions(status: ItineraryStatus) {
  return LIFECYCLE_TRANSITIONS[status] ?? []
}

export function statusMeta(status: ItineraryStatus) {
  return STATUS_META[status] ?? STATUS_META.DRAFT
}

export function paymentMeta(status: PaymentStatus) {
  return PAYMENT_META[status] ?? PAYMENT_META.UNPAID
}

export function emptyFilters(): ListFilters {
  return {
    status: null,
    payment: null,
    agency: null,
    destination: null,
    dateFrom: '',
    dateTo: '',
    createdFrom: '',
    createdTo: '',
  }
}

export function filterItineraries(list: Itinerary[], query: string, f: ListFilters): Itinerary[] {
  const q = query.trim().toLowerCase()
  return list.filter((it) => {
    if (f.status && it.status !== f.status) return false
    if (f.payment && it.paymentStatus !== f.payment) return false
    if (f.agency && it.agency !== f.agency) return false
    if (f.destination && it.destination !== f.destination) return false
    if (f.dateFrom && it.travelDateFrom < f.dateFrom) return false
    if (f.dateTo && it.travelDateTo > f.dateTo) return false
    if (f.createdFrom && it.createdAt < f.createdFrom) return false
    if (f.createdTo && it.createdAt > f.createdTo) return false
    if (!q) return true
    const hay = [
      it.reference,
      it.itineraryRef,
      inquiryRefLabel(it.reference),
      it.title,
      it.agency,
      it.agent,
      it.destination,
      `${it.leadFirst || ''} ${it.leadLast || ''}`,
    ]
      .join(' ')
      .toLowerCase()
    return hay.includes(q)
  })
}

export function sortItineraries(list: Itinerary[], key: SortKey, dir: 'asc' | 'desc'): Itinerary[] {
  if (!key) return list
  const mul = dir === 'asc' ? 1 : -1
  return [...list].sort((a, b) => {
    let av: string | number = 0
    let bv: string | number = 0
    if (key === 'reference') {
      av = a.reference
      bv = b.reference
    } else if (key === 'title') {
      av = a.title
      bv = b.title
    } else if (key === 'travel') {
      av = a.travelDateFrom
      bv = b.travelDateFrom
    } else if (key === 'status') {
      av = a.status
      bv = b.status
    } else if (key === 'total') {
      av = a.totalUsd
      bv = b.totalUsd
    } else if (key === 'margin') {
      av = marginPct(a) ?? -1
      bv = marginPct(b) ?? -1
    } else if (key === 'payment') {
      av = a.paymentStatus
      bv = b.paymentStatus
    } else if (key === 'agency') {
      av = a.agency
      bv = b.agency
    } else if (key === 'hold') {
      av = holdMeta(a).label || ''
      bv = holdMeta(b).label || ''
    }
    if (av < bv) return -1 * mul
    if (av > bv) return 1 * mul
    return 0
  })
}

export interface TreeRow {
  itinerary: Itinerary
  depth: number
  hasChildren: boolean
  collapsed: boolean
  canSplit: boolean
  isSubquote: boolean
}

export function buildItineraryRows(
  list: Itinerary[],
  collapsedRefs: Record<string, boolean>,
): TreeRow[] {
  const byParent = new Map<string | null, Itinerary[]>()
  for (const it of list) {
    const p = parentReference(it.reference)
    const key = p && list.some((x) => x.reference === p) ? p : null
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(it)
  }
  const rows: TreeRow[] = []
  const walk = (parent: string | null, depth: number) => {
    const kids = byParent.get(parent) || []
    for (const it of kids) {
      const children = byParent.get(it.reference) || []
      const collapsed = !!collapsedRefs[it.reference]
      rows.push({
        itinerary: it,
        depth,
        hasChildren: children.length > 0,
        collapsed,
        canSplit: depth < 2,
        isSubquote: depth === 2,
      })
      if (!collapsed) walk(it.reference, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

export function nextChildReference(parentRef: string, itineraries: Itinerary[]): string {
  const siblings = itineraries.filter((x) => parentReference(x.reference) === parentRef)
  const nextSuffix =
    siblings.reduce((m, x) => Math.max(m, parseInt(String(x.reference).split('-').pop() || '0', 10) || 0), 0) + 1
  return `${parentRef}-${nextSuffix}`
}

export function createSplitRecord(
  itineraries: Itinerary[],
  parentRef: string,
  sf: SplitForm,
): Itinerary | null {
  const src = itineraries.find((x) => x.reference === parentRef)
  if (!src) return null
  const newRef = nextChildReference(parentRef, itineraries)
  const nextSuffix = parseInt(newRef.split('-').pop()!, 10)
  const fam = sf.family.trim()
  const ad = parseInt(sf.ad, 10) || 0
  const ch = parseInt(sf.ch, 10) || 0
  const guests = [ad ? `${ad} Ad` : '', ch ? `${ch} Ch` : ''].filter(Boolean).join(' · ') || '—'
  return {
    ...src,
    id: newRef,
    reference: newRef,
    itineraryRef: `${src.itineraryRef || 'ITN-10234'}-${nextSuffix}`,
    title: fam || `Copy ${src.title || 'Untitled Itinerary'}`,
    paxAdults: ad,
    paxChildren: ch,
    adults: ad,
    children: ch,
    guestsLabel: guests,
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    totalUsd: 0,
    balanceUsd: 0,
    updatedAt: new Date().toISOString(),
  }
}

export function copyItinerary(src: Itinerary, all: Itinerary[]): Itinerary {
  const nums = all.map((it) => rootCpsNumber(it.reference)).filter((n) => n > 0)
  const max = nums.length ? Math.max(...nums) : 5687
  const id = `CPS${max + 1}`
  return {
    ...src,
    id,
    reference: id,
    itineraryRef: `ITN-${10000 + (max + 1) % 10000}`,
    title: `Copy ${src.title}`,
    status: 'DRAFT',
    paymentStatus: 'UNPAID',
    totalUsd: 0,
    balanceUsd: 0,
    createdAt: new Date().toISOString().slice(0, 10),
    updatedAt: new Date().toISOString(),
  }
}

export type Zone = 'red' | 'yellow' | 'green'

export function dashboardData(list: Itinerary[]) {
  const refs = new Set(list.map((i) => i.reference))
  const leaves = list.filter((it) => !list.some((c) => parentReference(c.reference) === it.reference && refs.has(c.reference)))
  const active = leaves.filter((it) => ['DRAFT', 'PREPARED', 'QUOTED', 'APPROVED'].includes(it.status))
  const sla: Record<string, number> = { DRAFT: 2, PREPARED: 3, QUOTED: 4, APPROVED: 5 }
  const partnerMeta: Record<string, { tier: string; score: number }> = {
    CPS: { tier: 'Preferred', score: 92 },
    'Black Tomato': { tier: 'Preferred', score: 87 },
    'Zoo Groups': { tier: 'Standard', score: 78 },
  }
  const now = Date.now()
  const maxVal = Math.max(1, ...active.map((a) => a.totalUsd))
  const queue = active
    .map((it) => {
      const days = Math.max(0, Math.round((now - new Date(it.updatedAt).getTime()) / 86400000))
      const ratio = days / (sla[it.status] || 3)
      const zone: Zone = ratio >= 2 ? 'red' : ratio >= 1 ? 'yellow' : 'green'
      const partner = partnerMeta[it.agency] || { tier: 'Standard', score: 70 }
      const mp = marginPct(it) ?? 0
      const urgency = zone === 'red' ? 1 : zone === 'yellow' ? 0.6 : 0.2
      const score = Math.round(
        100 * (0.4 * urgency + 0.25 * (it.totalUsd / maxVal) + 0.15 * Math.min(1, mp / 40) + 0.2 * (partner.score / 100)),
      )
      return { it, zone, days, score, partner, margin: mp }
    })
    .sort((a, b) => b.score - a.score)

  const stats = {
    overdue: queue.filter((q) => q.zone === 'red').length,
    watch: queue.filter((q) => q.zone === 'yellow').length,
    onTrack: queue.filter((q) => q.zone === 'green').length,
    pipeline: queue.reduce((s, q) => s + q.it.totalUsd, 0),
  }

  const partnersMap = new Map<string, { name: string; tier: string; score: number; count: number; value: number }>()
  for (const q of queue) {
    const cur = partnersMap.get(q.it.agency) || {
      name: q.it.agency,
      tier: q.partner.tier,
      score: q.partner.score,
      count: 0,
      value: 0,
    }
    cur.count += 1
    cur.value += q.it.totalUsd
    partnersMap.set(q.it.agency, cur)
  }
  const partners = [...partnersMap.values()].sort((a, b) => b.score - a.score)

  return { stats, queue, partners, empty: queue.length === 0 }
}

export function rackOf(net: number) {
  return Math.round(net * 1.3 * 100) / 100
}

export function nightsBetween(start: string, end: string) {
  if (!start || !end) return 0
  const a = new Date(start)
  const b = new Date(end)
  const diff = Math.round((b.getTime() - a.getTime()) / 86400000)
  return diff > 0 ? diff : 0
}

/**
 * Build the assignable party for builder / quote overlays.
 * Prefer saved guest details; otherwise expand from itinerary pax counts.
 * Falls back to the demo GUESTS catalog only when the itinerary has no pax data.
 */
export function partyGuests(it: Itinerary, details?: GuestDetail[]): Guest[] {
  if (details && details.length > 0) {
    return details.map((d, i) => ({
      id: i + 1,
      name:
        [d.firstName, d.lastName].filter(Boolean).join(' ').trim() ||
        (d.lead ? 'Lead traveler' : `Guest ${i + 1}`),
      type: d.ageBand,
      age:
        d.age ??
        (d.ageBand === 'adult' ? 30 : d.ageBand === 'youth' ? 14 : d.ageBand === 'infant' ? 1 : 8),
      lead: !!d.lead,
      resident: true,
    }))
  }

  const adults = it.adults ?? it.paxAdults ?? 0
  const children = it.children ?? it.paxChildren ?? 0
  const infants = it.infants ?? 0
  if (adults + children + infants === 0) return [...GUESTS]

  const guests: Guest[] = []
  let id = 1
  const adultsRes = it.adultsRes ?? adults
  const adultsNonRes = it.adultsNonRes ?? 0
  const childrenRes = it.childrenRes ?? 0
  const childrenNonRes = it.childrenNonRes ?? children
  const infantsRes = it.infantsRes ?? 0
  const infantsNonRes = it.infantsNonRes ?? infants
  const ages = it.childAges || []

  for (let i = 0; i < adultsRes; i++) {
    guests.push({
      id: id++,
      name: i === 0 && (it.leadFirst || it.leadLast)
        ? [it.leadFirst, it.leadLast].filter(Boolean).join(' ')
        : i === 0
          ? 'Lead traveler'
          : `Adult ${i + 1}`,
      type: 'adult',
      age: 34,
      lead: i === 0,
      resident: true,
    })
  }
  for (let i = 0; i < adultsNonRes; i++) {
    guests.push({
      id: id++,
      name: `Adult ${adultsRes + i + 1}`,
      type: 'adult',
      age: 32,
      resident: false,
    })
  }

  let childIdx = 0
  for (let i = 0; i < childrenRes; i++) {
    const age = ages[childIdx++] ?? 8
    guests.push({
      id: id++,
      name: `Child ${childIdx}`,
      type: age >= 12 ? 'youth' : 'child',
      age,
      resident: true,
    })
  }
  for (let i = 0; i < childrenNonRes; i++) {
    const age = ages[childIdx++] ?? 8
    guests.push({
      id: id++,
      name: `Child ${childIdx}`,
      type: age >= 12 ? 'youth' : 'child',
      age,
      resident: false,
    })
  }
  for (let i = 0; i < infantsRes; i++) {
    guests.push({ id: id++, name: `Infant ${i + 1}`, type: 'infant', age: 1, resident: true })
  }
  for (let i = 0; i < infantsNonRes; i++) {
    guests.push({
      id: id++,
      name: `Infant ${infantsRes + i + 1}`,
      type: 'infant',
      age: 1,
      resident: false,
    })
  }
  return guests
}
