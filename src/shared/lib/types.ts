export type ItineraryStatus =
  | 'DRAFT'
  | 'PREPARED'
  | 'QUOTED'
  | 'APPROVED'
  | 'INVOICED'
  | 'VOUCHERED'
  | 'CONFIRMED'
  | 'TRAVEL_IN_PROGRESS'
  | 'COMPLETED'
  | 'LOST'
  | 'CANCELLED'
  | 'SUPERSEDED'

export type PaymentStatus =
  | 'UNPAID'
  | 'DEPOSIT_PAID'
  | 'PARTIALLY_PAID'
  | 'FULLY_PAID'
  | 'OVERPAID'
  | 'REFUND_PENDING'

export type ServiceTab = 'accommodation' | 'transportation' | 'flight' | 'activity' | 'other'

export type LineStatus = 'New' | 'Confirmed' | 'Cancelled'

export type SupplierStatus = 'None' | 'NeedsRequest' | 'Waiting' | 'Booked' | 'Rejected'

/** 'Partial' = some lines on the voucher held, some not — not itself a confirmed/rejected outcome. */
export type SupplierVoucherStatus = 'Raised' | 'Confirmed' | 'Rejected' | 'Partial'

/** Per-service-line supplier answer. 'deposit_held_back' = the deposit guard fired: the line
 *  couldn't be rejected because a deposit is already paid against it, so it's left for the
 *  planner to resolve directly rather than counted as a reject or a hold. */
export type VoucherLineOutcome = 'held' | 'rejected' | 'deposit_held_back'

export interface VoucherLineAnswer {
  outcome: VoucherLineOutcome
  /** Required when outcome === 'rejected'. */
  reason?: string
  at: string
}

export interface PayableEntity {
  id: string
  legalName: string
  reservationEmail?: string
  headOffice?: string
}

export interface VoucherToken {
  token: string
  recipientEmail: string
  createdAt: string
  expiresAt: string
  usedAt?: string
  supersededAt?: string
  /** Version this token was issued under — for superseded page display. */
  version?: number
}

export type VoucherKind = 'standard' | 'cancellation_only'

export type VoucherDeliveryStatus = 'queued' | 'sent' | 'failed'

export interface VoucherSendRecord {
  id: string
  recipient: string
  sentAt: string
  deliveryStatus: VoucherDeliveryStatus
  token: string
  expiresAt: string
  via: 'issue' | 'resend' | 'reissue'
  from: string
  cc: string[]
  replyTo: string
  messageId?: string
}

export interface VoucherLineDecision {
  lineId: string
  outcome: VoucherLineOutcome
  reason?: string
}

export interface VoucherAnswerRecord {
  id: string
  at: string
  actorType: 'supplier-link' | 'staff' | 'acknowledge'
  actorEmail?: string
  tokenId?: string
  userAgent?: string
  ip?: string | null
  courtesyName?: string
  lineDecisions: VoucherLineDecision[]
}

export interface PlannerNotification {
  id: string
  at: string
  kind: 'all_confirmed' | 'all_rejected' | 'partial' | 'request_latest'
  entityId: string
  message: string
  read?: boolean
}

export interface VoucherChaseSchedule {
  nextAt: string
  sentCount: number
}

export interface VoucherMeta {
  issued: boolean
  issuedAt?: string
  issuedTo: string[]
  /** Stable business reference — assigned on first issue, unchanged on re-issue (PR-F10). */
  voucherRef?: string
  voucherSeq?: number
  kind?: VoucherKind
  /** Signature of served-guest dietary state at issue time. */
  requirementsSignature?: string
  /** Full commercial + line snapshot at issue (PR-F24). */
  contentSignature?: string
  tokens: VoucherToken[]
  resendCount: number
  lastResendAt?: string
  version: number
  submittedAt?: string
  submittedVia?: 'link' | 'staff' | 'acknowledge'
  submittedByEmail?: string
  submittedByName?: string
  note?: string
  supplierBookingRef?: string
  sendHistory?: VoucherSendRecord[]
  answerHistory?: VoucherAnswerRecord[]
  plannerNotifications?: PlannerNotification[]
  chaseSchedule?: VoucherChaseSchedule
  /** Issuing planner email for CC/Reply-To stubs. */
  issuingPlannerEmail?: string
}

