import { resolveInvoiceAddresseeProfile } from '@/features/invoice-doc/invoiceAddresseeModel'
import { resolveServiceOption } from '@/features/builder/serviceOptions'
import {
  cancellationRuleCopy,
  policiesFor,
  sortedRulesForDisplay,
  type CancellationPolicy,
} from '@/features/builder/cancellationPolicy'
import {
  buildPriceGroups,
  depositRuleFor,
  type SummaryLine,
  type SummaryPriceGroup,
  SUMMARY_TYPE_META,
} from '@/features/summary/summaryModel'
import type {
  AddedService,
  Guest,
  GuestDetail,
  Itinerary,
  PaxPriceSplit,
  ServiceTab,
} from '@/shared/lib/types'
import { guestRoleLabel } from '@/shared/lib/helpers'

export type LedgerScheduleRow = {
  date: string
  supplier: string
  service: string
  pax: string
  qty: string
  /** BR-Q12/BR-I06 (OD-27/OD-18): nights/days/units the line spans — distinct from `qty`,
   *  which is unit count (rooms, vehicles, items). */
  duration: string
  amount: number
  /** BR-Q12/BR-I06: rate per unit — `amount` stays the line total so nothing downstream
   *  that already consumes `amount` (subtotals, category grids) needs to change. */
  unitPrice: number
}

export type LedgerScheduleGroup = {
  name: string
  subtotal: number
  rows: LedgerScheduleRow[]
}

export type LedgerOptionRow = {
  supplier: string
  option: string
  includes: string
  excludes: string
}

export type LedgerPaymentTermRow = {
  supplier: string
  term: string
  travelDates: string
  deposit: string
  balanceDue: string
  taxCode: string
}

export type LedgerCancellationRow = {
  supplier: string
  /** Policy description from the cancellation API (PCP-519 `Policy.description`). */
  description: string
  /** Policy name (PCP-519 `Policy.name`). */
  policy: string
  refundableLabel: string
  refundableTone: 'blue' | 'red'
  travelDates: string
  /** Penalty rule copy for document display (matches builder Policy tab). */
  ruleLines: string[]
  charges: { label: string; amount: string }[]
}

export const GENERAL_LEDGER_INCLUSIONS = [
  'Quotations are NET and non commissionable.',
  'Bed and breakfast at city hotels where listed',
  'Full board accommodation at safari properties',
  'House drinks at fully inclusive camps',
  'Twice-daily game activities with a guide',
  'Park, reserve and conservancy fees',
  'Laundry at safari camps and lodges',
  'Internal light-aircraft flights as listed',
  'Private road transfers with driver',
  'Bottled water throughout',
  'AMREF Flying Doctors’ cover',
]

export const GENERAL_LEDGER_EXCLUSIONS = [
  'International flights and visa fees',
  'Travel and health insurance',
  'Champagne, premium wines and spirits',
  'Spa treatments and salon services',
  'Balloon safaris unless listed',
  'Items of a personal nature',
  'All statutory increases beyond our control',
  'Staff gratuities',
  'Anything not mentioned in the inclusions',
]

function sellOf(l: SummaryLine) {
  return l.rack - (l.discount?.sellDelta || 0)
}

export function fmtLedgerAmount(n: number) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function fmtLedgerUsd(n: number) {
  return `$${fmtLedgerAmount(n)}`
}

