import { resolveServiceOption } from '@/features/builder/serviceOptions'
import {
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
import type { AddedService, Guest, GuestDetail, Itinerary, ServiceTab } from '@/shared/lib/types'
import { guestRoleLabel } from '@/shared/lib/helpers'

export type LedgerScheduleRow = {
  date: string
  supplier: string
  service: string
  pax: string
  qty: string
  amount: number
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
  contract: string
  policy: string
  refundableLabel: string
  refundableTone: 'blue' | 'red'
  travelDates: string
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

function ledgerService(l: SummaryLine): string {
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
      .map((l) => ({
        date: fmtLedgerDateShort(l.date),
        supplier: l.supplier,
        service: ledgerService(l),
        pax: ledgerPax(l),
        qty: ledgerQty(l),
        amount: sellOf(l),
      })),
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

export function guestRosterRows(guests: Guest[], details: GuestDetail[]) {
  if (details.length) {
    return details.map((g) => {
      const name = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
      const role = guestRoleLabel(g.ageBand)
      const suffix = g.lead ? `${role} · lead` : g.ageBand === 'child' && g.age ? `${role} · ${g.age}` : role
      return { name: name || (g.lead ? 'Lead guest' : role), suffix }
    })
  }
  return guests.map((g) => ({
    name: g.name,
    suffix: g.lead ? `${guestRoleLabel(g.type === 'youth' ? 'child' : g.type)} · lead` : guestRoleLabel(g.type === 'youth' ? 'child' : g.type),
  }))
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
    rows.push({
      supplier: line.supplier,
      contract: policy.description || `${line.supplier} contract`,
      policy: policyDisplayName(policy),
      refundableLabel: policy.refundable ? 'Refundable' : 'Non-refundable',
      refundableTone: policy.refundable ? 'blue' : 'red',
      travelDates: fmtTravelWindow(policy.travelDateFrom || travelFrom, policy.travelDateTo || travelTo),
      charges: policyCharges(policy),
    })
  }

  return rows.slice(0, 6)
}

export function itineraryTitle(it: Pick<Itinerary, 'destinations' | 'destination' | 'title'>) {
  if (it.destinations?.length) return it.destinations.join(' & ')
  return it.destination || it.title || 'Safari quotation'
}

export function quoteValidUntil(iso: string, days = 14) {
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

export { SUMMARY_TYPE_META, buildPriceGroups }
