import { getPayableEntity, payableEntityFromSupplierName } from './payableEntities'
import type {
  AddedService,
  DemoRole,
  Itinerary,
  ItineraryStatus,
  LineStatus,
  PayableEntity,
  SupplierStatus,
  SupplierVoucherStatus,
  VoucherLineAnswer,
  VoucherLineOutcome,
  VoucherMeta,
} from './types'

export type GateResult = { ok: true } | { ok: false; ruleId: string; reason: string }

const PAID_STATUSES = new Set([
  'DEPOSIT_PAID',
  'PARTIALLY_PAID',
  'FULLY_PAID',
  'OVERPAID',
])

const FORWARD: ItineraryStatus[] = [
  'DRAFT',
  'PREPARED',
  'QUOTED',
  'APPROVED',
  'INVOICED',
  'VOUCHERED',
  'CONFIRMED',
  'TRAVEL_IN_PROGRESS',
  'COMPLETED',
]

export const DEMO_ROLES: { id: DemoRole; label: string }[] = [
  { id: 'Safari.Planner', label: 'Safari Planner' },
  { id: 'Sales.Manager', label: 'Sales Manager' },
  { id: 'Operations', label: 'Operations' },
  { id: 'Finance', label: 'Finance' },
  { id: 'Admin', label: 'Admin' },
]

export function lineStatusOf(service: AddedService): LineStatus {
  return service.lineStatus ?? 'New'
}

export function isBillable(service: AddedService): boolean {
  return lineStatusOf(service) !== 'Cancelled'
}

export function billableServices(services: AddedService[]): AddedService[] {
  return services.filter(isBillable)
}

export function serviceCommercialFp(service: AddedService): string {
  const draft = service.draft || {}
  return [
    service.id,
    service.tab,
    String(service.net ?? ''),
    String(service.rack ?? ''),
    service.title,
    String(draft.supplier ?? ''),
    String(draft.service ?? ''),
    String(draft.start ?? draft.startDate ?? ''),
    String(draft.end ?? draft.endDate ?? ''),
  ].join(':')
}

export function itineraryCommercialFp(services: AddedService[]): string {
  return billableServices(services)
    .map(serviceCommercialFp)
    .sort()
    .join('|')
}

export function supplierStatusOf(service: AddedService): SupplierStatus {
  if (lineStatusOf(service) !== 'Confirmed') return 'None'
  return service.supplierStatus ?? 'NeedsRequest'
}

export function isEngaged(service: AddedService): boolean {
  const status = supplierStatusOf(service)
  return status === 'Waiting' || status === 'Booked' || status === 'Rejected'
}

export function isLineUpdated(service: AddedService): boolean {
  return (
    lineStatusOf(service) === 'Confirmed' &&
    !!service.confirmedFp &&
    service.confirmedFp !== serviceCommercialFp(service)
  )
}

export function supplierNameOf(service: AddedService): string {
  const draft = service.draft || {}
  return String(draft.supplier || draft.service || service.title || 'Supplier')
}

/** Payable legal entity for voucher grouping (PR-F02). */
export function payableEntityOf(service: AddedService): PayableEntity {
  const draft = service.draft || {}
  const id = String(draft.payableEntityId || '')
  if (id) return getPayableEntity(id)
  return payableEntityFromSupplierName(supplierNameOf(service))
}

export function payableEntityIdOf(service: AddedService): string {
  return payableEntityOf(service).id
}

export function hasUnresolvedRejection(services: AddedService[]): boolean {
  return billableServices(services).some((s) => supplierStatusOf(s) === 'Rejected')
}

export function hasExpiredReliedHold(services: AddedService[]): boolean {
  return billableServices(services).some((service) => {
    const holds = Array.isArray(service.draft?.holds) ? service.draft.holds : []
    return (holds as { status?: string }[]).some((h) => h.status === 'Expired')
  })
}

export function isPaymentSatisfied(itinerary: Itinerary): boolean {
  return !!itinerary.creditTerms || PAID_STATUSES.has(itinerary.paymentStatus)
}

export function isForwardTransition(from: ItineraryStatus, to: ItineraryStatus): boolean {
  const a = FORWARD.indexOf(from)
  const b = FORWARD.indexOf(to)
  return a >= 0 && b >= 0 && b > a
}

function fail(ruleId: string, reason: string): GateResult {
  return { ok: false, ruleId, reason }
}

