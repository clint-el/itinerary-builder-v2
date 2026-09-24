import type { DemoRole, ServiceTab } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'

/**
 * Mocked "View Cancellation Policy" domain (PCP-206 rebuild). Mirrors the real
 * production schema from PCP-519 (Policy has one-or-more Rules) so this prototype's
 * shapes translate directly once a real API exists — see cancellation_policy
 * implementation brief for the full AC set this file exists to satisfy.
 */

export type CancellationReferenceEvent = 'Travel Date' | 'Booking Date'
export type CancellationRuleDirection = 'Before' | 'After'
export type CancellationPenaltyType = 'Percent' | 'Value'

export interface CancellationRule {
  id: string
  policyId: string
  starts: CancellationRuleDirection
  referenceEvent: CancellationReferenceEvent
  /** Inclusive window bound, in days from the reference event. */
  startDay: number
  /** Inclusive window bound; 0 means "through arrival/no-show". */
  endDay: number
  startTime?: string
  endTime?: string
  penaltyValue: number
  penaltyType: CancellationPenaltyType
}

export interface CancellationPolicy {
  id: string
  name: string
  description: string
  refundable: boolean
  status: 'Active' | 'Inactive'
  /** Applicability window — one range per mock policy, per the implementation brief. */
  travelDateFrom: string
  travelDateTo: string
  rules: CancellationRule[]
}

/** AC4 — the overlap candidate a user picked, with the acting demo user + timestamp. */
export interface CancellationSelection {
  policyId: string
  actor: DemoRole
  at: string
}

export type CancellationOutcome =
  | { kind: 'none' }
  | { kind: 'complete'; policy: CancellationPolicy }
  | { kind: 'non-refundable'; policy: CancellationPolicy }
  | { kind: 'incomplete'; policy: CancellationPolicy }
  | { kind: 'overlap'; candidates: CancellationPolicy[] }

function policy(input: {
  id: string
  name: string
  description: string
  refundable: boolean
  status?: 'Active' | 'Inactive'
  travelDateFrom: string
  travelDateTo: string
  rules?: Array<Omit<CancellationRule, 'id' | 'policyId'>>
}): CancellationPolicy {
  return {
    id: input.id,
    name: input.name,
    description: input.description,
    refundable: input.refundable,
    status: input.status ?? 'Active',
    travelDateFrom: input.travelDateFrom,
    travelDateTo: input.travelDateTo,
    rules: (input.rules ?? []).map((r, i) => ({ ...r, id: `${input.id}-r${i + 1}`, policyId: input.id })),
  }
}

function key(tab: ServiceTab, supplier: string): string {
  return `${tab}::${supplier}`
}

/**
 * Mock dataset. Keyed by service tab + exact supplier name (matches
 * `CatalogItem.name` from `@/shared/lib/catalogs`). Two Flight suppliers —
 * "Coastal Aviation" (scheduled) and "Coastal Aviation Charter" — exist purely
 * to demonstrate the Scheduled-vs-Charter distinction from the real BRD.
 *
 * Every AC state (2–6) is exercised by at least one supplier per tab; see the
 * session report for the full map.
 */
