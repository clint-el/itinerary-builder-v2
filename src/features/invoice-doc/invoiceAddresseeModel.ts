import {
  isB2cChannel,
  isTravelCounsellorsAgency,
} from '@/features/quote-doc/documentOptionsModel'
import { parseAgencyAddress } from '@/features/quote-doc/quoteLedgerModel'
import type { GuestDetail, Itinerary } from '@/shared/lib/types'
import { guestDisplayName } from '@/features/guests/guestUtils'

export type InvoiceAddresseeType = 'agency' | 'client'

export type InvoiceAddresseeProfile = {
  type: InvoiceAddresseeType
  legalName: string
  addressLines: string[]
  email?: string
  phone?: string
  guestId?: string
}

export type InvoiceAddresseeSnapshot = InvoiceAddresseeProfile

const INTRIQ_JOURNEY_PROFILE = {
  legalName: 'INTRIQ JOURNEY LIMITED',
  addressLines: [
    '8/F., SI TOI COMMERCIAL BUILDING,',
    '62-63 CONNAUGHT ROAD WEST,',
    'SHEUNG WAN, H.K',
  ],
}

const TRAVEL_COUNSELLORS_INVOICE_PROFILE = {
  legalName: 'Travel Counsellors Head Office',
  addressLines: [
    'Nottingham House',
    'Riverside Business Park',
    'Nottingham NG2 1RU',
    'United Kingdom',
  ],
}

const AGENT_INVOICE_PROFILES: Record<string, { legalName: string; addressLines: string[] }> = {
  'Black Tomato': INTRIQ_JOURNEY_PROFILE,
  'Zoo Groups': {
    legalName: 'ZOO GROUPS TRAVEL LTD',
    addressLines: ['14 Wildlife Lane', 'Nairobi', 'Kenya'],
  },
  CPS: {
    legalName: 'CHELI & PEACOCK SAFARIS LTD',
    addressLines: ['Fedha Towers, Muindi Mbingu Street', 'Nairobi', 'Kenya'],
  },
}

export function defaultInvoiceAddresseeType(
  itinerary: Pick<Itinerary, 'agency'>,
): InvoiceAddresseeType {
  if (isTravelCounsellorsAgency(itinerary)) return 'agency'
  return isB2cChannel(itinerary) ? 'client' : 'agency'
}

export function effectiveInvoiceAddresseeType(
  itinerary: Pick<Itinerary, 'agency' | 'invoiceAddresseeType'>,
): InvoiceAddresseeType {
  if (isTravelCounsellorsAgency(itinerary)) return 'agency'
  return itinerary.invoiceAddresseeType ?? defaultInvoiceAddresseeType(itinerary)
}

export function effectiveInvoiceAddresseeGuestId(
  itinerary: Pick<Itinerary, 'invoiceAddresseeGuestId'>,
  guests: GuestDetail[],
): string | undefined {
  if (itinerary.invoiceAddresseeGuestId) {
    const linked = guests.find((g) => g.id === itinerary.invoiceAddresseeGuestId)
    if (linked) return linked.id
  }
  const marked = guests.find((g) => g.invoiceContact)
  if (marked) return marked.id
  const lead = guests.find((g) => g.lead)
  return lead?.id
}

function agencyInvoiceProfile(
  itinerary: Pick<Itinerary, 'agency' | 'agent' | 'agencyAddress'>,
): Omit<InvoiceAddresseeProfile, 'type'> {
  const agency = itinerary.agency?.trim() || ''
  const catalog = agency ? AGENT_INVOICE_PROFILES[agency] : undefined
  if (catalog) {
    return { legalName: catalog.legalName, addressLines: catalog.addressLines }
  }
  const raw = itinerary.agencyAddress?.trim()
  if (raw) {
    return {
      legalName: itinerary.agent?.trim() || agency || '—',
      addressLines: parseAgencyAddress(raw),
    }
  }
  return INTRIQ_JOURNEY_PROFILE
}

function clientInvoiceProfile(
  itinerary: Pick<
    Itinerary,
    'clientBillingAddress' | 'clientBillingEmail' | 'clientBillingPhone'
  >,
  guests: GuestDetail[],
  guestId: string | undefined,
): Omit<InvoiceAddresseeProfile, 'type'> {
  const guest =
    (guestId ? guests.find((g) => g.id === guestId) : undefined) ||
    guests.find((g) => g.invoiceContact) ||
    guests.find((g) => g.lead) ||
    guests[0]
  const legalName = guest ? guestDisplayName(guest, guests) : '—'
  const addressLines = parseAgencyAddress(itinerary.clientBillingAddress?.trim() || '')
  return {
    legalName,
    addressLines,
    email: itinerary.clientBillingEmail?.trim() || undefined,
    phone: itinerary.clientBillingPhone?.trim() || undefined,
    guestId: guest?.id,
  }
}

export function resolveInvoiceAddresseeProfile(input: {
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
  >
  guests: GuestDetail[]
  travelCounsellors?: boolean
  frozen?: InvoiceAddresseeSnapshot
}): InvoiceAddresseeProfile {
  if (input.frozen) return input.frozen

  if (input.travelCounsellors || isTravelCounsellorsAgency(input.itinerary)) {
    return { type: 'agency', ...TRAVEL_COUNSELLORS_INVOICE_PROFILE }
  }

  const type = effectiveInvoiceAddresseeType(input.itinerary)
  if (type === 'client') {
    const guestId = effectiveInvoiceAddresseeGuestId(input.itinerary, input.guests)
    return { type: 'client', ...clientInvoiceProfile(input.itinerary, input.guests, guestId) }
  }

  return { type: 'agency', ...agencyInvoiceProfile(input.itinerary) }
}

export function invoiceAddresseeReady(
  itinerary: Pick<Itinerary, 'agency' | 'invoiceAddresseeType' | 'invoiceAddresseeGuestId'>,
  guests: GuestDetail[],
): { ok: true } | { ok: false; message: string } {
  if (isTravelCounsellorsAgency(itinerary)) return { ok: true }
  if (effectiveInvoiceAddresseeType(itinerary) !== 'client') return { ok: true }

  const guestId = effectiveInvoiceAddresseeGuestId(itinerary, guests)
  const guest = guestId ? guests.find((g) => g.id === guestId) : undefined
  if (!guest) {
    return { ok: false, message: 'Choose an invoice contact guest before generating a client invoice.' }
  }
  const named = [guest.firstName, guest.lastName].some((p) => String(p || '').trim())
  if (!named) {
    return {
      ok: false,
      message: 'Invoice contact must be a named guest — name the guest on the roster first.',
    }
  }
  return { ok: true }
}

/** Mark one guest as invoice contact; clears the flag on all others. */
export function guestsWithInvoiceContact(
  guests: GuestDetail[],
  guestId: string | null,
): GuestDetail[] {
  return guests.map((g) => ({ ...g, invoiceContact: guestId != null && g.id === guestId }))
}