export type MandatoryFollowUpKind = 'source_reissue' | 'source_cancellation' | 'destination_issue'

export interface MandatoryFollowUp {
  id: string
  kind: MandatoryFollowUpKind
  entityId: string
  fromItineraryId: string
  toItineraryId?: string
  lineIds: string[]
  formerSourceRef?: string
  status: 'open' | 'completed'
  createdAt: string
}

export type DemoRole =
  | 'Safari.Planner'
  | 'Sales.Manager'
  | 'Operations'
  | 'Finance'
  | 'Admin'

export interface Itinerary {
  id: string
  reference: string
  itineraryRef: string
  title: string
  agency: string
  agent: string
  safariPlanner: string
  destination: string
  destinations?: string[]
  travelDateFrom: string
  travelDateTo: string
  createdAt: string
  status: ItineraryStatus
  paymentStatus: PaymentStatus
  totalUsd: number
  balanceUsd: number
  updatedAt: string
  leadFirst?: string
  leadLast?: string
  adults?: number
  children?: number
  infants?: number
  adultsCitizen?: number
  adultsRes?: number
  adultsNonRes?: number
  childrenCitizen?: number
  childrenRes?: number
  childrenNonRes?: number
  infantsCitizen?: number
  infantsRes?: number
  infantsNonRes?: number
  childAges?: number[]
  paxAdults?: number
  paxChildren?: number
  guestsLabel?: string
  creditTerms?: boolean
  financeLocked?: boolean
  /** Commercial fingerprint covered by the latest generated quote PDF. */
  quoteFingerprint?: string
  /** Last rate basis selection on this itinerary — pre-fills the picker; planner must still confirm. */
  lastQuoteRateBasisSelection?: QuoteRateBasisSelection
  /** Commercial fingerprint covered by the latest generated invoice. */
  invoiceFingerprint?: string
  /** Stamped once on first invoice generation (IB 12.1). */
  firstInvoiceDate?: string
  /** Per payable-entity voucher outcome — keyed by PayableEntity.id (PR-F02). */
  supplierVouchers?: Record<string, SupplierVoucherStatus>
  /** Per-entity issue/token/response tracking — keyed by PayableEntity.id. */
  voucherMeta?: Record<string, VoucherMeta>
  voucherLineAnswers?: Record<string, VoucherLineAnswer>
  mandatoryFollowUps?: MandatoryFollowUp[]
  lastTransitionReason?: string
  lifecycleLog?: LifecycleLogEntry[]
}

export type LifecycleLogCategory =
  | 'status'
  | 'voucher-send'
  | 'supplier-link'
  | 'voucher-staff'
  | 'quote-generate'
  | 'invoice-generate'
  | 'invoice-update'

export type InvoiceLifecycleStage = 'deposit' | 'full'

export interface InvoicePaymentPosition {
  total: number
  paid: number
  balance: number
  amountDueImmediately: number
  futureAmountDue?: number
  futureDueDate?: string
}

export interface InvoiceRevisionEntry {
  id: string
  at: string
  actor: string
  fingerprint: string
  summary: string
}

export interface InvoiceDocument {
  id: string
  itineraryId: string
  invoiceNumber: string
  lifecycleStage: InvoiceLifecycleStage
  fingerprint: string
  generatedAt: string
  generatedBy: string
  invoiceDate: string
  coverTitle: string
  reference: string
  sellTotal: number
  lines: QuoteDocumentLine[]
  categoryTotals: { name: string; amount: number }[]
  scheduleGroups: QuoteDocument['scheduleGroups']
  pricingSummary: QuoteDocument['pricingSummary']
  optionRows: QuoteOptionRow[]
  depositTotal: number
  depositBalance: number
  depositPctOfSell: number
  paymentPosition: InvoicePaymentPosition
  revisions: InvoiceRevisionEntry[]
}

export type QuoteRateBasis = 'rack' | 'nett'

/** Planner selection at generation — `both` produces Rack + Nett snapshots in one action. */
export type QuoteRateBasisSelection = QuoteRateBasis | 'both'

export type QuotePresentation = 'B2B_ITEMISED' | 'B2B_PACKAGED'