export function roleAllowsTransition(
  role: DemoRole,
  from: ItineraryStatus,
  to: ItineraryStatus,
): boolean {
  if (role === 'Admin') return true

  const pair = `${from}->${to}`
  const planner = new Set([
    'DRAFT->PREPARED',
    'PREPARED->QUOTED',
    'PREPARED->DRAFT',
    'QUOTED->DRAFT',
    'APPROVED->DRAFT',
    'LOST->DRAFT',
    'CANCELLED->DRAFT',
    'SUPERSEDED->DRAFT',
  ])
  const sales = new Set([
    'QUOTED->APPROVED',
    'QUOTED->LOST',
    'QUOTED->SUPERSEDED',
    'QUOTED->DRAFT',
  ])
  const finance = new Set(['APPROVED->INVOICED', 'APPROVED->DRAFT', 'INVOICED->LOST'])
  const ops = new Set([
    'INVOICED->VOUCHERED',
    'VOUCHERED->CONFIRMED',
    'VOUCHERED->LOST',
    'CONFIRMED->CANCELLED',
    'TRAVEL_IN_PROGRESS->CANCELLED',
  ])

  if (role === 'Safari.Planner') return planner.has(pair)
  if (role === 'Sales.Manager') return sales.has(pair)
  if (role === 'Finance') return finance.has(pair)
  if (role === 'Operations') return ops.has(pair)
  return false
}

export function roleAllowsLineAction(
  role: DemoRole,
  action: 'confirm' | 'reset' | 'cancel' | 'remove' | 'opsReady',
): boolean {
  if (role === 'Admin') return true
  if (role === 'Safari.Planner') return action === 'confirm' || action === 'reset' || action === 'remove'
  if (role === 'Operations') return action === 'cancel' || action === 'opsReady'
  return false
}

/**
 * 'issue'/'resend' — planner sends the confirmation request (RU-01: the planner issues,
 * never an automatic side-effect). 'recordOnBehalf' — staff enter a supplier's phone/email
 * reply on their behalf (BR-38); still requires the same operational roles as issuing.
 * Submitting *through the supplier's own link* is deliberately not gated here — that page
 * is reached by token, not by demo role (RU-12: a token authorizes, it does not authenticate).
 */
export function roleAllowsVoucherAction(
  role: DemoRole,
  action: 'issue' | 'resend' | 'recordOnBehalf',
): boolean {
  if (role === 'Admin') return true
  if (role === 'Operations') return true
  if (role === 'Safari.Planner') return true
  if (role === 'Finance' && action === 'issue') return true
  return false
}

export function roleCanEditBuilder(role: DemoRole): boolean {
  return role === 'Admin' || role === 'Safari.Planner'
}

/** Quoted-and-beyond: no add/delete lines until Return to Draft / Reactivate. */
const STRUCTURE_LOCKED: ReadonlySet<ItineraryStatus> = new Set([
  'QUOTED',
  'APPROVED',
  'INVOICED',
  'VOUCHERED',
  'CONFIRMED',
  'TRAVEL_IN_PROGRESS',
  'COMPLETED',
  'LOST',
  'CANCELLED',
  'SUPERSEDED',
])

/** Invoiced-and-beyond: block manual Stay price overrides. */
const PRICING_LOCKED: ReadonlySet<ItineraryStatus> = new Set([
  'INVOICED',
  'VOUCHERED',
  'CONFIRMED',
  'TRAVEL_IN_PROGRESS',
  'COMPLETED',
  'LOST',
  'CANCELLED',
  'SUPERSEDED',
])

export function isStructureLocked(status: ItineraryStatus): boolean {
  return STRUCTURE_LOCKED.has(status)
}

export function isPricingLocked(status: ItineraryStatus): boolean {
  return PRICING_LOCKED.has(status)
}

