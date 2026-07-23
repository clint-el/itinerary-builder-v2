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
  adultsRes?: number
  adultsNonRes?: number
  childrenRes?: number
  childrenNonRes?: number
  infantsRes?: number
  infantsNonRes?: number
  childAges?: number[]
  paxAdults?: number
  paxChildren?: number
  guestsLabel?: string
  creditTerms?: boolean
  financeLocked?: boolean
}

export interface CatalogItem {
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
  resident: boolean
}

export interface Room {
  id: string
  type: string
  basis: string
  rate: number
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
  margin: number
  marginPct: number
  marginColor: string
  fg: string
  bg: string
  initial: string
  expanded: boolean
  draft: Record<string, unknown>
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
  ageBand: 'adult' | 'youth' | 'child' | 'infant'
  age?: number
  flight?: string
  dietary?: string
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
  adultsRes: number
  adultsNonRes: number
  childrenRes: number
  childrenNonRes: number
  infantsRes: number
  infantsNonRes: number
  childAges: number[]
}

export interface SplitForm {
  family: string
  ad: string
  ch: string
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
