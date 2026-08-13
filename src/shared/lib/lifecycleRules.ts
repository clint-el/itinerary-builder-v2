import type {
  AddedService,
  DemoRole,
  Itinerary,
  ItineraryStatus,
  LineStatus,
  SupplierStatus,
  SupplierVoucherStatus,
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

export function roleAllowsVoucherAction(
  role: DemoRole,
  action: 'confirm' | 'reject' | 'issue',
): boolean {
  if (role === 'Admin') return true
  if (role === 'Operations') return true
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
    if (opts?.generating !== 'quote' && itinerary.quoteFingerprint !== fp) {
      return fail(
        'quote-fingerprint',
        'Quote document is missing or out of date — open the quote PDF or use Generate & Send Quote',
      )
    }
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
    const supplier = supplierNameOf(next)
    const voucher = vouchers[supplier]
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

    const supplier = supplierNameOf(service)
    const existing = vouchers[supplier]
    if (existing !== 'Confirmed' && existing !== 'Rejected') {
      vouchers[supplier] = 'Raised'
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

export function setSupplierVoucherOutcome(
  services: AddedService[],
  supplierVouchers: Record<string, SupplierVoucherStatus>,
  supplier: string,
  outcome: 'Confirmed' | 'Rejected',
): { services: AddedService[]; supplierVouchers: Record<string, SupplierVoucherStatus> } {
  const nextVouchers = { ...supplierVouchers, [supplier]: outcome }
  const nextServices = services.map((service) => {
    if (!isBillable(service)) return service
    if (supplierNameOf(service) !== supplier) return service
    if (lineStatusOf(service) !== 'Confirmed') return service
    return {
      ...service,
      supplierStatus: (outcome === 'Confirmed' ? 'Booked' : 'Rejected') as SupplierStatus,
    }
  })
  return { services: nextServices, supplierVouchers: nextVouchers }
}

export function lineStatusLabel(status: LineStatus): string {
  return status
}

export function supplierStatusLabel(status: SupplierStatus): string {
  if (status === 'NeedsRequest') return 'Needs request'
  if (status === 'None') return '—'
  return status
}