const CANCELLATION_POLICIES: Record<string, CancellationPolicy[]> = {
  // ---- Accommodation ------------------------------------------------------
  [key('accommodation', 'Hemingways Nairobi')]: [
    policy({
      id: 'cp-hem-nbo',
      name: 'Standard Cancellation Policy',
      description: 'Standard terms for advance accommodation bookings at Hemingways Nairobi.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 60, endDay: 31, penaltyValue: 25, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 15, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('accommodation', 'Hemingways Watamu')]: [
    policy({
      id: 'cp-hem-wtm',
      name: 'Non-Refundable Advance Purchase Rate',
      description: 'Discounted advance-purchase rate — no refund at any point after booking.',
      refundable: false,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
    }),
  ],
  [key('accommodation', 'Elewana Sand River Masai Mara')]: [
    // Real BRD example: Elewana Collection — FIT bookings, Mid/Green season.
    policy({
      id: 'cp-elw-sr-fit',
      name: 'FIT Mid/Green Season Cancellation Policy',
      description:
        'Elewana Collection FIT booking terms, Mid/Green season: deposit forfeited on booking; 50% 60–31 days prior; 100% inside 30 days.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'After', referenceEvent: 'Booking Date', startDay: 0, endDay: 0, penaltyValue: 20, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 60, endDay: 31, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('accommodation', 'Elewana Loisaba Tented Camp')]: [
    // Two overlapping windows on purpose — travel dates inside Aug 15–Sep 15
    // land on both, outside it lands on High Season CP alone (or none, before/after Jul–Oct).
    policy({
      id: 'cp-elw-lois-high',
      name: 'High Season CP',
      description: 'Applies to High Season stays (1 Jul – 31 Oct).',
      refundable: true,
      travelDateFrom: '2026-07-01',
      travelDateTo: '2026-10-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 45, endDay: 15, penaltyValue: 30, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 0, penaltyValue: 60, penaltyType: 'Percent' },
      ],
    }),
    policy({
      id: 'cp-elw-lois-peak',
      name: 'Peak Season CP',
      description: 'Applies to the Peak Season surcharge window (15 Aug – 15 Sep).',
      refundable: true,
      travelDateFrom: '2026-08-15',
      travelDateTo: '2026-09-15',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 60, endDay: 31, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('accommodation', 'The Wilder Group')]: [
    // Real BRD example, intentionally left short of arrival: 20% deposit + two
    // bands down to day 34 — no rule covers day 33 down to 0 (AC5 gap).
    policy({
      id: 'cp-wilder',
      name: 'Wilder Group Standard Terms',
      description: 'The Wilder Group accommodation cancellation terms.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'After', referenceEvent: 'Booking Date', startDay: 0, endDay: 0, penaltyValue: 20, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 90, endDay: 46, penaltyValue: 20, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 45, endDay: 34, penaltyValue: 50, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('accommodation', "Governors' Camp")]: [
    // Proves the Active-only filter: this would otherwise resolve for any 2026 date.
    policy({
      id: 'cp-gov-camp-legacy',
      name: 'Legacy Cancellation Policy (retired)',
      description: 'Superseded policy kept for history — must not resolve while Inactive.',
      refundable: true,
      status: 'Inactive',
      travelDateFrom: '2026-01-01',
      travelDateTo: '2026-12-31',
      rules: [{ starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' }],
    }),
  ],

  // ---- Transportation -------------------------------------------------
  [key('transportation', 'Hemingways Transfers')]: [
    policy({
      id: 'cp-hem-transfers',
      name: 'Peak season cancellation policy',
      description: '',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 3, endDay: 1, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 0, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('transportation', 'Cheli & Peacock Safaris Nairobi')]: [
    policy({
      id: 'cp-cp-nbo-transfers',
      name: 'Non-Refundable Transfer Rate',
      description: 'Pre-paid transfer product — non-refundable once booked.',
      refundable: false,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
    }),
  ],
  [key('transportation', 'Bushtops Transfers')]: [
    policy({
      id: 'cp-bushtops-standard',
      name: 'Standard Transfer Policy',
      description: 'Applies year-round outside the group-transfer surge window.',
      refundable: true,
      travelDateFrom: '2026-01-01',
      travelDateTo: '2026-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 7, endDay: 2, penaltyValue: 30, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 1, endDay: 0, penaltyValue: 75, penaltyType: 'Percent' },
      ],
    }),
    policy({
      id: 'cp-bushtops-surge',
      name: 'Group Transfer Surge Policy',
      description: 'Stricter terms during the Aug–Sep group-movement surge window.',
      refundable: true,
      travelDateFrom: '2026-08-01',
      travelDateTo: '2026-09-30',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 4, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 3, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('transportation', 'Mara Route Vehicles')]: [
    // Single band that stops at day 7 — nothing covers day 6 down to 0 (AC5 gap).
    policy({
      id: 'cp-mara-route',
      name: 'Vehicle Hire Cancellation Policy',
      description: 'Mara Route Vehicles hire-vehicle cancellation terms.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [{ starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 7, penaltyValue: 50, penaltyType: 'Percent' }],
    }),
  ],

  // ---- Flight -----------------------------------------------------------
  [key('flight', 'Coastal Aviation')]: [
    // Real BRD example: Coastal Aviation — Scheduled Flights (Y Class).
    policy({
      id: 'cp-coastal-scheduled',
      name: 'Scheduled Flights (Y Class) Cancellation Policy',
      description:
        'Free of charge from confirmation up to 48 hours prior to departure; 100% charge inside 48 hours.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 9999, endDay: 3, penaltyValue: 0, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 2, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('flight', 'Coastal Aviation Charter')]: [
    // Real BRD example: Coastal Aviation — Charter Flights. This is the exact
    // Scheduled-vs-Charter gap the real gap-analysis work flagged: the BRD text
    // only defines a band from 2 weeks to 48 hours prior — nothing covers the
    // final 48 hours down to departure, so this resolves as incomplete (AC5).
    policy({
      id: 'cp-coastal-charter',
      name: 'Charter Flights Cancellation Policy',
      description: '100% cancellation charge for cancellations made between 2 weeks and 48 hours prior to departure.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [{ starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 2, penaltyValue: 100, penaltyType: 'Percent' }],
    }),
  ],
  [key('flight', 'AirKenya')]: [
    policy({
      id: 'cp-airkenya-scheduled',
      name: 'Non-Refundable Scheduled Fare',
      description: 'Lowest scheduled-service fare class — non-refundable.',
      refundable: false,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
    }),
  ],
  [key('flight', 'Safarilink')]: [
    policy({
      id: 'cp-safarilink-standard',
      name: 'Standard Charter Policy',
      description: 'Applies year-round outside the Green Season charter promotion window.',
      refundable: true,
      travelDateFrom: '2026-01-01',
      travelDateTo: '2026-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 8, penaltyValue: 50, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 7, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
    policy({
      id: 'cp-safarilink-green-promo',
      name: 'Green Season Charter Promo Policy',
      description: 'Discounted Green Season charter promo — stricter, single-band terms.',
      refundable: true,
      travelDateFrom: '2026-04-01',
      travelDateTo: '2026-05-31',
      rules: [{ starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' }],
    }),
  ],

  // ---- Activity -----------------------------------------------------------
  [key('activity', "Governors' Balloon Safaris")]: [
    policy({
      id: 'cp-gov-balloon',
      name: 'Standard Activity Policy',
      description: "Governors' Balloon Safaris standard cancellation terms.",
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 15, penaltyValue: 30, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 0, penaltyValue: 75, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('activity', 'Cheli and Peacock Safaris Kenya')]: [
    policy({
      id: 'cp-cp-kenya-activity',
      name: 'Non-Refundable Entrance Fee',
      description: '',
      refundable: false,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
    }),
  ],
  [key('activity', 'Mara Walking Safaris')]: [
    policy({
      id: 'cp-mara-walk-standard',
      name: 'Standard Activity Policy',
      description: 'Applies year-round outside the peak wildlife-viewing season.',
      refundable: true,
      travelDateFrom: '2026-01-01',
      travelDateTo: '2026-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 7, endDay: 2, penaltyValue: 25, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 1, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
    policy({
      id: 'cp-mara-walk-peak',
      name: 'Peak Wildlife Season Policy',
      description: 'Stricter single-band terms during peak wildlife-viewing season (Jul–Oct).',
      refundable: true,
      travelDateFrom: '2026-07-01',
      travelDateTo: '2026-10-31',
      rules: [{ starts: 'Before', referenceEvent: 'Travel Date', startDay: 14, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' }],
    }),
  ],

  // ---- Other --------------------------------------------------------------
  [key('other', 'KE AMREF Flying Doctors')]: [
    policy({
      id: 'cp-amref',
      name: 'Membership Cancellation Policy',
      description: 'AMREF Flying Doctors membership cancellation terms.',
      refundable: true,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
      rules: [
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 60, endDay: 31, penaltyValue: 25, penaltyType: 'Percent' },
        { starts: 'Before', referenceEvent: 'Travel Date', startDay: 30, endDay: 0, penaltyValue: 100, penaltyType: 'Percent' },
      ],
    }),
  ],
  [key('other', 'Umbato Meet and Assist Services')]: [
    policy({
      id: 'cp-umbato',
      name: 'Non-Refundable Meet & Assist Fee',
      description: 'Pre-paid airport meet & assist service — non-refundable.',
      refundable: false,
      travelDateFrom: '2025-01-01',
      travelDateTo: '2027-12-31',
    }),
  ],
}

export function policiesFor(tab: ServiceTab, supplier: string): CancellationPolicy[] {
  if (!supplier) return []
  return CANCELLATION_POLICIES[key(tab, supplier)] ?? []
}

function rangesIntersect(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  if (!aFrom || !aTo || !bFrom || !bTo) return false
  return aFrom <= bTo && aTo >= bFrom
}

/** AC2 completeness check: rules populated, TRAVEL·BEFORE bands contiguous down to endDay = 0. */
export function isPolicyComplete(policy: CancellationPolicy): boolean {
  if (!policy.refundable) return false
  if (policy.rules.length === 0) return false
  const travelRules = policy.rules
    .filter((r) => r.referenceEvent === 'Travel Date' && r.starts === 'Before')
    .slice()
    .sort((a, b) => b.startDay - a.startDay)
  if (travelRules.length === 0) return false
  const last = travelRules[travelRules.length - 1]
  if (last.endDay !== 0) return false
  for (let i = 0; i < travelRules.length - 1; i++) {
    if (travelRules[i].endDay - 1 !== travelRules[i + 1].startDay) return false
  }
  return true
}

/** AC1–AC6: resolves against a supplier's Active policies intersecting the travel window. */
export function resolveCancellationPolicy(params: {
  tab: ServiceTab
  supplier: string
  travelFrom: string
  travelTo: string
}): CancellationOutcome {
  const { tab, supplier, travelFrom, travelTo } = params
  if (!supplier) return { kind: 'none' }
  const candidates = policiesFor(tab, supplier).filter(
    (p) => p.status === 'Active' && rangesIntersect(p.travelDateFrom, p.travelDateTo, travelFrom, travelTo),
  )
  if (candidates.length === 0) return { kind: 'none' }
  if (candidates.length > 1) return { kind: 'overlap', candidates }
  const matched = candidates[0]
  if (!matched.refundable) return { kind: 'non-refundable', policy: matched }
  if (isPolicyComplete(matched)) return { kind: 'complete', policy: matched }
  return { kind: 'incomplete', policy: matched }
}

/** AC2: penalty bands sorted furthest-from-arrival first; Booking-anchored rules lead. */
export function sortedRulesForDisplay(rules: CancellationRule[]): CancellationRule[] {
  const booking = rules.filter((r) => r.referenceEvent === 'Booking Date').sort((a, b) => a.startDay - b.startDay)
  const travel = rules.filter((r) => r.referenceEvent === 'Travel Date').sort((a, b) => b.startDay - a.startDay)
  return [...booking, ...travel]
}

/**
 * AC9 render copy. The brief only specifies copy for DRAFT itineraries (no
 * booking date yet); for any other itinerary status this renders a neutral,
 * literal statement instead of inventing an unspecified copy pattern —
 * flagged for sign-off in the session report.
 */
export function cancellationRuleCopy(rule: CancellationRule, isDraftItinerary: boolean): string {
  const amount = rule.penaltyType === 'Percent' ? `${rule.penaltyValue}%` : formatUsd(rule.penaltyValue)
  if (!isDraftItinerary) {
    const noun = rule.penaltyType === 'Percent' ? 'cancellation charge' : 'cancellation fee'
    return `${rule.starts} ${rule.referenceEvent} · day ${rule.startDay}–${rule.endDay}: ${amount} ${noun}`
  }
  if (rule.referenceEvent === 'Booking Date' && rule.starts === 'After') {
    if (rule.startDay === 0) return `Upon confirmation, ${amount} non-refundable deposit`
    return `Cancelled more than ${rule.startDay} days after booking, ${amount} cancellation fee.`
  }
  if (rule.referenceEvent === 'Travel Date' && rule.starts === 'Before') {
    if (rule.endDay > 0) return `Cancelled ${rule.startDay} days before arrival, ${amount} cancellation fee.`
    return `Cancelled/reduced within ${rule.startDay} days of arrival, ${amount} cancellation fee.`
  }
  return `${rule.starts} ${rule.referenceEvent} · day ${rule.startDay}–${rule.endDay}: ${amount}`
}

/** Per-tab travel window used to resolve a policy — mirrors each panel's own date fields. */
export function cancellationTravelWindow(
  tab: ServiceTab,
  draft: Record<string, unknown>,
): { from: string; to: string } {
  if (tab === 'accommodation') {
    const rooms = Array.isArray(draft.rooms) ? draft.rooms : []
    const starts = rooms
      .map((r) => String((r as { start?: string }).start || draft.start || '').trim())
      .filter(Boolean)
      .sort()
    const ends = rooms
      .map((r) => String((r as { end?: string }).end || draft.end || '').trim())
      .filter(Boolean)
      .sort()
    return {
      from: starts[0] || String(draft.start || ''),
      to: ends[ends.length - 1] || String(draft.end || ''),
    }
  }
  if (tab === 'transportation') {
    if (draft.transMode === 'hire') {
      const from = String(draft.hireStart || '')
      return { from, to: String(draft.hireEnd || from) }
    }
    const from = String(draft.transDate || '')
    return { from, to: from }
  }
  if (tab === 'flight') {
    const flights = Array.isArray(draft.flights) ? draft.flights : []
    const from =
      String((flights[0] as { departDate?: string } | undefined)?.departDate || '') ||
      String(draft.departDate || '')
    return { from, to: from }
  }
  const from = String(draft.startDate || '')
  return { from, to: String(draft.endDate || from) }
}