export interface QuoteIncludesRow {
  lineId: string
  date: string
  supplier: string
  description: string
}

export interface QuotePaymentSnapshot {
  totalTripCost: number
  amountPaid: number
  balanceDue: number
}

export type QuoteServiceType =
  | 'accommodation'
  | 'flight'
  | 'transportation'
  | 'activity'
  | 'extra'
  | 'other'

export interface QuoteDocumentLine {
  lineId: string
  type: QuoteServiceType
  date: string
  supplier: string
  service: string
  pax: string
  qty: string
  amount: number
  category: string
}

export interface QuoteOptionRow {
  supplier: string
  option: string
  includes: string
  excludes: string
}

export interface QuoteDocument {
  id: string
  itineraryId: string
  seq: number
  versionLabel: string
  docNumber: string
  fingerprint: string
  generatedAt: string
  generatedBy: string
  rateBasis: QuoteRateBasis
  presentation: QuotePresentation
  validUntil: string
  sellTotal: number
  coverTitle: string
  reference: string
  lines: QuoteDocumentLine[]
  categoryTotals: { name: string; amount: number }[]
  scheduleGroups: {
    name: string
    subtotal: number
    rows: { date: string; supplier: string; service: string; pax: string; qty: string; amount: number }[]
  }[]
  pricingSummary: {
    grossSell: number
    sellTotal: number
    discounts: { label: string; amount: number }[]
  }
  optionRows: QuoteOptionRow[]
  depositTotal: number
  depositBalance: number
  depositPctOfSell: number
  includesRows: QuoteIncludesRow[]
  paymentSnapshot: QuotePaymentSnapshot
}

export interface LifecycleLogEntry {
  id: string
  at: string
  actor: string
  from: ItineraryStatus
  to: ItineraryStatus
  label?: string
  reason?: string
  category?: LifecycleLogCategory
  entityId?: string
  detail?: string
}

export interface CatalogItem {
  /** Stable mock catalog id (unique per supplier+service row). */
  id: string
  name: string
  service: string
  location: string
  group: string
  headOffice: string
  starred: boolean
}

export interface Guest {
  id: number
  name: string
  type: 'adult' | 'youth' | 'child' | 'infant'
  age: number
  lead?: boolean
  /** Derived for R/NR chips: citizen + resident → R; nonResident → NR */
  resident: boolean
  residency?: GuestResidency
}

export type GuestResidency = 'citizen' | 'resident' | 'nonResident'

/** Three-state guest requirement model (BR-21) — a blank string must never stand in for
 *  "none required": 'recorded' prints the text verbatim, 'none' prints "No special
 *  requirements", 'not_captured' (the true default) prints "Not yet advised — to follow". */
export type DietaryStatus = 'recorded' | 'none' | 'not_captured'

export interface Room {
  id: string
  /** Stable room-product id from ROOM_TYPE_CATALOG (legacy labels are normalized on read). */
  type: string
  basis: string
  rate: number
  qty?: number
  guestIds: number[]
  start?: string
  end?: string
}

export interface Vehicle {
  id: string
  type: string
  cap: number
  rate: number
  guestIds: number[]
  /** Inclusive start of the vehicle hire / transfer window (ISO `YYYY-MM-DD`). */
  dateFrom?: string
  /** Inclusive end of the vehicle hire / transfer window (ISO `YYYY-MM-DD`). */
  dateTo?: string
}

/** One concrete departure / aircraft under a Flight service line (mirrors Transport vehicles). */
export interface FlightInstance {
  id: string
  /** Seat capacity for this departure. */
  cap: number
  guestIds: number[]
  /** Catalog Flight Option id (or charter sentinel). */
  optionId?: string
  /** Display name frozen at add-time (useful if catalog label changes). */
  optionName?: string
  departDate?: string
  /** 24h `HH:MM`. */
  departTime?: string
}

export interface HireRoute {
  id: string
  date: string
  pickup: string
  dropoff: string
  timeFrom: string
  timeTo: string
}

export interface ActivityItem {
  id: string
  name: string
  rate: number
  start?: string
  end?: string
  guestIds: number[]
}

