import type {
  CatalogItem,
  Guest,
  Itinerary,
  ItineraryStatus,
  LifecycleTransition,
  QuoteGroup,
  ServiceTab,
} from './types'

export const AGENCIES = [
  {
    name: 'Elewana Collection',
    loc: 'Arusha, Tanzania',
    code: 'ELE',
    initials: 'EC',
    agents: [
      { name: 'Tom Smith', role: 'Senior Travel Consultant' },
      { name: 'Priya Anand', role: 'Travel Consultant' },
    ],
  },
  {
    name: 'Safari Dreams Travel',
    loc: 'Nairobi, Kenya',
    code: 'SDT',
    initials: 'SD',
    agents: [{ name: 'Grace Mwangi', role: 'Travel Consultant' }],
  },
  {
    name: 'Wanderlust Journeys',
    loc: 'London, United Kingdom',
    code: 'WJ',
    initials: 'WJ',
    agents: [
      { name: 'Oliver Bennett', role: 'Senior Travel Consultant' },
      { name: 'Emma Clarke', role: 'Travel Consultant' },
    ],
  },
  {
    name: 'Apex Voyages',
    loc: 'New York, USA',
    code: 'APX',
    initials: 'AV',
    agents: [{ name: 'Daniel Reyes', role: 'Travel Consultant' }],
  },
  {
    name: 'Baobab Expeditions',
    loc: 'Cape Town, South Africa',
    code: 'BBX',
    initials: 'BE',
    agents: [{ name: 'Naledi Dube', role: 'Travel Consultant' }],
  },
  {
    name: 'Zoo Groups',
    loc: 'Nairobi, Kenya',
    code: 'ZOO',
    initials: 'ZG',
    agents: [
      { name: 'David Ochieng', role: 'Travel Consultant' },
      { name: 'Peter Mwangi', role: 'Senior Travel Consultant' },
    ],
  },
  {
    name: 'CPS',
    loc: 'Nairobi, Kenya',
    code: 'CPS',
    initials: 'CP',
    agents: [],
  },
  {
    name: 'Black Tomato',
    loc: 'London, United Kingdom',
    code: 'BT',
    initials: 'BT',
    agents: [
      { name: 'Rachel Kim', role: 'Travel Consultant' },
      { name: 'Jane Smith', role: 'Senior Travel Consultant' },
    ],
  },
] as const

export const DESTINATIONS = ['Kenya', 'Tanzania', 'Zanzibar', 'Rwanda'] as const

export const STATUS_META: Record<ItineraryStatus, { label: string; bg: string; fg: string; dot: string }> = {
  DRAFT: { label: 'Draft', bg: '#F1F5F9', fg: '#475569', dot: '#94A3B8' },
  PREPARED: { label: 'Prepared', bg: '#DBEAFE', fg: '#1D4ED8', dot: '#2563EB' },
  QUOTED: { label: 'Quoted', bg: '#F3E8FF', fg: '#7E22CE', dot: '#9333EA' },
  APPROVED: { label: 'Approved', bg: '#FEF3C7', fg: '#B45309', dot: '#D97706' },
  INVOICED: { label: 'Invoiced', bg: '#FFEDD5', fg: '#C2410C', dot: '#EA580C' },
  VOUCHERED: { label: 'Vouchered', bg: '#CCFBF1', fg: '#0F766E', dot: '#0D9488' },
  CONFIRMED: { label: 'Confirmed', bg: '#DCFCE7', fg: '#15803D', dot: '#22C55E' },
  TRAVEL_IN_PROGRESS: { label: 'In Progress', bg: '#DCFCE7', fg: '#15803D', dot: '#22C55E' },
  COMPLETED: { label: 'Completed', bg: '#DCFCE7', fg: '#15803D', dot: '#16A34A' },
  LOST: { label: 'Lost', bg: '#FEE2E2', fg: '#B91C1C', dot: '#DC2626' },
  CANCELLED: { label: 'Cancelled', bg: '#FEE2E2', fg: '#B91C1C', dot: '#DC2626' },
  SUPERSEDED: { label: 'Superseded', bg: '#F1F5F9', fg: '#94A3B8', dot: '#94A3B8' },
}

export const PAYMENT_META = {
  UNPAID: { label: 'Unpaid', bg: '#F1F5F9', fg: '#475569' },
  DEPOSIT_PAID: { label: 'Deposit Paid', bg: '#DBEAFE', fg: '#1D4ED8' },
  PARTIALLY_PAID: { label: 'Partial', bg: '#FEF3C7', fg: '#B45309' },
  FULLY_PAID: { label: 'Paid', bg: '#DCFCE7', fg: '#15803D' },
  OVERPAID: { label: 'Overpaid', bg: '#FFEDD5', fg: '#C2410C' },
  REFUND_PENDING: { label: 'Refund Pending', bg: '#F3E8FF', fg: '#7E22CE' },
} as const

export const LIFECYCLE_TRANSITIONS: Record<ItineraryStatus, LifecycleTransition[]> = {
  DRAFT: [{ to: 'PREPARED', label: 'Mark as Prepared', primary: true }],
  PREPARED: [
    { to: 'QUOTED', label: 'Generate & Send Quote', primary: true },
    { to: 'DRAFT', label: 'Return to Draft' },
  ],
  QUOTED: [
    { to: 'APPROVED', label: 'Agent Approved', primary: true },
    { to: 'DRAFT', label: 'Revise (Return to Draft)' },
    { to: 'LOST', label: 'Mark as Lost', reason: true, danger: true },
    { to: 'SUPERSEDED', label: 'Mark Superseded', reason: true },
  ],
  APPROVED: [
    { to: 'INVOICED', label: 'Generate Invoice', primary: true },
    { to: 'DRAFT', label: 'Return to Draft' },
  ],
  INVOICED: [
    { to: 'VOUCHERED', label: 'Generate Vouchers', primary: true },
    { to: 'LOST', label: 'Mark as Lost', reason: true, danger: true },
  ],
  VOUCHERED: [
    { to: 'CONFIRMED', label: 'Confirm Booking', primary: true },
    { to: 'LOST', label: 'Mark as Lost', reason: true, danger: true },
  ],
  CONFIRMED: [{ to: 'CANCELLED', label: 'Cancel Booking', reason: true, danger: true }],
  TRAVEL_IN_PROGRESS: [{ to: 'CANCELLED', label: 'Cancel Booking', reason: true, danger: true }],
  COMPLETED: [],
  LOST: [{ to: 'DRAFT', label: 'Reopen (Return to Draft)', reason: true }],
  SUPERSEDED: [{ to: 'DRAFT', label: 'Reactivate', reason: true }],
  CANCELLED: [{ to: 'DRAFT', label: 'Reopen (Return to Draft)', reason: true }],
}

export const TAB_META: Record<ServiceTab, { label: string; fg: string; bg: string; initial: string }> = {
  accommodation: { label: 'Accommodation', fg: '#059669', bg: '#D1FAE5', initial: 'A' },
  transportation: { label: 'Transportation', fg: '#D97706', bg: '#FEF3C7', initial: 'T' },
  flight: { label: 'Flight', fg: '#2563EB', bg: '#DBEAFE', initial: 'F' },
  activity: { label: 'Activity', fg: '#DB2777', bg: '#FCE7F3', initial: 'A' },
  other: { label: 'Other', fg: '#475569', bg: '#E2E8F0', initial: 'O' },
}

