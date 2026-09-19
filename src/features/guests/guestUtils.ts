import { guestRoleLabel } from '@/shared/lib/helpers'
import type { AddedService, GuestDetail, Itinerary, QuoteGroup } from '@/shared/lib/types'

export type GuestRole = 'Adult' | 'Child' | 'Infant'

export interface ServiceLineRef {
  id: string
  label: string
  short: string
  status: string
  locked: boolean
  minAge: number
}

export interface GuestPendingChange {
  id: string
  kind: string
  text: string
}

export interface GuestCoverage {
  lineIds: string[]
  assigned: number
  total: number
  skipped: number
}

const LOCKED_STATUSES = new Set([
  'Confirmed',
  'Invoiced',
  'Vouchered',
  'CONFIRMED',
  'INVOICED',
  'VOUCHERED',
])

export function bandToRole(band: GuestDetail['ageBand']): GuestRole {
  if (band === 'infant') return 'Infant'
  if (band === 'adult') return 'Adult'
  return 'Child'
}

export function roleToBand(role: GuestRole): GuestDetail['ageBand'] {
  if (role === 'Infant') return 'infant'
  if (role === 'Adult') return 'adult'
  return 'child'
}

export function isPlaceholderGuest(g: GuestDetail): boolean {
  return !String(g.firstName || '').trim() && !String(g.lastName || '').trim()
}

export function guestDisplayName(g: GuestDetail, all: GuestDetail[]): string {
  const named = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
  if (named) return named
  const role = guestRoleLabel(g.ageBand)
  const same = all.filter((x) => x.ageBand === g.ageBand)
  const n = same.findIndex((x) => x.id === g.id) + 1
  return `${role} ${n || 1}`
}

export function guestInitials(g: GuestDetail, all: GuestDetail[]): string {
  const first = String(g.firstName || '').trim()
  const last = String(g.lastName || '').trim()
  if (first || last) {
    return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || first.charAt(0).toUpperCase() || '?'
  }
  return guestDisplayName(g, all).slice(0, 2).toUpperCase()
}

/** Collect assignable service lines from builder drafts + quote rows. */
export function collectServiceLines(
  services: AddedService[],
  quoteGroups: QuoteGroup[] = [],
): ServiceLineRef[] {
  const fromQuote: ServiceLineRef[] = []
  for (const g of quoteGroups) {
    for (const sv of g.services) {
      fromQuote.push({
        id: `q:${g.id}:${sv.id}`,
        label: `${g.name} — ${sv.title}${sv.sub ? ` ${sv.sub}` : ''}`,
        short: `${sv.title}${sv.sub ? ` ${sv.sub}` : ''}`,
        status: sv.statusLabel || 'Draft',
        locked: LOCKED_STATUSES.has(sv.statusLabel || ''),
        minAge: 0,
      })
    }
  }
  if (fromQuote.length) return fromQuote

  return services.map((s) => ({
    id: `s:${s.id}`,
    label: s.title,
    short: s.title,
    status: 'Draft',
    locked: false,
    minAge: 0,
  }))
}

function draftGuestPools(draft: Record<string, unknown>): number[][] {
  const pools: number[][] = []
  const rooms = draft.rooms
  if (Array.isArray(rooms)) {
    for (const r of rooms) {
      if (r && typeof r === 'object' && Array.isArray((r as { guestIds?: number[] }).guestIds)) {
        pools.push((r as { guestIds: number[] }).guestIds)
      }
    }
  }
  const vehicles = draft.vehicles
  if (Array.isArray(vehicles)) {
    for (const v of vehicles) {
      if (v && typeof v === 'object' && Array.isArray((v as { guestIds?: number[] }).guestIds)) {
        pools.push((v as { guestIds: number[] }).guestIds)
      }
    }
  }
  const activities = draft.activities
  if (Array.isArray(activities)) {
    for (const a of activities) {
      if (a && typeof a === 'object' && Array.isArray((a as { guestIds?: number[] }).guestIds)) {
        pools.push((a as { guestIds: number[] }).guestIds)
      }
    }
  }
  return pools
}