/** Evaluate transition gates. Pass `generating: 'quote'|'invoice'` when the action stamps a fresh doc. */
export function evaluateTransition(
  itinerary: Itinerary,
  services: AddedService[],
  to: ItineraryStatus,
  opts?: { generating?: 'quote' | 'invoice'; role?: DemoRole },
): GateResult {
  const from = itinerary.status
  const role = opts?.role ?? 'Admin'

  if (!roleAllowsTransition(role, from, to)) {
    return fail('role-denied', `Role ${role} cannot move ${from} → ${to}`)
  }

  if (to === 'SUPERSEDED' && billableServices(services).some(isEngaged)) {
    return fail('supersede-engaged', 'Cannot supersede while any line is engaged with a supplier')
  }

  if (isForwardTransition(from, to) && hasUnresolvedRejection(services)) {
    return fail('unresolved-rejected', 'Resolve rejected supplier lines before advancing')
  }

  if (from === 'DRAFT' && to === 'PREPARED') {
    if (billableServices(services).length < 1) {
      return fail('need-billable', 'Add at least one billable service line before marking Prepared')
    }
  }

  if (from === 'PREPARED' && to === 'QUOTED') {
    const fp = itineraryCommercialFp(services)
    if (!itinerary.quoteFingerprint) {
      return fail(
        'quote-fingerprint',
        'Generate a quote before marking as Quoted',
      )
    }
    if (itinerary.quoteFingerprint !== fp) {
      return fail(
        'quote-fingerprint',
        'Quote is out of date — regenerate before marking as Quoted',
      )
    }
  }

  if (opts?.generating === 'invoice' && itinerary.financeLocked) {
    return fail('finance-locked', 'Invoice generation is blocked while Finance Lock is engaged')
  }

  if (from === 'APPROVED' && to === 'INVOICED') {
    const fp = itineraryCommercialFp(services)
    if (opts?.generating !== 'invoice' && itinerary.invoiceFingerprint !== fp) {
      return fail(
        'invoice-fingerprint',
        'Invoice document is missing or out of date — use Generate Invoice',
      )
    }
  }

  if (from === 'INVOICED' && to === 'VOUCHERED') {
    if (!isPaymentSatisfied(itinerary)) {
      return fail(
        'payment-or-credit',
        'Require a payment (deposit+) or credit terms before raising vouchers',
      )
    }
    if (hasExpiredReliedHold(services)) {
      return fail('expired-hold', 'An expired hold is still relied on — refresh or release before vouchering')
    }
    if (hasUnresolvedRejection(services)) {
      return fail('unresolved-rejected', 'Resolve rejected supplier lines before raising vouchers')
    }
  }

  if (from === 'VOUCHERED' && to === 'CONFIRMED') {
    const pending = billableServices(services).filter((s) => supplierStatusOf(s) !== 'Booked')
    if (pending.length > 0) {
      return fail(
        'all-booked',
        `All billable lines must be supplier-Booked (${pending.length} still open)`,
      )
    }
    if (hasUnresolvedRejection(services)) {
      return fail('unresolved-rejected', 'Resolve rejected supplier lines before confirming')
    }
  }

  return { ok: true }
}

export function normalizeServiceLifecycle(
  service: AddedService,
  itinerary: Itinerary,
): AddedService {
  let next = { ...service }
  if (!next.lineStatus) next.lineStatus = 'New'
  if (!next.supplierStatus) next.supplierStatus = 'None'

  const lateStatuses: ItineraryStatus[] = [
    'VOUCHERED',
    'CONFIRMED',
    'TRAVEL_IN_PROGRESS',
    'COMPLETED',
  ]
  const midStatuses: ItineraryStatus[] = ['INVOICED', ...lateStatuses]

  if (midStatuses.includes(itinerary.status) && next.lineStatus === 'New') {
    next = {
      ...next,
      lineStatus: 'Confirmed',
      confirmedFp: next.confirmedFp || serviceCommercialFp(next),
      supplierStatus: next.supplierStatus === 'None' ? 'NeedsRequest' : next.supplierStatus,
    }
  }

  if (lateStatuses.includes(itinerary.status) && next.lineStatus === 'Confirmed') {
    const vouchers = itinerary.supplierVouchers || {}
    const entityId = payableEntityIdOf(next)
    const supplier = supplierNameOf(next)
    const voucher = vouchers[entityId] ?? vouchers[supplier]
    if (voucher === 'Confirmed' || itinerary.status === 'CONFIRMED' || itinerary.status === 'TRAVEL_IN_PROGRESS' || itinerary.status === 'COMPLETED') {
      next = { ...next, supplierStatus: 'Booked' }
    } else if (voucher === 'Rejected') {
      next = { ...next, supplierStatus: 'Rejected' }
    } else if (next.supplierStatus === 'NeedsRequest' || next.supplierStatus === 'None') {
      next = {
        ...next,
        supplierStatus: next.tab === 'other' ? 'Booked' : 'Waiting',
      }
    }
  }

  return next
}