export interface Hold {
  id: string
  status: 'Requested' | 'Held' | 'Released' | 'Expired'
  price: number
  date: string
  ref: string
  comment: string
}

export interface CustomExtra {
  id: string
  title: string
  price: number
  serviceType?: string
  chargeType?: string
  timeUnit?: string
  qty?: number
  dateFrom?: string
  dateTo?: string
}

export interface AddedService {
  id: string
  tab: ServiceTab
  title: string
  subtitle: string
  meta: string
  details: { label: string; value: string }[]
  price: number
  priceLabel: string
  net: number
  rack: number
  netLabel: string
  rackLabel: string
  margin: number
  marginPct: number
  marginColor: string
  fg: string
  bg: string
  initial: string
  expanded: boolean
  draft: Record<string, unknown>
  lineStatus?: LineStatus
  supplierStatus?: SupplierStatus
  /** Commercial fingerprint captured when the line was Confirmed. */
  confirmedFp?: string
  opsReady?: boolean
  /** A deposit has already been paid against this service — the voucher deposit guard (BR-43)
   *  blocks a supplier reject on any of its lines from deleting/losing the deposit silently. */
  depositPaid?: boolean
}

export interface QuoteExtra {
  label: string
  isDiscount?: boolean
  isNew?: boolean
  qty?: string
  dates?: string
  alloc?: string
  statusLabel?: string
  statusColor?: string
  statusBg?: string
  statusSub?: string
  amount?: string
  pct?: string
}

export interface QuoteService {
  id: string
  title: string
  sub?: string
  isNew?: boolean
  qty?: string
  nights?: string
  dates?: string
  alloc?: string
  statusLabel: string
  statusColor: string
  statusBg: string
  statusSub?: string
  subtotal: string
  hasChevron?: boolean
  indent?: boolean
  expanded: boolean
  extras: QuoteExtra[]
}

export interface QuoteGroup {
  id: string
  name: string
  loc: string
  icon: 'lodge' | 'vehicle' | 'flight'
  services: QuoteService[]
}

export interface GuestDetail {
  id: string
  salutation?: string
  firstName: string
  lastName: string
  dob?: string
  /** Role column: Adult / Child / Infant only (12–17 still Role=Child; pricing may treat as youth). */
  ageBand: 'adult' | 'child' | 'infant'
  age?: number
  residency?: GuestResidency
  flight?: string
  dietary?: string
  /** Explicit tri-state for `dietary` — undefined/back-compat reads as 'recorded' when
   *  `dietary` has text, else 'not_captured'. See DietaryStatus. */
  dietaryStatus?: DietaryStatus
  preferences?: string
  note?: string
  lead?: boolean
}

export interface CreateItineraryInput {
  inquiryRef?: string
  title: string
  agency: string
  agent: string
  leadFirst: string
  leadLast: string
  destinations: string[]
  travelDateFrom: string
  travelDateTo: string
  adultsCitizen: number
  adultsRes: number
  adultsNonRes: number
  childrenCitizen: number
  childrenRes: number
  childrenNonRes: number
  infantsCitizen: number
  infantsRes: number
  infantsNonRes: number
  childAges: number[]
}

export interface SplitForm {
  family: string
  adultsCitizen: number
  adultsRes: number
  adultsNonRes: number
  childrenCitizen: number
  childrenRes: number
  childrenNonRes: number
  infantsCitizen: number
  infantsRes: number
  infantsNonRes: number
  childAges: number[]
  /** Named guest roster for the new itinerary — reconciled against the counts above in the dialog. */
  guests: GuestDetail[]
}

export interface LifecycleTransition {
  to: ItineraryStatus
  label: string
  primary?: boolean
  reason?: boolean
  danger?: boolean
}

export interface ChipMeta {
  label: string
  bg: string
  fg: string
}

export interface ListFilters {
  status: ItineraryStatus | null
  payment: PaymentStatus | null
  agency: string | null
  destination: string | null
  dateFrom: string
  dateTo: string
  createdFrom: string
  createdTo: string
}

export type SortKey =
  | 'reference'
  | 'title'
  | 'travel'
  | 'hold'
  | 'status'
  | 'total'
  | 'margin'
  | 'payment'
  | 'agency'
  | null