export const LOCATION_TREE = [
  {
    id: 'kenya',
    name: 'Kenya',
    kind: 'Country',
    children: [
      { id: 'nairobi', name: 'Nairobi', kind: 'Region' },
      { id: 'central-kenya', name: 'Central Kenya', kind: 'Region' },
      { id: 'loisaba', name: 'Loisaba', kind: 'Region' },
      { id: 'watamu', name: 'Watamu', kind: 'Region' },
      {
        id: 'southern-kenya',
        name: 'Southern Kenya',
        kind: 'Region',
        children: [
          { id: 'masai-mara', name: 'Masai Mara', kind: 'Region' },
          { id: 'amboseli', name: 'Amboseli', kind: 'Region' },
        ],
      },
      { id: 'western-kenya', name: 'Western Kenya', kind: 'Region' },
    ],
  },
  {
    id: 'tanzania',
    name: 'Tanzania',
    kind: 'Country',
    children: [
      { id: 'serengeti', name: 'Serengeti', kind: 'Region' },
      { id: 'ngorongoro', name: 'Ngorongoro', kind: 'Region' },
      { id: 'kilimanjaro', name: 'Kilimanjaro', kind: 'Region' },
      { id: 'zanzibar', name: 'Zanzibar', kind: 'Region' },
    ],
  },
]