export function normalizeServicesLifecycle(
  services: AddedService[],
  itinerary: Itinerary,
): AddedService[] {
  return services.map((s) => normalizeServiceLifecycle(s, itinerary))
}

export function confirmLine(service: AddedService): GateResult & { service?: AddedService } {
  if (lineStatusOf(service) !== 'New') {
    return fail('line-not-new', 'Only New lines can be confirmed')
  }
  const fp = serviceCommercialFp(service)
  return {
    ok: true,
    service: {
      ...service,
      lineStatus: 'Confirmed',
      confirmedFp: fp,
      supplierStatus: 'NeedsRequest',
    },
  }
}

export function resetLine(service: AddedService): GateResult & { service?: AddedService } {
  if (lineStatusOf(service) !== 'Confirmed') {
    return fail('line-not-confirmed', 'Only Confirmed lines can be reset')
  }
  if (isEngaged(service)) {
    return fail('line-engaged', 'Reset is blocked while the supplier is engaged — Cancel instead')
  }
  return {
    ok: true,
    service: {
      ...service,
      lineStatus: 'New',
      confirmedFp: undefined,
      supplierStatus: 'None',
      opsReady: false,
    },
  }
}

export function cancelLine(service: AddedService): GateResult & { service?: AddedService } {
  if (!isEngaged(service)) {
    return fail('line-not-engaged', 'Cancel is only available when the supplier is engaged')
  }
  return {
    ok: true,
    service: {
      ...service,
      lineStatus: 'Cancelled',
      supplierStatus: 'None',
      opsReady: false,
    },
  }
}

export function canRemoveLine(service: AddedService): GateResult {
  if (isEngaged(service)) {
    return fail('line-engaged', 'Remove is blocked while anything is out with the supplier')
  }
  return { ok: true }
}

/** Auto-confirm New billables, then mark Waiting (or Booked for Other) and raise per-supplier vouchers. */
export function raiseVouchers(
  services: AddedService[],
  itinerary: Itinerary,
): { services: AddedService[]; supplierVouchers: Record<string, SupplierVoucherStatus> } {
  const vouchers: Record<string, SupplierVoucherStatus> = {
    ...(itinerary.supplierVouchers || {}),
  }

  const next = services.map((raw) => {
    let service = { ...raw }
    if (!isBillable(service)) return service

    if (lineStatusOf(service) === 'New') {
      const confirmed = confirmLine(service)
      if (confirmed.ok && confirmed.service) service = confirmed.service
    }

    if (lineStatusOf(service) !== 'Confirmed') return service

    const entityId = payableEntityIdOf(service)
    const existing = vouchers[entityId]
    if (existing !== 'Confirmed' && existing !== 'Rejected') {
      vouchers[entityId] = 'Raised'
    }

    if (service.tab === 'other') {
      return { ...service, supplierStatus: 'Booked' as const }
    }
    if (supplierStatusOf(service) === 'Booked' || supplierStatusOf(service) === 'Rejected') {
      return service
    }
    return { ...service, supplierStatus: 'Waiting' as const }
  })

  return { services: next, supplierVouchers: vouchers }
}

/** Minimal per-line projection `applyVoucherLineSubmit` needs — avoids a summaryModel import. */
export type VoucherLineInput = {
  lineId: string
  serviceId: string
  depositPaid?: boolean
  isExtra?: boolean
  parentLineId?: string
}

/**
 * Applies one atomic per-line tick submit for a supplier's voucher (BR-30/31/32). Ticked lines
 * go on hold; unticked lines are recorded rejected and left exactly where they are on the
 * itinerary — never deleted (RU-08). A line with a deposit already paid can't be rejected by a
 * submit (BR-43): the tick still "fails" toward reject, but the line is left for the planner
 * to resolve directly rather than either held or rejected. The whole-voucher roll-up is derived,
 * never chosen directly: Confirmed only when every line is held, Rejected only when every line
 * is rejected, Partial otherwise (RU-18).
 */
