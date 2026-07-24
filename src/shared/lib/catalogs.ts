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
      { id: 'central-kenya', name: 'Central Kenya', kind: 'Region' },
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
      { id: 'zanzibar', name: 'Zanzibar', kind: 'Region' },
    ],
  },
]

export const CATALOG: Record<ServiceTab, CatalogItem[]> = {
  accommodation: [
    { name: 'Hemingways Nairobi', service: 'Garden Suite', location: 'Central Kenya', group: 'Hemingways', headOffice: 'Nairobi, Kenya', starred: true },
    { name: 'Mara Serena Lodge', service: 'Luxury Tent', location: 'Masai Mara', group: 'Serena', headOffice: 'Nairobi, Kenya', starred: true },
    { name: "Governors' Camp", service: 'Riverside Tent', location: 'Masai Mara', group: 'Governors', headOffice: 'Nairobi, Kenya', starred: false },
    { name: 'Ol Tukai Lodge', service: 'Garden View Room', location: 'Amboseli', group: 'AA Lodges', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  transportation: [
    { name: 'Bushtops Transfers', service: 'Airstrip transfer', location: 'Masai Mara', group: 'Bushtops', headOffice: 'Nairobi, Kenya', starred: true },
    { name: 'Mara Route Vehicles', service: 'Full-day game drive', location: 'Masai Mara', group: 'Mara Route', headOffice: 'Nairobi, Kenya', starred: false },
    { name: 'Nairobi Airport Transfers', service: 'Airport transfer', location: 'Central Kenya', group: 'CityLink', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  flight: [
    { name: 'Safarilink', service: 'Charter flight', location: 'Masai Mara', group: 'Safarilink', headOffice: 'Nairobi, Kenya', starred: true },
    { name: 'AirKenya', service: 'Scheduled flight', location: 'Central Kenya', group: 'AirKenya', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  activity: [
    { name: "Governors' Balloon Safaris", service: 'Hot-air balloon safari', location: 'Masai Mara', group: 'Governors', headOffice: 'Nairobi, Kenya', starred: true },
    { name: 'Mara Walking Safaris', service: 'Guided bush walk', location: 'Masai Mara', group: 'Independent', headOffice: 'Nairobi, Kenya', starred: false },
    { name: 'Nairobi City Tour', service: 'Half-day city tour', location: 'Central Kenya', group: 'CityLink', headOffice: 'Nairobi, Kenya', starred: false },
  ],
  other: [
    { name: 'Local Guide Services', service: 'Freelance guide', location: 'Masai Mara', group: 'Independent', headOffice: 'Nairobi, Kenya', starred: false },
  ],
}

export const EXTRAS_CATALOG = [
  { id: 'conservancy', title: 'Conservancy Fee', price: 45, mandatory: true },
  { id: 'laundry', title: 'Laundry Service', price: 15 },
  { id: 'wifi', title: 'Premium Wi-Fi', price: 10 },
  { id: 'transfer', title: 'Private Airstrip Transfer', price: 80 },
]

export const BASIS = {
  fb: 'Full Board',
  hb: 'Half Board',
  bb: 'Bed & Breakfast',
  ro: 'Room Only',
  gd: 'Game Drive',
} as const

export const BASIS_DETAILS = {
  fb: { included: 'Breakfast, lunch and dinner are included daily.', excluded: 'Alcoholic beverages, laundry and park fees are not included.' },
  hb: { included: 'Breakfast and dinner are included daily.', excluded: 'Lunch, alcoholic beverages and park fees are not included.' },
  bb: { included: 'Breakfast is included daily.', excluded: 'Lunch, dinner, beverages and park fees are not included.' },
  ro: { included: 'Accommodation only, no meals included.', excluded: 'All meals, beverages and park fees are not included.' },
  gd: { included: 'Breakfast and a shared game drive are included daily.', excluded: 'Lunch, dinner and park fees are not included.' },
} as const

export const BASIS_OPTIONS = Object.entries(BASIS).map(([id, label]) => ({ id, label }))

export const ROOM_CAP: Record<string, number> = { Single: 1, Twin: 2, Double: 2, Triple: 3, Family: 4 }

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
]

export const ACTIVITY_TYPES = [
  { name: 'Game drive', rate: 60, includes: 'Professional driver-guide, park entry coordination, and bottled water throughout the drive.', excludes: 'Personal expenses, gratuities, and any premium beverages are not covered.' },
  { name: 'Guided nature walk', rate: 45, includes: 'Licensed walking guide, safety briefing, and use of binoculars during the walk.', excludes: 'Park conservation fees and personal travel insurance are not included.' },
  { name: 'Hot air balloon safari', rate: 420, includes: 'Sunrise balloon flight, champagne breakfast on landing, and a flight certificate.', excludes: 'Transfers to the launch site and gratuities to the crew are excluded.' },
  { name: 'Cultural village visit', rate: 35, includes: 'Community host, guided tour of the village, and a traditional welcome.', excludes: 'Craft purchases and optional community donations are not included.' },
  { name: 'Boat cruise', rate: 80, includes: 'Boat hire, captain and crew, and refreshments served on board.', excludes: 'Fishing equipment hire and premium drinks are excluded.' },
]

export const SYSTEM_PRICE = [
  { label: 'Rack', value: '$3364' },
  { label: 'Net', value: '$2250' },
  { label: 'Sell', value: '--' },
  { label: 'Discount', value: '--' },
  { label: 'Promotions', value: '--' },
  { label: 'Purchase price', value: '$2250' },
  { label: 'CPS margin 30%', value: '$675' },
  { label: 'TC commission', value: '$0' },
  { label: 'Client price', value: '$3263', strong: true },
] as const

/** Build a live system-price summary from draft net/rack + discount. */
export function liveSystemPrice(net: number, rack: number, discount: number) {
  const client = Math.max(0, rack - (discount || 0))
  const margin = client - net
  const marginPct = client > 0 ? Math.round((margin / client) * 100) : 0
  return [
    { label: 'Rack', value: formatUsdStatic(rack) },
    { label: 'Net', value: formatUsdStatic(net) },
    { label: 'Sell', value: formatUsdStatic(client) },
    { label: 'Discount', value: discount ? formatUsdStatic(discount) : '--' },
    { label: 'Promotions', value: '--' },
    { label: 'Purchase price', value: formatUsdStatic(net) },
    {
      label: `CPS margin ${marginPct}%`,
      value: formatUsdStatic(margin),
    },
    { label: 'TC commission', value: '$0.00' },
    { label: 'Client price', value: formatUsdStatic(client), strong: true },
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

export const VEHICLE_TYPES = [
  { type: 'Land Cruiser', cap: 6, rate: 220 },
  { type: 'Minivan', cap: 8, rate: 280 },
  { type: 'Sedan', cap: 3, rate: 150 },
]

export const SEED_ITINERARIES: Itinerary[] = [
  { id: 'CPS5678', reference: 'CPS5678', itineraryRef: 'ITN-10234', title: 'Families Apex, Tiffany, Zidane', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 12500, balanceUsd: 12500, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5678-1', reference: 'CPS5678-1', itineraryRef: 'ITN-10234-1', title: 'Delacroix Family', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 118000, balanceUsd: 118000, updatedAt: '2026-07-08T09:12:00Z', adults: 4, children: 2, infants: 0 },
  { id: 'CPS5678-1-1', reference: 'CPS5678-1-1', itineraryRef: 'ITN-10234-1-1', title: 'Delacroix — Grandparents', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 62000, balanceUsd: 62000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 0, infants: 0 },
  { id: 'CPS5678-1-2', reference: 'CPS5678-1-2', itineraryRef: 'ITN-10234-1-2', title: 'Delacroix — Children', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 56000, balanceUsd: 56000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 2, infants: 0 },
  { id: 'CPS5678-2', reference: 'CPS5678-2', itineraryRef: 'ITN-10234-2', title: 'Moreau Family', agency: 'Zoo Groups', agent: '', safariPlanner: 'Amelia Earhart', destination: 'Tanzania', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-01', status: 'DRAFT', paymentStatus: 'UNPAID', totalUsd: 126000, balanceUsd: 126000, updatedAt: '2026-07-08T09:12:00Z', adults: 2, children: 1, infants: 0 },
  { id: 'CPS5679', reference: 'CPS5679', itineraryRef: 'ITN-10235', title: 'Wanderlust Family Kenya Explorer', agency: 'Zoo Groups', agent: 'David Ochieng', safariPlanner: 'Amelia Earhart', destination: 'Kenya', travelDateFrom: '2026-08-02', travelDateTo: '2026-08-14', createdAt: '2026-06-15', status: 'PREPARED', paymentStatus: 'DEPOSIT_PAID', totalUsd: 10200, balanceUsd: 6200, updatedAt: '2026-07-07T15:40:00Z', adults: 2, children: 3, infants: 0 },
  { id: 'CPS5680', reference: 'CPS5680', itineraryRef: 'ITN-10236', title: 'Baobab Migration Adventure', agency: 'CPS', agent: '', safariPlanner: 'Noah Kiptoo', destination: 'Tanzania', travelDateFrom: '2026-09-05', travelDateTo: '2026-09-15', createdAt: '2026-06-20', status: 'QUOTED', paymentStatus: 'UNPAID', totalUsd: 10200, balanceUsd: 10200, updatedAt: '2026-07-06T11:05:00Z', adults: 4, children: 0, infants: 0, creditTerms: true },
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

export function defaultDraft(tab: ServiceTab): Record<string, unknown> {
  if (tab === 'accommodation') {
    return {
      location: '', supplier: '', service: '', start: '', end: '', discount: 0, basis: 'bb',
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
      location: '', supplier: '', service: '', transMode: 'transfer',
      transDate: '', hireStart: '', hireEnd: '', pickup: '', dropoff: '', timeFrom: '', timeTo: '',
      discount: 0,
      vehicles: [{ id: 'v1', type: 'Land Cruiser', cap: 6, rate: 220, guestIds: [] as number[] }],
    }
  }
  if (tab === 'flight') {
    return {
      location: '', supplier: '', service: '', flightMode: 'oneway',
      departDate: '', returnDate: '', capacity: 12, qty: 1, discount: 0,
      pax: { adult: 2, youth: 0, child: 0, infant: 0 },
      rates: { adult: 180, youth: 140, child: 90, infant: 0 },
      extras: [] as string[], customExtras: [] as unknown[], customExtraSeq: 1, promotion: null,
    }
  }
  if (tab === 'activity') {
    return {
      location: '', supplier: '', service: '', startDate: '', endDate: '', discount: 0,
      days: [] as string[], activities: [] as unknown[],
    }
  }
  return {
    location: '', supplier: '', service: '', description: '', startDate: '', endDate: '',
    qty: 1, price: 0, discount: 0, activities: [] as unknown[],
  }
}