export function fmtLedgerDateShort(iso: string) {
  if (!iso) return '—'
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

export function fmtLedgerDateLong(iso: string) {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function isoAddDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() + days)
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

function ledgerPax(l: SummaryLine): string {
  const parts: string[] = []
  if (l.ad) parts.push(`${l.ad} Ad`)
  if (l.ch) parts.push(`${l.ch} Ch`)
  if (parts.length) return parts.join(' ')
  if (l.pax != null) return `${l.pax} pax`
  return '—'
}

function ledgerQty(l: SummaryLine): string {
  if (l.type === 'accommodation') return String(l.nights || l.rooms || 1)
  if (l.type === 'transportation') {
    return l.kind === 'disposal' ? String(l.days || 1) : String(l.veh || 1)
  }
  if (l.qty) return String(l.qty).replace(/\D/g, '') || '1'
  return '1'
}

/** BR-Q12/BR-I06 (OD-27/OD-18) — the number of nights/days/units a line spans, as its own
 *  column separate from Qty. Kept intentionally simple: single-instance services (transfers,
 *  flights, most activities) show '1' rather than inventing a duration concept that doesn't
 *  exist in the underlying itinerary data. */
function ledgerDuration(l: SummaryLine): string {
  if (l.type === 'accommodation') return String(l.nights || 1)
  if (l.type === 'transportation' && l.kind === 'disposal') return String(l.days || 1)
  if (l.days) return String(l.days)
  return '1'
}

/** BR-Q12/BR-I06 — rate per unit. Qty here is the same unit-count basis as `ledgerQty` for
 *  transport/other lines, but for accommodation and disposal transport we divide by the
 *  duration (nights/days) instead, since Qty for those is nights, not a separate unit count. */
function ledgerUnitPrice(l: SummaryLine, amount: number): number {
  const divisor =
    l.type === 'accommodation'
      ? l.nights || 1
      : l.type === 'transportation' && l.kind === 'disposal'
        ? l.days || 1
        : Number.parseInt(ledgerQty(l), 10) || 1
  return Math.round((amount / divisor) * 100) / 100
}

export function ledgerService(l: SummaryLine): string {
  switch (l.type) {
    case 'accommodation': {
      const basis = l.basis ? `${l.basis} ` : ''
      return `${basis}${l.roomType || 'Room'}`.trim()
    }
    case 'flight': {
      const route = l.route || l.supplier
      const time =
        l.depart && l.arrive ? ` · ${l.depart} – ${l.arrive}` : l.charter ? ` · ${l.charter}` : ''
      return `${route}${time}`
    }
    case 'transportation':
      return l.kind === 'disposal'
        ? `${l.vType || 'Vehicle'} at disposal${l.location ? `, ${l.location}` : ''}`
        : `${l.pickup || 'Pickup'} → ${l.dropoff || 'Drop-off'}`
    default:
      return l.service || l.supplier
  }
}

export function buildLedgerScheduleGroups(lines: SummaryLine[]): LedgerScheduleGroup[] {
  const groups = buildPriceGroups(lines)
  return groups.map((group) => ({
    name: group.name,
    subtotal: group.lines.reduce((sum, l) => sum + sellOf(l), 0),
    rows: [...group.lines]
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      .map((l) => {
        const amount = sellOf(l)
        return {
          date: fmtLedgerDateShort(l.date),
          supplier: l.supplier,
          service: ledgerService(l),
          pax: ledgerPax(l),
          qty: ledgerQty(l),
          duration: ledgerDuration(l),
          unitPrice: ledgerUnitPrice(l, amount),
          amount,
        }
      }),
  }))
}

export function paxComposition(adults: number, children: number, infants: number) {
  const parts = [
    adults ? `${adults} Ad` : '',
    children ? `${children} Ch` : '',
    infants ? `${infants} In` : '',
  ].filter(Boolean)
  return parts.join(' · ') || '—'
}

export type GuestDetailRow = {
  key: string
  name: string
  ageBand: GuestDetail['ageBand']
  age?: number
  lead?: boolean
}

export function guestDetailLines(guests: Guest[], details: GuestDetail[]): GuestDetailRow[] {
  if (details.length) {
    return details.map((g, index) => {
      const name = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
      const displayName = name || (g.lead ? 'Lead guest' : guestRoleLabel(g.ageBand))
      return {
        key: g.id || `detail-${index}`,
        name: displayName,
        ageBand: g.ageBand,
        age: g.age,
        lead: g.lead,
      }
    })
  }
  return guests.map((g, index) => {
    const ageBand = g.type === 'youth' ? 'child' : g.type
    return {
      key: String(g.id ?? index),
      name: g.name,
      ageBand,
      age: ageBand === 'child' ? g.age : undefined,
      lead: g.lead,
    }
  })
}

function tabOf(type: SummaryLine['type']): ServiceTab {
  if (type === 'transportation') return 'transportation'
  if (type === 'extra') return 'activity'
  return type as ServiceTab
}

function optionKey(line: SummaryLine) {
  if (line.type === 'accommodation') return `${line.supplier}::${line.roomType || line.basis || 'Room'}`
  if (line.type === 'flight') return `${line.supplier}::${line.charter || line.route || 'Flight'}`
  if (line.type === 'transportation') return `${line.supplier}::${line.vType || line.kind || 'Transfer'}`
  return `${line.supplier}::${line.service || 'Service'}`
}

function fallbackIncludes(line: SummaryLine): string {
  if (line.type === 'accommodation') {
    return [line.basis ? `${line.basis} basis` : null, 'taxes and statutory levies where applicable']
      .filter(Boolean)
      .join(' · ')
  }
  if (line.type === 'flight') return 'One seat per sector · baggage allowance as per carrier'
  if (line.type === 'transportation') return 'Vehicle with driver · fuel and tolls'
  return 'As described in the schedule of services'
}

function fallbackExcludes(line: SummaryLine): string {
  if (line.type === 'accommodation') return 'Meals not listed · drinks · spa · gratuities'
  if (line.type === 'flight') return 'Excess baggage · changes within 24 hours'
  return 'Items of a personal nature · gratuities'
}

export function buildLedgerOptionRows(
  lines: SummaryLine[],
  services: AddedService[],
): LedgerOptionRow[] {
  const byKey = new Map<string, SummaryLine>()
  for (const line of lines) {
    const key = optionKey(line)
    if (!byKey.has(key)) byKey.set(key, line)
  }

  const serviceById = new Map(services.map((s) => [s.id, s]))

  return [...byKey.values()].slice(0, 8).map((line) => {
    const svc = serviceById.get(line.serviceId)
    const draft = (svc?.draft || {}) as Record<string, unknown>
    const optionId =
      String(draft.basis || draft.roomType || draft.vehicleType || draft.activityType || draft.otherType || draft.flightOption || '') ||
      line.basis ||
      line.roomType ||
      ''
    const resolved = line.serviceId && optionId ? resolveServiceOption(line.serviceId, optionId) : null
    const optionLabel =
      resolved?.label ||
      line.roomType ||
      line.basis ||
      line.vType ||
      line.service ||
      'Standard'
    return {
      supplier: line.supplier,
      option: optionLabel,
      includes: resolved?.included || fallbackIncludes(line),
      excludes: resolved?.excluded || fallbackExcludes(line),
    }
  })
}

function fmtTravelWindow(from: string, to: string) {
  if (!from && !to) return 'All travel dates'
  if (from && to) return `${fmtLedgerDateShort(from).replace(/\//g, ' ')} – ${fmtLedgerDateLong(to).replace(/^\d+\s/, '')}`
  return from ? `${fmtLedgerDateLong(from)} onwards` : 'All travel dates'
}

export function buildLedgerPaymentTerms(lines: SummaryLine[]): {
  rows: LedgerPaymentTermRow[]
  appliedDeposit: string
  appliedBalance: string
} {
  const seen = new Set<string>()
  const rows: LedgerPaymentTermRow[] = []

  for (const line of lines) {
    const key = line.supplier
    if (seen.has(key)) continue
    seen.add(key)
    const rule = depositRuleFor(line.supplier)
    rows.push({
      supplier: line.supplier,
      term: rule.label.includes('·') ? rule.label.split('·')[0].trim() : 'General',
      travelDates: 'All travel dates',
      deposit: `${rule.pct}%`,
      balanceDue: rule.days ? `${rule.days} days before` : 'On confirmation',
      taxCode: line.type === 'accommodation' ? 'Standard' : '—',
    })
  }

  const strictest = rows.reduce(
    (best, row) => {
      const pct = Number.parseInt(row.deposit, 10) || 0
      const days = row.balanceDue.includes('days') ? Number.parseInt(row.balanceDue, 10) || 0 : 999
      if (pct > best.pct || (pct === best.pct && days > best.days)) {
        return { pct, days, balance: row.balanceDue, deposit: row.deposit }
      }
      return best
    },
    { pct: 0, days: 0, balance: '60 days before', deposit: '35%' },
  )

  return {
    rows: rows.slice(0, 6),
    appliedDeposit: strictest.deposit,
    appliedBalance: strictest.balance,
  }
}

function policyDisplayName(policy: CancellationPolicy) {
  return policy.name
}

function policyCharges(policy: CancellationPolicy): { label: string; amount: string }[] {
  return sortedRulesForDisplay(policy.rules).slice(0, 4).map((rule) => {
    const amount = rule.penaltyType === 'Percent' ? `${rule.penaltyValue}%` : fmtLedgerUsd(rule.penaltyValue)
    if (rule.referenceEvent === 'Travel Date' && rule.starts === 'Before') {
      if (rule.endDay === 0) {
        return { label: `${rule.startDay} days to day of travel`, amount }
      }
      return { label: `${rule.startDay} to ${rule.endDay} days before travel`, amount }
    }
    if (rule.referenceEvent === 'Booking Date') {
      return { label: 'Any time after booking', amount }
    }
    return { label: `${rule.starts} ${rule.referenceEvent}`, amount }
  })
}

export function buildLedgerCancellationRows(
  lines: SummaryLine[],
  travelFrom: string,
  travelTo: string,
): LedgerCancellationRow[] {
  const seen = new Set<string>()
  const rows: LedgerCancellationRow[] = []

  for (const line of lines) {
    const key = `${tabOf(line.type)}::${line.supplier}`
    if (seen.has(key)) continue
    seen.add(key)
    const policies = policiesFor(tabOf(line.type), line.supplier).filter((p) => p.status === 'Active')
    const policy = policies[0]
    if (!policy) continue
    const description = policy.description.trim()
    rows.push({
      supplier: line.supplier,
      description,
      policy: policyDisplayName(policy),
      refundableLabel: policy.refundable ? 'Refundable' : 'Non-refundable',
      refundableTone: policy.refundable ? 'blue' : 'red',
      travelDates: fmtTravelWindow(policy.travelDateFrom || travelFrom, policy.travelDateTo || travelTo),
      ruleLines: sortedRulesForDisplay(policy.rules).map((rule) => cancellationRuleCopy(rule, false)),
      charges: policyCharges(policy),
    })
  }

  return rows.slice(0, 6)
}

export function itineraryTitle(it: Pick<Itinerary, 'destinations' | 'destination' | 'title'>) {
  if (it.title?.trim()) return it.title.trim()
  if (it.destinations?.length) return it.destinations.join(' & ')
  return it.destination || 'Safari quotation'
}

/** Cover headline on quote/invoice PDFs — always the planner-set itinerary title when present. */
export function documentCoverTitle(it: Pick<Itinerary, 'destinations' | 'destination' | 'title'>) {
  return itineraryTitle(it)
}

/** BR-Q29/OD-24 (RU-17): 30 calendar days from generation is the settled fallback when no live
 *  supplier hold exists. Hold-based "earliest live hold release" expiry is not modelled anywhere
 *  else in this prototype (no hold-tracking store keyed by expiry date), so it is out of scope
 *  here — this fixes the fallback only, per the brief's guidance not to invent that
 *  infrastructure. */
export function quoteValidUntil(iso: string, days = 30) {
  return fmtLedgerDateLong(isoAddDays(iso, days))
}

export function balanceDueDate(travelFrom: string, daysBefore = 60) {
  if (!travelFrom) return '60 days before arrival'
  return fmtLedgerDateLong(isoAddDays(travelFrom, -daysBefore))
}

export function categoryGridFromGroups(groups: SummaryPriceGroup[]) {
  return groups.map((g) => ({
    name: g.name,
    amount: g.lines.reduce((sum, l) => sum + sellOf(l), 0),
  }))
}

/** BR-Q36/BR-I58 (OD-28/OD-19) — Total Adults/Children/Adult Price/Child Price, derived from the
 *  existing per-line Adult/Child pax split (`l.ad`/`l.ch`, the same fields the Pax column already
 *  uses) rather than a new pricing calculation. Lines with no per-line Ad/Ch breakdown (e.g.
 *  qty-based extras and "other" services) have their amount allocated proportionally to the
 *  overall adult/child guest mix, since that is the best information available without inventing
 *  a per-line split that doesn't exist in the data model. */
export function paxPriceSplit(
  lines: SummaryLine[],
  totalAdults: number,
  totalChildren: number,
): PaxPriceSplit {
  let adultSell = 0
  let childSell = 0
  let unallocated = 0
  for (const l of lines) {
    const sell = sellOf(l)
    const ad = l.ad ?? 0
    const ch = l.ch ?? 0
    const mix = ad + ch
    if (mix > 0) {
      adultSell += sell * (ad / mix)
      childSell += sell * (ch / mix)
    } else {
      unallocated += sell
    }
  }
  const totalPax = totalAdults + totalChildren
  if (totalPax > 0) {
    adultSell += unallocated * (totalAdults / totalPax)
    childSell += unallocated * (totalChildren / totalPax)
  } else {
    adultSell += unallocated
  }
  return {
    totalAdults,
    totalChildren,
    totalAdultPrice: Math.round(adultSell * 100) / 100,
    totalChildPrice: Math.round(childSell * 100) / 100,
  }
}

export type BookedByContact = {
  name: string
  email: string
  phone: string
}

const PLANNER_CONTACTS: Record<string, { email: string; phone: string }> = {
  'Mary Gikonyo': { email: 'mary.gikonyo@chelipeacock.com', phone: '00254730746318' },
  'Amelia Earhart': { email: 'amelia.earhart@chelipeacock.com', phone: '00254730721000' },
  'Noah Kiptoo': { email: 'noah.kiptoo@chelipeacock.com', phone: '00254730721001' },
}

export function bookedByContact(
  itinerary: Pick<Itinerary, 'safariPlanner' | 'safariPlannerEmail' | 'safariPlannerPhone'>,
): BookedByContact {
  const name = itinerary.safariPlanner?.trim() || '—'
  const catalog = name !== '—' ? PLANNER_CONTACTS[name] : undefined
  const derivedEmail =
    name !== '—' ? `${name.replace(/\s+/g, '.').toLowerCase()}@chelipeacock.com` : '—'
  return {
    name,
    email: itinerary.safariPlannerEmail || catalog?.email || derivedEmail,
    phone: itinerary.safariPlannerPhone || catalog?.phone || '—',
  }
}

export type BookingAgentBlock = {
  name: string
  addressLines: string[]
}

/** Demo agency office profiles — printed under the booking agent name on quote covers. */
const AGENCY_PROFILES: Record<string, string[]> = {
  'Black Tomato': [
    'International Ventures',
    '+12037611110',
    'Suite 2',
    '65 Old Ridgefield Road',
    'Wilton CT 06897',
    'United States of America',
  ],
  'Zoo Groups': [
    'Zoo Groups Ltd',
    '+254 712 000 000',
    '14 Wildlife Lane',
    'Nairobi',
    'Kenya',
  ],
  CPS: [
    'Cheli & Peacock Safaris',
    '+254 730 721 000',
    'Fedha Towers, Muindi Mbingu Street',
    'Nairobi',
    'Kenya',
  ],
}

export function parseAgencyAddress(raw: string): string[] {
  if (raw.includes('\n')) {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  }
  return raw
    .split(',')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function bookingAgentBlock(
  itinerary: Pick<Itinerary, 'agency' | 'agent' | 'agencyAddress'>,
): BookingAgentBlock {
  const name = itinerary.agent?.trim() || itinerary.agency?.trim() || '—'
  const agency = itinerary.agency?.trim() || ''
  const profile = agency ? AGENCY_PROFILES[agency] : undefined
  if (profile?.length) {
    return { name, addressLines: profile }
  }
  const raw = itinerary.agencyAddress?.trim()
  if (raw) {
    return { name, addressLines: parseAgencyAddress(raw) }
  }
  return { name, addressLines: [] }
}

export type AgentInvoiceProfile = {
  legalName: string
  addressLines: string[]
}

export function invoiceRecipientProfile(
  itinerary: Pick<
    Itinerary,
    | 'agency'
    | 'agent'
    | 'agencyAddress'
    | 'invoiceAddresseeType'
    | 'invoiceAddresseeGuestId'
    | 'clientBillingAddress'
    | 'clientBillingEmail'
    | 'clientBillingPhone'
  >,
  travelCounsellors = false,
  guests: GuestDetail[] = [],
): AgentInvoiceProfile {
  const profile = resolveInvoiceAddresseeProfile({ itinerary, guests, travelCounsellors })
  return { legalName: profile.legalName, addressLines: profile.addressLines }
}

export { SUMMARY_TYPE_META, buildPriceGroups }