export function applyVoucherLineSubmit(
  services: AddedService[],
  supplierVouchers: Record<string, SupplierVoucherStatus>,
  voucherLineAnswers: Record<string, VoucherLineAnswer>,
  entityId: string,
  lines: VoucherLineInput[],
  ticks: Record<string, boolean>,
  reasons: Record<string, string>,
  at: string,
): {
  services: AddedService[]
  supplierVouchers: Record<string, SupplierVoucherStatus>
  voucherLineAnswers: Record<string, VoucherLineAnswer>
  depositGuardLineIds: string[]
} {
  const nextAnswers = { ...voucherLineAnswers }
  const depositGuardLineIds: string[] = []

  for (const line of lines) {
    let wantsHold = ticks[line.lineId] !== false
    if (line.isExtra && line.parentLineId) {
      const parentHeld = ticks[line.parentLineId] !== false
      if (wantsHold && !parentHeld) wantsHold = false
    }
    let outcome: VoucherLineOutcome
    if (!wantsHold && line.depositPaid) {
      outcome = 'deposit_held_back'
      depositGuardLineIds.push(line.lineId)
    } else {
      outcome = wantsHold ? 'held' : 'rejected'
    }
    nextAnswers[line.lineId] = {
      outcome,
      reason: outcome === 'rejected' ? reasons[line.lineId] : undefined,
      at,
    }
  }

  const outcomesByService = new Map<string, VoucherLineOutcome[]>()
  for (const line of lines) {
    const arr = outcomesByService.get(line.serviceId) || []
    arr.push(nextAnswers[line.lineId].outcome)
    outcomesByService.set(line.serviceId, arr)
  }

  const nextServices = services.map((service) => {
    if (!isBillable(service)) return service
    if (payableEntityIdOf(service) !== entityId) return service
    if (lineStatusOf(service) !== 'Confirmed') return service
    const outcomes = outcomesByService.get(service.id)
    if (!outcomes || !outcomes.length) return service
    const hasRejected = outcomes.includes('rejected')
    const allHeld = outcomes.every((o) => o === 'held')
    let supplierStatus: SupplierStatus = service.supplierStatus ?? 'Waiting'
    if (hasRejected) supplierStatus = 'Rejected'
    else if (allHeld) supplierStatus = 'Booked'
    else supplierStatus = 'Waiting' // deposit_held_back only — needs the planner, not a reject
    return { ...service, supplierStatus }
  })

  const allOutcomes = lines.map((l) => nextAnswers[l.lineId].outcome)
  const rollup: SupplierVoucherStatus = allOutcomes.every((o) => o === 'held')
    ? 'Confirmed'
    : allOutcomes.every((o) => o === 'rejected')
      ? 'Rejected'
      : 'Partial'

  return {
    services: nextServices,
    supplierVouchers: { ...supplierVouchers, [entityId]: rollup },
    voucherLineAnswers: nextAnswers,
    depositGuardLineIds,
  }
}

/** GET-safe read of what the supplier's own confirmation link would show (RU-11/RU-13/RU-14):
 *  opening it never decides anything, so this is pure evaluation, no writes. */
export type VoucherTokenState = 'ok' | 'expired' | 'used' | 'superseded' | 'invalid'

export function evaluateVoucherToken(
  meta: VoucherMeta | undefined,
  token: string | null | undefined,
  nowIso: string,
): { state: VoucherTokenState; recipientEmail?: string } {
  if (!meta || !token) return { state: 'invalid' }
  const match = meta.tokens.find((t) => t.token === token)
  if (!match) return { state: 'invalid' }
  if (match.supersededAt) return { state: 'superseded', recipientEmail: match.recipientEmail }
  if (match.usedAt) return { state: 'used', recipientEmail: match.recipientEmail }
  if (meta.submittedAt && meta.tokens.every((t) => t.usedAt || t.supersededAt)) {
    return { state: 'used', recipientEmail: match.recipientEmail }
  }
  if (match.expiresAt < nowIso) return { state: 'expired', recipientEmail: match.recipientEmail }
  return { state: 'ok', recipientEmail: match.recipientEmail }
}

export function lineStatusLabel(status: LineStatus): string {
  return status
}

export function supplierStatusLabel(status: SupplierStatus): string {
  if (status === 'NeedsRequest') return 'No hold yet'
  if (status === 'None') return '—'
  if (status === 'Waiting') return 'Awaiting supplier reply'
  if (status === 'Booked') return 'Booked with supplier'
  if (status === 'Rejected') return 'Supplier declined'
  return status
}