/** Map guest detail index (0-based) → line ids where that guest appears. */
export function guestLineAssignments(
  guests: GuestDetail[],
  services: AddedService[],
  lines: ServiceLineRef[],
): Map<string, string[]> {
  const map = new Map<string, string[]>()
  guests.forEach((g) => map.set(g.id, []))

  const quoteLines = lines.filter((l) => l.id.startsWith('q:'))
  if (quoteLines.length) {
    // Quote rows don't store per-guest assignment — infer from builder drafts when present.
  }

  services.forEach((svc) => {
    const lineId = `s:${svc.id}`
    const lineExists = lines.some((l) => l.id === lineId) || !lines.length
    if (!lineExists && lines.length) return
    const pools = draftGuestPools(svc.draft || {})
    const assigned = new Set<number>()
    pools.forEach((ids) => ids.forEach((id) => assigned.add(Number(id))))
    guests.forEach((g, i) => {
      const numericId = i + 1
      if (!assigned.has(numericId)) return
      const cur = map.get(g.id) || []
      const id = lines.length ? lineId : lineId
      if (!cur.includes(id)) cur.push(id)
      map.set(g.id, cur)
    })
  })

  // If only quote lines exist (no builder drafts), treat every guest as unassigned
  // unless we found draft assignments above.
  return map
}

export function coverageForGuest(
  guestId: string,
  assignments: Map<string, string[]>,
  lines: ServiceLineRef[],
): GuestCoverage {
  const lineIds = (assignments.get(guestId) || []).filter((id) => lines.some((l) => l.id === id))
  const total = lines.length
  const assigned = lineIds.length
  return { lineIds, assigned, total, skipped: Math.max(0, total - assigned) }
}

export function buildGuestIssues(
  guests: GuestDetail[],
  assignments: Map<string, string[]>,
  lines: ServiceLineRef[],
): { text: string }[] {
  const issues: { text: string }[] = []
  const unassigned = guests.filter((g) => {
    const n = (assignments.get(g.id) || []).filter((id) => lines.some((l) => l.id === id)).length
    return lines.length > 0 && n === 0
  })
  const unnamed = guests.filter(isPlaceholderGuest)
  const noAge = guests.filter((g) => g.age == null || Number.isNaN(Number(g.age)))

  if (unassigned.length) {
    const names = unassigned.map((g) => guestDisplayName(g, guests)).join(', ')
    issues.push({
      text: `${names} ${unassigned.length === 1 ? 'is' : 'are'} not assigned to any service line.`,
    })
  }
  if (unnamed.length) {
    issues.push({
      text: `${unnamed.length} placeholder guest${unnamed.length === 1 ? '' : 's'} still to be named — names flow through to service lines, rooming lists and vouchers automatically.`,
    })
  }
  if (noAge.length) {
    issues.push({
      text: `${noAge.length} guest${noAge.length === 1 ? '' : 's'} without an age — supplier age bands cannot be validated automatically.`,
    })
  }
  return issues
}