export const CATALOG: Record<ServiceTab, CatalogItem[]> = {
  accommodation: [
    { id: 'acc-hemingways-nairobi', name: 'Hemingways Nairobi', service: 'Double Suite', location: 'Nairobi', group: 'Hemingways', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'acc-hemingways-watamu', name: 'Hemingways Watamu', service: 'Double Suite', location: 'Watamu', group: 'Hemingways', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'acc-elewana-loisaba', name: 'Elewana Loisaba Tented Camp', service: 'GPKG Double Safari Tent', location: 'Loisaba', group: 'Elewana', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'acc-elewana-sand-river', name: 'Elewana Sand River Masai Mara', service: 'GPKG Family Tent', location: 'Masai Mara', group: 'Elewana', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'acc-elewana-serengeti', name: 'Elewana Serengeti Migration Camp', service: 'GPKG Double Safari Tent', location: 'Serengeti', group: 'Elewana', headOffice: 'Arusha, Tanzania', starred: true },
    { id: 'acc-elewana-manor', name: 'Elewana The Manor at Ngorongoro', service: 'GPKG Stable Cottage', location: 'Ngorongoro', group: 'Elewana', headOffice: 'Arusha, Tanzania', starred: true },
    { id: 'acc-mara-serena', name: 'Mara Serena Lodge', service: 'Luxury Tent', location: 'Masai Mara', group: 'Serena', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'acc-governors-camp', name: "Governors' Camp", service: 'Riverside Tent', location: 'Masai Mara', group: 'Governors', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'acc-ol-tukai', name: 'Ol Tukai Lodge', service: 'Garden View Room', location: 'Amboseli', group: 'AA Lodges', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'acc-wilder-group', name: 'The Wilder Group', service: 'Standard Tent', location: 'Masai Mara', group: 'Wilder', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  transportation: [
    { id: 'trn-hemingways-transfers', name: 'Hemingways Transfers', service: 'JKIA to Hemingways Nairobi (3-pax)', location: 'Nairobi', group: 'Hemingways', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'trn-cheli-peacock-nbo', name: 'Cheli & Peacock Safaris Nairobi', service: 'Nairobi One Way Transfer', location: 'Nairobi', group: 'Cheli & Peacock', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'trn-bushtops', name: 'Bushtops Transfers', service: 'Airstrip transfer', location: 'Masai Mara', group: 'Bushtops', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'trn-mara-route', name: 'Mara Route Vehicles', service: 'Full-day game drive', location: 'Masai Mara', group: 'Mara Route', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'trn-nairobi-airport', name: 'Nairobi Airport Transfers', service: 'Airport transfer', location: 'Central Kenya', group: 'CityLink', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  flight: [
    { id: 'flt-airkenya-wilson1', name: 'AirKenya Wilson1', service: 'WILSON TO LOISABA OW', location: 'Nairobi', group: 'AirKenya', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'flt-airkenya-central1', name: 'AirKenya Central Kenya1', service: 'LOISABA TO MARA OW', location: 'Central Kenya', group: 'AirKenya', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'flt-airkenya-mara1', name: 'AirKenya Mara1', service: 'MARA TO KOGATENDE OW', location: 'Masai Mara', group: 'AirKenya', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'flt-auric-serengeti1', name: 'Auric Air Serengeti1', service: 'SEN - SERENGETI NORTH to MANYARA', location: 'Serengeti', group: 'Auric Air', headOffice: 'Arusha, Tanzania', starred: true },
    { id: 'flt-auric-manyara1', name: 'Auric Air Manyara1', service: 'MANYARA to KILIMANJARO', location: 'Ngorongoro', group: 'Auric Air', headOffice: 'Arusha, Tanzania', starred: true },
    { id: 'flt-safarilink', name: 'Safarilink', service: 'Charter flight', location: 'Masai Mara', group: 'Safarilink', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'flt-airkenya', name: 'AirKenya', service: 'Scheduled flight', location: 'Central Kenya', group: 'AirKenya', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'flt-coastal-scheduled', name: 'Coastal Aviation', service: 'Scheduled Economy (Y Class)', location: 'Nairobi', group: 'Coastal Aviation', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'flt-coastal-charter', name: 'Coastal Aviation Charter', service: 'Charter Flight', location: 'Nairobi', group: 'Coastal Aviation', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  activity: [
    { id: 'act-cheli-peacock-kenya', name: 'Cheli and Peacock Safaris Kenya', service: 'Giraffe Centre Entrance Fee', location: 'Nairobi', group: 'Cheli & Peacock', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'act-governors-balloon', name: "Governors' Balloon Safaris", service: 'Hot-air balloon safari', location: 'Masai Mara', group: 'Governors', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'act-mara-walking', name: 'Mara Walking Safaris', service: 'Guided bush walk', location: 'Masai Mara', group: 'Independent', headOffice: 'Nairobi, Kenya', starred: false },
    { id: 'act-nairobi-city-tour', name: 'Nairobi City Tour', service: 'Half-day city tour', location: 'Central Kenya', group: 'CityLink', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  other: [
    { id: 'oth-amref', name: 'KE AMREF Flying Doctors', service: 'Amref Silver: Kenya/Tanzania/Zanzibar 30 days', location: 'Nairobi', group: 'AMREF', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'oth-umbato', name: 'Umbato Meet and Assist Services', service: 'JKIA Meet & Assist (Arrival)', location: 'Nairobi', group: 'Umbato', headOffice: 'Nairobi, Kenya', starred: true },
    { id: 'oth-local-guide', name: 'Local Guide Services', service: 'Freelance guide', location: 'Masai Mara', group: 'Independent', headOffice: 'Nairobi, Kenya', starred: false },
  ],
}

export type ExtraCatalogItem = {
  id: string
  title: string
  price: number
  mandatory?: boolean
  /** Service tabs that can pick this extra. Defaults to accommodation. */
  tabs?: ServiceTab[]
  /**
   * When set, only show this extra when the selected Catalog Service (or an
   * activity item name) matches one of these names — mirrors Catalog
   * `serviceExtras[].serviceName` linkage (e.g. Lunch → Game Drive).
   */
  serviceNames?: string[]
}

/** Hemingways extras portfolio — avg prices from live booking history. */
export const EXTRAS_CATALOG: ExtraCatalogItem[] = [
  { id: 'garden-buffet-lunch', title: 'Garden Buffet Lunch Adult (N)', price: 28, tabs: ['accommodation'] },
  { id: 'beverage-tz', title: 'Beverage TZ', price: 103, tabs: ['accommodation'] },
  { id: 'dinner-voucher', title: 'Dinner Voucher Adult (N)', price: 43, tabs: ['accommodation'] },
  { id: 'curio-shop', title: 'Curio Shop (TZ) USD', price: 231, tabs: ['accommodation'] },
  { id: 'dinner', title: 'Dinner', price: 159, tabs: ['accommodation'] },
  { id: 'drinks-supplement', title: 'Drinks Supplement TZ', price: 61, tabs: ['accommodation', 'transportation'] },
  { id: 'lunch', title: 'Lunch', price: 286, tabs: ['accommodation'] },
  { id: 'spa-treatments', title: 'SPA Treatments', price: 173, tabs: ['accommodation'] },
  { id: 'drivers-lunch-box', title: "Drivers Lunch Box (TZ) USD", price: 5, tabs: ['transportation'] },
  { id: 'conservancy', title: 'Park/Conservancy Fees', price: 100, mandatory: true, tabs: ['accommodation'] },
  { id: 'flight-transfers', title: 'Flight Transfers (Arrive/Depart)', price: 0, tabs: ['flight', 'transportation'] },
  {
    id: 'flight-security-fee',
    title: 'Airport Security Fee',
    price: 15,
    mandatory: true,
    tabs: ['flight'],
  },
  {
    id: 'trans-fuel-levy',
    title: 'Fuel Levy',
    price: 20,
    mandatory: true,
    tabs: ['transportation'],
  },
  { id: 'executive-room-supplement', title: "Supplement — Hemingway's Executive Room", price: 75, tabs: ['accommodation'] },
  { id: 'after-hours-transfer', title: 'After-hours Transfer Surcharge', price: 40, tabs: ['transportation'] },
  { id: 'exclusive-vehicle', title: 'Exclusive Use of Vehicle', price: 150, tabs: ['transportation'] },
  { id: 'child-seat', title: 'Child Seat', price: 15, tabs: ['transportation'] },
  // Invented for the Transport Policy/Extras/Special Offer(s) prototype build-out
  // (PCP-1462 scope expansion) — not from a real product spec, flag for BA sign-off.
  { id: 'bottled-water', title: 'Bottled Water (per PAX)', price: 3, tabs: ['transportation'] },
  { id: 'onboard-wifi', title: 'Onboard WiFi', price: 12, tabs: ['transportation'] },
  { id: 'driver-upgrade', title: 'Professional Driver-Guide Upgrade', price: 60, tabs: ['transportation'] },
  // Activity extras — linked to Catalog services via serviceNames (serviceExtras)
  {
    id: 'activity-lunch',
    title: 'Lunch',
    price: 45,
    tabs: ['activity'],
    serviceNames: ['Game drive', 'Game Drive'],
  },
  {
    id: 'activity-bush-breakfast',
    title: 'Bush Breakfast',
    price: 55,
    tabs: ['activity'],
    serviceNames: ['Game drive', 'Game Drive', 'Hot air balloon safari'],
  },
  {
    id: 'activity-binocular-hire',
    title: 'Binocular Hire',
    price: 15,
    tabs: ['activity'],
    serviceNames: ['Game drive', 'Game Drive', 'Guided nature walk'],
  },
  {
    id: 'activity-park-fee',
    title: 'Park Entry Fee',
    price: 80,
    mandatory: true,
    tabs: ['activity'],
  },
  {
    id: 'activity-champagne',
    title: 'Champagne Breakfast Upgrade',
    price: 35,
    tabs: ['activity'],
    serviceNames: ['Hot air balloon safari'],
  },
  // Other line-item extras
  { id: 'other-admin-fee', title: 'Administration Fee', price: 25, mandatory: true, tabs: ['other'] },
  { id: 'other-document-handling', title: 'Document Handling', price: 15, tabs: ['other'] },
  { id: 'other-courier', title: 'Courier / Delivery', price: 35, tabs: ['other'] },
]

/** Catalog extras available for a given service tab. */
export function extrasForTab(tab: ServiceTab): ExtraCatalogItem[] {
  return EXTRAS_CATALOG.filter((extra) => (extra.tabs ?? ['accommodation']).includes(tab))
}

/** Activity extras filtered by selected service / activity item names. */
export function extrasForActivityService(
  serviceName: string,
  activityNames: string[] = [],
): ExtraCatalogItem[] {
  const names = [serviceName, ...activityNames]
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean)
  return extrasForTab('activity').filter((extra) => {
    if (!extra.serviceNames?.length) return true
    return extra.serviceNames.some((sn) => names.includes(sn.toLowerCase()))
  })
}

export type RoomTypeOption = {
  id: string
  name: string
  cap: number
  supplier: 'Hemingways' | 'Elewana' | 'Generic'
  legacyNames?: readonly string[]
}

/**
 * Stable room-product catalog. Room.type persists the id; names are display
 * values only and can change without invalidating saved itinerary records.
 */
export const ROOM_TYPE_CATALOG: readonly RoomTypeOption[] = [
  { id: 'hemingways-single-suite', name: 'Single Suite', cap: 1, supplier: 'Hemingways', legacyNames: ['BB Single Hemingway Suite', 'GPKG Single Hemingway Suite'] },
  { id: 'hemingways-double-suite', name: 'Double Suite', cap: 2, supplier: 'Hemingways', legacyNames: ['BB Double Hemingway Suite', 'GPKG Double Hemingway Suite', 'BB Double Deluxe Suite'] },
  { id: 'hemingways-twin-suite', name: 'Twin Suite', cap: 2, supplier: 'Hemingways', legacyNames: ['BB Twin Deluxe Suite'] },
  { id: 'hemingways-triple-suite', name: 'Triple Suite', cap: 3, supplier: 'Hemingways', legacyNames: ['GPKG Triple Hemingway Suite'] },
  { id: 'hemingways-day-room', name: 'Double/Twin Day Room', cap: 2, supplier: 'Hemingways', legacyNames: ['Hemingway Suite Double/Twin Day Room'] },
  { id: 'elewana-double-safari-tent', name: 'GPKG Double Safari Tent', cap: 3, supplier: 'Elewana' },
  { id: 'elewana-cior-two-children', name: 'GPKG CIOR (Two Chd 12 to 17.99 yrs)', cap: 2, supplier: 'Elewana' },
  { id: 'elewana-family-tent', name: 'GPKG Family Tent', cap: 4, supplier: 'Elewana' },
  { id: 'elewana-stable-cottage', name: 'GPKG Stable Cottage', cap: 3, supplier: 'Elewana' },
  { id: 'generic-single', name: 'Single', cap: 1, supplier: 'Generic' },
  { id: 'generic-twin', name: 'Twin', cap: 2, supplier: 'Generic' },
  { id: 'generic-double', name: 'Double', cap: 2, supplier: 'Generic' },
  { id: 'generic-triple', name: 'Triple', cap: 3, supplier: 'Generic' },
  { id: 'generic-family', name: 'Family', cap: 4, supplier: 'Generic' },
]

/** Default options shown for a new Hemingways room. */
export const ROOM_TYPES = ROOM_TYPE_CATALOG.filter((room) => room.supplier === 'Hemingways')

export function resolveRoomType(value?: string): RoomTypeOption | undefined {
  if (!value) return undefined
  return ROOM_TYPE_CATALOG.find(
    (room) =>
      room.id === value ||
      room.name === value ||
      room.legacyNames?.includes(value),
  )
}

export function roomTypeId(value?: string): string {
  return resolveRoomType(value)?.id ?? value ?? ''
}

export function roomTypeLabel(value?: string): string {
  return resolveRoomType(value)?.name ?? value ?? 'Room'
}

export function roomTypeCapacity(value?: string): number {
  return resolveRoomType(value)?.cap ?? 2
}

/**
 * New rooms show Hemingways products. Existing non-Hemingways or legacy rooms
 * prepend their resolved product so their saved selection remains visible.
 */
export function roomTypeOptions(current?: string): RoomTypeOption[] {
  const selected = resolveRoomType(current)
  if (!current || (selected && ROOM_TYPES.some((room) => room.id === selected.id))) {
    return [...ROOM_TYPES]
  }
  if (!selected) {
    return [
      { id: current, name: current, cap: 2, supplier: 'Generic' },
      ...ROOM_TYPES,
    ]
  }
  return [selected, ...ROOM_TYPES]
}

export const BASIS = {
  fb: 'Full Board',
  hb: 'Half Board',
  bb: 'Bed & Breakfast',
  ro: 'Room Only',
  gd: 'Game Drive',
  gp: 'Game Package',
  fi: 'Fully Inclusive',
} as const

export type BasisOption = {
  id: keyof typeof BASIS
  label: string
  included: string
  excluded: string
}

/** Canonical meal-basis options (shared included/excluded copy — not reinvented per property). */
export const BASIS_OPTION_DEFS: BasisOption[] = [
  { id: 'fb', label: BASIS.fb, included: 'Breakfast, lunch and dinner are included daily.', excluded: 'Alcoholic beverages, laundry and park fees are not included.' },
  { id: 'hb', label: BASIS.hb, included: 'Breakfast and dinner are included daily.', excluded: 'Lunch, alcoholic beverages and park fees are not included.' },
  { id: 'bb', label: BASIS.bb, included: 'Breakfast is included daily.', excluded: 'Lunch, dinner, beverages and park fees are not included.' },
  { id: 'ro', label: BASIS.ro, included: 'Accommodation only, no meals included.', excluded: 'All meals, beverages and park fees are not included.' },
  { id: 'gd', label: BASIS.gd, included: 'Breakfast and a shared game drive are included daily.', excluded: 'Lunch, dinner and park fees are not included.' },
  { id: 'gp', label: BASIS.gp, included: 'Full board plus scheduled game drives are included daily.', excluded: 'Park/conservancy fees, alcoholic beverages and laundry are not included.' },
  { id: 'fi', label: BASIS.fi, included: 'All meals and scheduled game activities are included daily.', excluded: 'Park/conservancy fees, alcoholic beverages and laundry are not included.' },
]

function cloneOptions<T extends object>(options: T[]): T[] {
  return options.map((o) => ({ ...o }))
}

function pickBasis(ids: Array<BasisOption['id']>): BasisOption[] {
  return cloneOptions(BASIS_OPTION_DEFS.filter((o) => ids.includes(o.id)))
}

/**
 * Meal basis Options keyed by accommodation `CatalogItem.id`.
 *
 * Real split used here (no invented copy): city / coastal hotels expose classic
 * board bases; safari camps/lodges also expose game-package style bases that
 * only make sense in that product context. Included/excluded text is still the
 * shared BASIS_OPTION_DEFS copy — not per-supplier prose.
 */
export const BASIS_OPTIONS_BY_SERVICE: Record<string, BasisOption[]> = {
  'acc-hemingways-nairobi': pickBasis(['fb', 'hb', 'bb', 'ro']),
  'acc-hemingways-watamu': pickBasis(['fb', 'hb', 'bb', 'ro']),
  'acc-ol-tukai': pickBasis(['fb', 'hb', 'bb', 'ro']),
  'acc-elewana-loisaba': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-elewana-sand-river': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-elewana-serengeti': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-elewana-manor': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-mara-serena': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-governors-camp': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
  'acc-wilder-group': pickBasis(['fb', 'hb', 'bb', 'gd', 'gp', 'fi']),
}

/** Flat list for selects when no catalog service is chosen yet. */
export const BASIS_OPTIONS = BASIS_OPTION_DEFS.map(({ id, label }) => ({ id, label }))

export const ACC_RATE = {
  adult: { resident: { net: 90, rack: 120 }, nonResident: { net: 140, rack: 180 } },
  youth: { resident: { net: 70, rack: 95 }, nonResident: { net: 110, rack: 145 } },
  child: { resident: { net: 45, rack: 60 }, nonResident: { net: 70, rack: 90 } },
  infant: { resident: { net: 0, rack: 0 }, nonResident: { net: 0, rack: 0 } },
} as const

export const GUESTS: Guest[] = [
  { id: 1, name: 'Amara Chen', type: 'adult', age: 34, lead: true, resident: true },
  { id: 2, name: 'Guest 2', type: 'adult', age: 37, resident: false },
  { id: 3, name: 'Guest 3', type: 'youth', age: 15, resident: true },
  { id: 4, name: 'Guest 4', type: 'child', age: 9, resident: true },
  { id: 5, name: 'Guest 5', type: 'youth', age: 13, resident: false },
  { id: 6, name: 'Guest 6', type: 'child', age: 6, resident: false },
]

export const PROMOTIONS = [
  { id: 'early-bird', title: 'Early Bird 10%', desc: 'Book 90 days in advance', active: true },
  { id: 'stay-more', title: 'Stay 4 Pay 3', desc: 'Applies on bookings of 4+ nights' },
  { id: 'honeymoon', title: 'Honeymoon Package', desc: 'Complimentary bottle of wine & late checkout' },
  {
    id: 'free-lunch-game-drive',
    title: 'Free Lunch on Game Drive',
    desc: '40% off Lunch when booked with a Game Drive (travel window 2026–2027)',
    active: true,
  },
]

export type ActivityTypeOption = {
  id: string
  name: string
  rate: number
  included: string
  excluded: string
}

/** Canonical activity-type Options (shared included/excluded copy). */
export const ACTIVITY_OPTION_DEFS: ActivityTypeOption[] = [
  {
    id: 'giraffe-centre-entrance',
    name: 'Giraffe Centre Entrance Fee',
    rate: 45,
    included: 'Entrance to the Giraffe Centre and educational briefing.',
    excluded: 'Transport and personal purchases are not included.',
  },
  {
    id: 'karen-blixen-museum',
    name: 'Karen Blixen Museum Entry Fee',
    rate: 36,
    included: 'Museum entrance and guided walkthrough of the house and grounds.',
    excluded: 'Transport and souvenir purchases are not included.',
  },
  {
    id: 'sheldrick-orphanage',
    name: 'Sheldrick Wildlife Trust Nairobi Orphanage Public Hours Visit',
    rate: 50,
    included: 'Public visiting-hour entry to the elephant orphanage.',
    excluded: 'Park entry fees and private guiding are not included.',
  },
  {
    id: 'game-drive',
    name: 'Game drive',
    rate: 60,
    included:
      'Professional driver-guide, park entry coordination, and bottled water throughout the drive.',
    excluded: 'Personal expenses, gratuities, and any premium beverages are not covered.',
  },
  {
    id: 'guided-nature-walk',
    name: 'Guided nature walk',
    rate: 45,
    included: 'Licensed walking guide, safety briefing, and use of binoculars during the walk.',
    excluded: 'Park conservation fees and personal travel insurance are not included.',
  },
  {
    id: 'hot-air-balloon',
    name: 'Hot air balloon safari',
    rate: 420,
    included: 'Sunrise balloon flight, champagne breakfast on landing, and a flight certificate.',
    excluded: 'Transfers to the launch site and gratuities to the crew are excluded.',
  },
  {
    id: 'cultural-village',
    name: 'Cultural village visit',
    rate: 35,
    included: 'Community host, guided tour of the village, and a traditional welcome.',
    excluded: 'Craft purchases and optional community donations are not included.',
  },
  {
    id: 'boat-cruise',
    name: 'Boat cruise',
    rate: 80,
    included: 'Boat hire, captain and crew, and refreshments served on board.',
    excluded: 'Fishing equipment hire and premium drinks are excluded.',
  },
]

function pickActivity(ids: string[]): ActivityTypeOption[] {
  return cloneOptions(ACTIVITY_OPTION_DEFS.filter((o) => ids.includes(o.id)))
}

/**
 * Activity-type Options keyed by activity `CatalogItem.id`.
 *
 * Subsets follow the catalog service itself (entrance-fee product vs balloon vs
 * walking vs city tour) — option *copy* is still shared from ACTIVITY_OPTION_DEFS;
 * we are not inventing per-supplier included/excluded text.
 */
export const ACTIVITY_OPTIONS_BY_SERVICE: Record<string, ActivityTypeOption[]> = {
  'act-cheli-peacock-kenya': pickActivity([
    'giraffe-centre-entrance',
    'karen-blixen-museum',
    'sheldrick-orphanage',
  ]),
  'act-governors-balloon': pickActivity(['hot-air-balloon']),
  'act-mara-walking': pickActivity(['guided-nature-walk', 'game-drive', 'cultural-village']),
  'act-nairobi-city-tour': pickActivity([
    'giraffe-centre-entrance',
    'karen-blixen-museum',
    'sheldrick-orphanage',
    'cultural-village',
  ]),
}

/** @deprecated Prefer ACTIVITY_OPTIONS_BY_SERVICE / optionsForService — flat defs for legacy callers. */
export const ACTIVITY_TYPES = ACTIVITY_OPTION_DEFS

export type OtherTypeOption = {
  id: string
  name: string
  rate: number
  included: string
  excluded: string
}

export const OTHER_OPTION_DEFS: OtherTypeOption[] = [
  {
    id: 'conservancy-fee',
    name: 'Conservancy fee',
    rate: 90,
    included: 'Statutory conservancy / community fee for the stay dates shown.',
    excluded: 'Park entry fees outside the conservancy and personal expenses are not included.',
  },
  {
    id: 'visa-assistance',
    name: 'Visa assistance',
    rate: 55,
    included: 'Document checklist support and submission guidance for standard tourist visas.',
    excluded: 'Embassy fees, courier costs, and expedited processing are not included.',
  },
  {
    id: 'travel-insurance',
    name: 'Travel insurance',
    rate: 120,
    included: 'Quoted policy premium for the travel window shown on this itinerary.',
    excluded: 'Pre-existing condition riders and claim excesses are not included.',
  },
  {
    id: 'miscellaneous-fee',
    name: 'Miscellaneous fee',
    rate: 40,
    included: 'Supplier-quoted miscellaneous charge as described on the line.',
    excluded: 'Anything not explicitly listed on the supplier confirmation is excluded.',
  },
]

/**
 * Other-type Options keyed by other `CatalogItem.id`.
 *
 * Invented for prototype purposes — option *sets* are intentionally uniform
 * across Other catalog rows for now (same cloned OTHER_OPTION_DEFS list per
 * id). Real per-supplier option menus are not in the mock data; flag for BA
 * sign-off before treating this Record as differentiated product data.
 */
export const OTHER_OPTIONS_BY_SERVICE: Record<string, OtherTypeOption[]> = Object.fromEntries(
  CATALOG.other.map((item) => [item.id, cloneOptions(OTHER_OPTION_DEFS)]),
)

/** @deprecated Prefer OTHER_OPTIONS_BY_SERVICE / optionsForService. */
export const OTHER_TYPES = OTHER_OPTION_DEFS

export type VehicleTypeOption = {
  id: string
  type: string
  cap: number
  rate: number
  included: string
  excluded: string
}

export const VEHICLE_OPTION_DEFS: VehicleTypeOption[] = [
  {
    id: 'safari-vehicle',
    type: 'Safari Vehicle',
    cap: 6,
    rate: 250,
    included: 'Pop-up roof safari vehicle, driver-guide, and bottled water on board.',
    excluded: 'Park / conservancy fees, meals, and gratuities are not included.',
  },
  {
    id: 'land-cruiser',
    type: 'Land Cruiser',
    cap: 6,
    rate: 220,
    included: '4×4 Land Cruiser, fuel, and professional driver for the transfer window.',
    excluded: 'After-hours surcharges, waiting time beyond the agreed window, and tips are excluded.',
  },
  {
    id: 'minivan',
    type: 'Minivan',
    cap: 8,
    rate: 280,
    included: 'Air-conditioned minivan, driver, and standard luggage allowance.',
    excluded: 'Excess baggage handling and road tolls outside the quoted route are not included.',
  },
  {
    id: 'sedan',
    type: 'Sedan',
    cap: 4,
    rate: 150,
    included: 'Private sedan transfer with driver for the booked route.',
    excluded: 'Child seats (on request), waiting time, and multiple stop-offs are not included.',
  },
]

/**
 * Vehicle-type Options keyed by transportation `CatalogItem.id`.
 *
 * Invented for prototype purposes — option *sets* (and included/excluded copy)
 * are intentionally uniform across Transport catalog rows for now. Real
 * per-supplier vehicle menus are not in the mock data; flag for BA sign-off
 * before treating this Record as differentiated product data.
 * (Same honesty precedent as the Transport extras comments above.)
 */
export const VEHICLE_OPTIONS_BY_SERVICE: Record<string, VehicleTypeOption[]> = Object.fromEntries(
  CATALOG.transportation.map((item) => [item.id, cloneOptions(VEHICLE_OPTION_DEFS)]),
)

/** @deprecated Prefer VEHICLE_OPTIONS_BY_SERVICE / optionsForService. */
export const VEHICLE_TYPES = VEHICLE_OPTION_DEFS

export const SYSTEM_PRICE = [
  { label: 'Sell', value: '$3364' },
  { label: 'Cost', value: '$2250' },
  { label: 'Discount', value: '--' },
  { label: 'Special Offer(s)', value: '--' },
  { label: 'Purchase price', value: '$2250' },
  { label: 'CPS margin 30%', value: '$675' },
  { label: 'TC commission', value: '$0' },
  { label: 'Client price', value: '$3263', strong: true },
] as const

/** Apply a flat discount and/or special offer to BOTH cost and sell.
 * Flat $ discounts are pro-rated onto cost by the sell reduction ratio.
 * Percentage promos (e.g. early-bird 10%) cut both sides by the same rate.
 * CNP (contracted-net-price) holds cost and only moves sell — not used here. */
export function applyOfferToCostAndSell(
  net: number,
  rack: number,
  discount = 0,
  promotionId?: string | null,
) {
  const promo = PROMOTIONS.find((p) => p.id === promotionId)
  let sellDelta = Math.max(0, Number(discount) || 0)
  let costDelta = 0
  let label = sellDelta > 0 ? 'Discount' : ''

  if (promo?.id === 'early-bird') {
    const promoSell = Math.round(rack * 0.1 * 100) / 100
    const promoCost = Math.round(net * 0.1 * 100) / 100
    sellDelta += promoSell
    costDelta += promoCost
    label = sellDelta > promoSell ? `Discount + ${promo.title}` : promo.title
  } else if (promo) {
    label = label ? `Discount + ${promo.title}` : promo.title
  }

  sellDelta = Math.min(sellDelta, Math.max(0, rack))
  if (sellDelta > 0 && rack > 0) {
    // Pro-rate any remaining flat discount onto cost at the same ratio as sell.
    const flatSell = Math.max(0, sellDelta - (promo?.id === 'early-bird' ? Math.round(rack * 0.1 * 100) / 100 : 0))
    if (flatSell > 0) {
      costDelta += Math.round(net * (flatSell / rack) * 100) / 100
    }
  }
  costDelta = Math.min(costDelta, Math.max(0, net))

  return {
    label: label || 'Discount',
    sellDelta,
    costDelta,
    cost: Math.max(0, Math.round((net - costDelta) * 100) / 100),
    sell: Math.max(0, Math.round((rack - sellDelta) * 100) / 100),
    promo,
  }
}

/** Build a live system-price summary from draft net/rack + discount + special offer. */
export function liveSystemPrice(
  net: number,
  rack: number,
  discount: number,
  promotionId?: string | null,
) {
  const offer = applyOfferToCostAndSell(net, rack, discount, promotionId)
  const specialValue =
    offer.promo?.id === 'early-bird'
      ? `−${formatUsdStatic(Math.round(rack * 0.1 * 100) / 100)}`
      : offer.promo
        ? offer.promo.title
        : '--'
  const margin = offer.sell - offer.cost
  const marginPct = offer.sell > 0 ? Math.round((margin / offer.sell) * 100) : 0
  return [
    { label: 'Sell', value: formatUsdStatic(rack) },
    { label: 'Cost', value: formatUsdStatic(net) },
    { label: 'Discount', value: discount ? formatUsdStatic(discount) : '--' },
    { label: 'Special Offer(s)', value: specialValue },
    { label: 'Purchase price', value: formatUsdStatic(offer.cost) },
    {
      label: `CPS margin ${marginPct}%`,
      value: formatUsdStatic(margin),
    },
    { label: 'TC commission', value: '$0.00' },
    { label: 'Client price', value: formatUsdStatic(offer.sell), strong: true },
  ]
}

function formatUsdStatic(n: number) {
  return (
    '$' +
    (Math.round((n || 0) * 100) / 100).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  )
}

export const SEED_ITINERARIES: Itinerary[] = [
  { id: 'CPS5678', reference: 'CPS5678', itineraryRef: 'ITN-10234', title: 'Families Apex, Tiffany, Zidane', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 12500, balanceUsd: 12500, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5678-1', reference: 'CPS5678-1', itineraryRef: 'ITN-10234-1', title: 'Delacroix Family', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 118000, balanceUsd: 118000, updatedAt: '2026-07-08T09:12:00Z', adults: 4, children: 2, infants: 0 },
  { id: 'CPS5678-1-1', reference: 'CPS5678-1-1', itineraryRef: 'ITN-10234-1-1', title: 'Delacroix — Grandparents', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 62000, balanceUsd: 62000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 0, infants: 0 },
  { id: 'CPS5678-1-2', reference: 'CPS5678-1-2', itineraryRef: 'ITN-10234-1-2', title: 'Delacroix — Children', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 56000, balanceUsd: 56000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5678-2', reference: 'CPS5678-2', itineraryRef: 'ITN-10234-2', title: 'Moreau Family', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 126000, balanceUsd: 126000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 1, infants: 0 },
  { id: 'CPS5679', reference: 'CPS5679', itineraryRef: 'ITN-10235', title: 'Wanderlust Family Kenya Explorer', agency: 'Zoo Groups', agent: 'David Ochieng', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-15', status: 'PREPARED', paymentStatus: 'DEPOSIT_PAID', totalUsd: 18200, balanceUsd: 14200, updatedAt: '2026-07-07T15:40:00Z', adults: 2, children: 3, infants: 0 },
  { id: 'CPS5680', reference: 'CPS5680', itineraryRef: 'ITN-10236', title: 'Baobab Migration Adventure', agency: 'CPS', agent: '', safariPlanner: 'Noah Kiptoo', destination: 'Tanzania', travelDateFrom: '2026-09-05', travelDateTo: '2026-09-15', createdAt: '2026-06-20', status: 'QUOTED', paymentStatus: 'OVERPAID', totalUsd: 10200, balanceUsd: -450, updatedAt: '2026-07-06T11:05:00Z', adults: 4, children: 0, infants: 0, creditTerms: true },
  { id: 'CPS5681', reference: 'CPS5681', itineraryRef: 'ITN-10237', title: 'Apex Voyages Serengeti Fly-In', agency: 'Black Tomato', agent: 'Rachel Kim', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-07-20', travelDateTo: '2026-07-28', createdAt: '2026-06-22', status: 'APPROVED', paymentStatus: 'PARTIALLY_PAID', totalUsd: 15600, balanceUsd: 7800, updatedAt: '2026-07-05T08:22:00Z', adults: 2, children: 0, infants: 0 },
  { id: 'CPS5682', reference: 'CPS5682', itineraryRef: 'ITN-10238', title: 'Safari Dreams Honeymoon Escape', agency: 'Zoo Groups', agent: 'Peter Mwangi', safariPlanner: 'Noah Kiptoo', destination: 'Kenya', travelDateFrom: '2026-06-01', travelDateTo: '2026-06-09', createdAt: '2026-05-10', status: 'CONFIRMED', paymentStatus: 'FULLY_PAID', totalUsd: 9800, balanceUsd: 0, updatedAt: '2026-07-04T17:50:00Z', adults: 2, children: 0, infants: 0 },
  { id: 'CPS5683', reference: 'CPS5683', itineraryRef: 'ITN-10239', title: 'Cheli & Peacock VIP Group Tour', agency: 'CPS', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-05-14', travelDateTo: '2026-05-24', createdAt: '2026-04-18', status: 'TRAVEL_IN_PROGRESS', paymentStatus: 'FULLY_PAID', totalUsd: 32000, balanceUsd: 0, updatedAt: '2026-07-08T06:15:00Z', adults: 6, children: 0, infants: 0 },
  { id: 'CPS5684', reference: 'CPS5684', itineraryRef: 'ITN-10240', title: 'Elewana Zanzibar Beach Extension', agency: 'Black Tomato', agent: 'Jane Smith', safariPlanner: 'Noah Kiptoo', destination: 'Zanzibar', travelDateFrom: '2026-03-02', travelDateTo: '2026-03-09', createdAt: '2026-02-01', status: 'COMPLETED', paymentStatus: 'FULLY_PAID', totalUsd: 6400, balanceUsd: 0, updatedAt: '2026-06-20T10:00:00Z', adults: 2, children: 0, infants: 0 },
  { id: 'CPS5686', reference: 'CPS5686', itineraryRef: 'ITN-10242', title: 'Smith Family', agency: 'Black Tomato', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-06-10', travelDateTo: '2026-06-20', createdAt: '2026-05-20', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 18200, balanceUsd: 18200, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5686-1', reference: 'CPS5686-1', itineraryRef: 'ITN-10242-1', title: 'Whitfield Family', agency: 'Black Tomato', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-06-10', travelDateTo: '2026-06-20', createdAt: '2026-05-20', status: 'CONFIRMED', paymentStatus: 'UNPAID', totalUsd: 18200, balanceUsd: 18200, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 1, infants: 0 },
  { id: 'CPS5686-2', reference: 'CPS5686-2', itineraryRef: 'ITN-10242-2', title: 'Okonkwo Family', agency: 'Black Tomato', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-06-10', travelDateTo: '2026-06-20', createdAt: '2026-05-20', status: 'SUPERSEDED', paymentStatus: 'UNPAID', totalUsd: 12500, balanceUsd: 12500, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 0, infants: 1 },
  { id: 'CPS5686-3', reference: 'CPS5686-3', itineraryRef: 'ITN-10242-3', title: 'Patel Family', agency: 'Black Tomato', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-06-10', travelDateTo: '2026-06-20', createdAt: '2026-05-20', status: 'SUPERSEDED', paymentStatus: 'UNPAID', totalUsd: 15900, balanceUsd: 15900, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5687', reference: 'CPS5687', itineraryRef: 'ITN-10243', title: 'Bennett Family', agency: 'CPS', agent: '', safariPlanner: 'Noah Kiptoo', destination: 'Tanzania', travelDateFrom: '2026-09-05', travelDateTo: '2026-09-12', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 22000, balanceUsd: 22000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5687-1', reference: 'CPS5687-1', itineraryRef: 'ITN-10243-1', title: 'Bennett Family', agency: 'CPS', agent: '', safariPlanner: 'Noah Kiptoo', destination: 'Tanzania', travelDateFrom: '2026-09-05', travelDateTo: '2026-09-12', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 22000, balanceUsd: 22000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5688', reference: 'CPS5688', itineraryRef: 'ITN-10244', title: 'Elewana Kenya & Tanzania Safari', agency: 'CPS', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-09-01', travelDateTo: '2026-09-15', createdAt: '2026-07-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 42140.96, balanceUsd: 42140.96, updatedAt: '2026-07-20T10:00:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5685', reference: 'CPS5685', itineraryRef: 'ITN-10241', title: 'Untitled Itinerary', agency: 'Zoo Groups', agent: 'David Ochieng', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-10-11', travelDateTo: '2026-10-18', createdAt: '2026-06-25', status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', totalUsd: 11200, balanceUsd: -3200, updatedAt: '2026-06-28T13:33:00Z', adults: 2, children: 1, infants: 0 },
]

export const SEED_COLLAPSED_REFS: Record<string, boolean> = { CPS5687: true }

export const SEED_QUOTE_GROUPS: QuoteGroup[] = [
  {
    id: 'g1', name: 'Hemingways Nairobi', loc: 'Kenya', icon: 'lodge',
    services: [
      {
        id: 'fb', title: 'Full Board (FB)', isNew: true, qty: '1', nights: '3', dates: '10 Jun 2026 - 12 Jun 2026', alloc: '1A',
        statusLabel: 'Prepared', statusColor: '#0B69A3', statusBg: '#DFF2FE', subtotal: '$1,500.00', hasChevron: true, expanded: true,
        extras: [
          { label: 'Long Stay Discount', isDiscount: true, amount: '-$1,233.00', pct: '-10%' },
          { label: 'Park Fees', isNew: true, qty: '1', dates: '10 Jun 2026 - 13 Jun 2026', alloc: '1A', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', statusSub: '24 May 2026', amount: '$100.00' },
          { label: 'Bush Lunch', isNew: true, qty: '1', dates: '10 Jun 2026', alloc: '1A', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', statusSub: '24 May 2026', amount: '$40.00' },
        ],
      },
      {
        id: 'gp', title: 'Game Package (GP)', isNew: true, qty: '1', nights: '3', dates: '10 Jun 2026 - 12 Jun 2026', alloc: '1A, 3C',
        statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', statusSub: '24 May 2026', subtotal: '$1,500.00', hasChevron: true, expanded: true,
        extras: [
          { label: 'Long Stay Discount', isDiscount: true, amount: '-$1,233.00', pct: '-10%' },
          { label: 'Park Fees', isNew: true, qty: '1', dates: '10 Jun 2026 - 13 Jun 2026', alloc: '1A, 3C', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', amount: '$400.00' },
          { label: 'Bush Lunch', isNew: true, qty: '1', dates: '10 Jun 2026 - 13 Jun 2026', alloc: '1A, 3C', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', amount: '$40.00' },
        ],
      },
    ],
  },
  {
    id: 'g2', name: 'Cheli & Peacock Safaris', loc: 'Kenya', icon: 'vehicle',
    services: [{
      id: 'std', title: 'Standard', sub: '· Toyota 4x4 Land Cruiser', isNew: true, qty: '2', dates: '12 Jun 2026', alloc: '2A, 3C',
      statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', subtotal: '$1,200.00', hasChevron: true, expanded: true,
      extras: [{ label: 'Carbon offset levy', isNew: true, qty: '1', dates: '12 Jun 2026', alloc: '2A, 3C', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', amount: '$800.00' }],
    }],
  },
  {
    id: 'g3', name: 'CPS Coastal Aviation', loc: '', icon: 'flight',
    services: [{
      id: 'morning', title: 'Morning Flight', qty: '1', dates: '12 Jun 2026', alloc: '2A, 3C',
      statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', subtotal: '$400.00', hasChevron: false, indent: true, expanded: false, extras: [],
    }],
  },
  {
    id: 'g4', name: 'Singita Mara River Tented Camp', loc: 'Rwanda', icon: 'lodge',
    services: [
      { id: 'fb2', title: 'Full Board (FB)', qty: '1', dates: '12 Jun 2026', alloc: '1A, 3C', statusLabel: 'Confirmed', statusColor: '#067A55', statusBg: 'rgba(0,212,146,0.14)', subtotal: '$800.00', hasChevron: false, indent: true, expanded: false, extras: [] },
      { id: 'gp2', title: 'Game Package (GP)', qty: '1', dates: '13 Jun 2026 - 14 Jun 2026', alloc: '1A', statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', subtotal: '$800.00', hasChevron: false, indent: true, expanded: false, extras: [] },
    ],
  },
  {
    id: 'g5', name: 'Cheli & Peacock Safaris', loc: '', icon: 'vehicle',
    services: [{
      id: 'svcname', title: 'Service Name', qty: '2', dates: '13 Jun 2026 - 14 Jun 2026', alloc: '1A, 3C',
      statusLabel: 'Hold', statusColor: '#931115', statusBg: '#F4E2E3', subtotal: '$4,000.00', hasChevron: false, indent: true, expanded: false, extras: [],
    }],
  },
]

export type TravelRange = { from?: string; to?: string }

/** Draft date fields that inherit the itinerary travel window when left blank. */
const TRAVEL_DATE_FIELDS: Record<ServiceTab, { start: string[]; end: string[] }> = {
  accommodation: { start: ['start'], end: ['end'] },
  transportation: { start: ['transDate', 'hireStart'], end: ['hireEnd'] },
  flight: { start: ['departDate'], end: ['returnDate'] },
  activity: { start: ['startDate'], end: ['endDate'] },
  other: { start: ['startDate'], end: ['endDate'] },
}

/** Fill blank date fields from the travel window; existing values are never overwritten. */
export function applyTravelRange(
  tab: ServiceTab,
  draft: Record<string, unknown>,
  range: TravelRange,
): Record<string, unknown> {
  const fields = TRAVEL_DATE_FIELDS[tab]
  const next = { ...draft }
  const fill = (keys: string[], value?: string) => {
    if (!value) return
    for (const key of keys) {
      if (!String(next[key] ?? '').trim()) next[key] = value
    }
  }
  fill(fields.start, range.from)
  fill(fields.end, range.to)

  // Nested departure dates on Flights / Vehicles (same “never overwrite” rule).
  if (range.from && tab === 'flight' && Array.isArray(next.flights)) {
    next.flights = (next.flights as { departDate?: string }[]).map((f, i) =>
      i === 0 && !String(f.departDate ?? '').trim() ? { ...f, departDate: range.from } : f,
    )
  }
  if (range.from && tab === 'transportation' && Array.isArray(next.vehicles)) {
    next.vehicles = (
      next.vehicles as { dateFrom?: string; dateTo?: string; departDate?: string }[]
    ).map((v) => {
      const from = String(v.dateFrom || v.departDate || '').trim()
      const to = String(v.dateTo || '').trim()
      return {
        ...v,
        dateFrom: from || range.from,
        dateTo: to || range.to || range.from,
      }
    })
  }

  return next
}

export function defaultDraft(tab: ServiceTab, range?: TravelRange): Record<string, unknown> {
  const base = baseDraft(tab)
  return range ? applyTravelRange(tab, base, range) : base
}

function baseDraft(tab: ServiceTab): Record<string, unknown> {
  if (tab === 'accommodation') {
    return {
      location: '', supplier: '', service: '', serviceId: '', start: '', end: '', discount: 0, basis: 'bb',
      rooms: [] as unknown[],
      extras: ['conservancy'],
      customExtras: [] as unknown[],
      customExtraSeq: 1,
      promotion: 'early-bird',
      holds: [
        { id: 'h0', status: 'Requested', price: 3263, date: '18 Sep 2027', ref: 'REF-1103', comment: '' },
        { id: 'h1', status: 'Held', price: 2500, date: '25 Sep 2027', ref: 'REF-1042', comment: '' },
        { id: 'h2', status: 'Released', price: 3263, date: '15 Sep 2027', ref: 'REF-0988', comment: '' },
        { id: 'h3', status: 'Expired', price: 3263, date: '10 Sep 2027', ref: 'REF-0901', comment: '' },
      ],
      notes: '',
    }
  }
  if (tab === 'transportation') {
    return {
      location: '', supplier: '', service: '', serviceId: '', transMode: 'transfer',
      transDate: '', hireStart: '', hireEnd: '', pickup: '', dropoff: '', timeFrom: '', timeTo: '',
      discount: 0,
      transPax: { adult: 0, child: 0, infant: 0 },
      vehicles: [
        {
          id: 'v1',
          type: 'Land Cruiser',
          cap: 6,
          rate: 220,
          guestIds: [] as number[],
          dateFrom: '',
          dateTo: '',
        },
      ],
      hireRoutes: [] as unknown[],
      extras: ['trans-fuel-levy'] as string[],
      customExtras: [] as unknown[],
      customExtraSeq: 1,
    }
  }
  if (tab === 'flight') {
    return {
      location: '', supplier: '', service: '', serviceId: '', returnService: '', flightMode: 'oneway',
      departDate: '', returnDate: '', departTime: '', returnTime: '',
      capacity: 5, capMin: 2, capMax: 5, overflowMode: 'split', qty: 1, discount: 0,
      pax: { adult: 2, youth: 0, child: 0, infant: 0 },
      rates: { adult: 180, youth: 140, child: 90, infant: 0 },
      flights: [] as unknown[],
      extras: ['flight-security-fee'] as string[], customExtras: [] as unknown[], customExtraSeq: 1, promotion: null,
    }
  }
  if (tab === 'activity') {
    return {
      location: '', supplier: '', service: '', serviceId: '', startDate: '', endDate: '', discount: 0,
      days: [] as string[], activities: [] as unknown[],
      extras: ['activity-park-fee'] as string[], customExtras: [] as unknown[], customExtraSeq: 1, promotion: null,
    }
  }
  return {
    location: '', supplier: '', service: '', serviceId: '', description: '', startDate: '', endDate: '',
    qty: 1, price: 0, discount: 0, activities: [] as unknown[],
    extras: ['other-admin-fee'] as string[], customExtras: [] as unknown[], customExtraSeq: 1, promotion: null,
  }
}