export function syncItineraryPaxFromGuests(itinerary: Itinerary, guests: GuestDetail[]): Itinerary {
  const adults = guests.filter((g) => g.ageBand === 'adult').length
  const children = guests.filter((g) => g.ageBand === 'child').length
  const infants = guests.filter((g) => g.ageBand === 'infant').length
  const lead = guests.find((g) => g.lead) || guests[0]
  const count = (band: GuestDetail['ageBand'], residency: GuestDetail['residency']) =>
    guests.filter((g) => g.ageBand === band && (g.residency || 'resident') === residency).length

  return {
    ...itinerary,
    adults,
    children,
    infants,
    paxAdults: adults,
    paxChildren: children,
    adultsCitizen: count('adult', 'citizen'),
    adultsRes: count('adult', 'resident'),
    adultsNonRes: count('adult', 'nonResident'),
    childrenCitizen: count('child', 'citizen'),
    childrenRes: count('child', 'resident'),
    childrenNonRes: count('child', 'nonResident'),
    infantsCitizen: count('infant', 'citizen'),
    infantsRes: count('infant', 'resident'),
    infantsNonRes: count('infant', 'nonResident'),
    childAges: guests.filter((g) => g.ageBand === 'child').map((g) => g.age ?? 8),
    leadFirst: lead?.firstName || itinerary.leadFirst,
    leadLast: lead?.lastName || itinerary.leadLast,
    guestsLabel: [
      adults ? `${adults} Ad` : '',
      children ? `${children} Ch` : '',
      infants ? `${infants} In` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    updatedAt: new Date().toISOString(),
  }
}

/** Remove guest at index and remap draft guestIds (1-based). */
export function removeGuestFromServices(
  services: AddedService[],
  removeIndex: number,
): AddedService[] {
  const removeId = removeIndex + 1
  function remapIds(ids: number[]): number[] {
    return ids
      .filter((id) => Number(id) !== removeId)
      .map((id) => (Number(id) > removeId ? Number(id) - 1 : Number(id)))
  }
  function remapList<T extends { guestIds: number[] }>(list: T[] | undefined): T[] | undefined {
    if (!Array.isArray(list)) return list
    return list.map((item) => ({ ...item, guestIds: remapIds(item.guestIds || []) }))
  }

  return services.map((s) => {
    const draft = { ...(s.draft || {}) }
    if (Array.isArray(draft.rooms)) draft.rooms = remapList(draft.rooms as { guestIds: number[] }[])
    if (Array.isArray(draft.vehicles))
      draft.vehicles = remapList(draft.vehicles as { guestIds: number[] }[])
    if (Array.isArray(draft.activities))
      draft.activities = remapList(draft.activities as { guestIds: number[] }[])
    return { ...s, draft }
  })
}

/** Auto-allocate new guest (1-based id) onto every draft pool that has capacity room or is open. */
export function autoAllocateGuestOnServices(
  services: AddedService[],
  guestNumericId: number,
): AddedService[] {
  function addTo(ids: number[]): number[] {
    if (ids.includes(guestNumericId)) return ids
    return [...ids, guestNumericId]
  }
  return services.map((s) => {
    const draft = { ...(s.draft || {}) }
    let changed = false
    if (Array.isArray(draft.rooms) && (draft.rooms as { guestIds: number[] }[]).length) {
      draft.rooms = (draft.rooms as { guestIds: number[] }[]).map((r, i) => {
        if (i !== 0) return r
        changed = true
        return { ...r, guestIds: addTo(r.guestIds || []) }
      })
    }
    if (Array.isArray(draft.vehicles) && (draft.vehicles as { guestIds: number[] }[]).length) {
      draft.vehicles = (draft.vehicles as { guestIds: number[] }[]).map((v, i) => {
        if (i !== 0) return v
        changed = true
        return { ...v, guestIds: addTo(v.guestIds || []) }
      })
    }
    if (Array.isArray(draft.activities) && (draft.activities as { guestIds: number[] }[]).length) {
      draft.activities = (draft.activities as { guestIds: number[] }[]).map((a) => {
        changed = true
        return { ...a, guestIds: addTo(a.guestIds || []) }
      })
    }
    return changed ? { ...s, draft } : s
  })
}

export function blankGuest(role: GuestRole = 'Adult'): GuestDetail {
  return {
    id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    salutation: role === 'Adult' ? 'Mr' : '',
    firstName: '',
    lastName: '',
    ageBand: roleToBand(role),
    age: role === 'Adult' ? 34 : role === 'Child' ? 8 : 1,
    residency: 'nonResident',
    lead: false,
    note: '',
    dietary: '',
    preferences: '',
    flight: '',
  }
}

export function dietaryStatusOf(g: GuestDetail): 'recorded' | 'none' | 'not_captured' {
  if (g.dietaryStatus) return g.dietaryStatus
  return g.dietary ? 'recorded' : 'not_captured'
}

export function dietaryRequirementsLabel(g: GuestDetail): string {
  const status = dietaryStatusOf(g)
  if (status === 'recorded') return g.dietary?.trim() || '—'
  if (status === 'none') return 'No requirements'
  return 'Not yet advised'
}

export function roleChipClass(role: GuestRole): string {
  if (role === 'Adult') return 'bg-[#EEF2FF] text-[#3730A3]'
  if (role === 'Child') return 'bg-[#ECFDF5] text-[#047857]'
  return 'bg-[#FDF2F8] text-[#9D174D]'
}
