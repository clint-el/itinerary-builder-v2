import { describe, expect, it } from 'vitest'
import {
  defaultInvoiceAddresseeType,
  invoiceAddresseeReady,
  resolveInvoiceAddresseeProfile,
} from '@/features/invoice-doc/invoiceAddresseeModel'
import type { GuestDetail } from '@/shared/lib/types'

const namedGuest: GuestDetail = {
  id: 'g1',
  firstName: 'Alex',
  lastName: 'Morgan',
  ageBand: 'adult',
  lead: true,
}

describe('invoiceAddresseeModel', () => {
  it('defaults B2C channel to client and B2B to agency', () => {
    expect(defaultInvoiceAddresseeType({ agency: '' })).toBe('client')
    expect(defaultInvoiceAddresseeType({ agency: 'Black Tomato' })).toBe('agency')
  })

  it('resolves agency legal entity for B2B invoices', () => {
    const profile = resolveInvoiceAddresseeProfile({
      itinerary: { agency: 'Black Tomato', agent: 'Rachel Kim', agencyAddress: '' },
      guests: [],
    })
    expect(profile.type).toBe('agency')
    expect(profile.legalName).toBe('INTRIQ JOURNEY LIMITED')
  })

  it('resolves client name from invoice contact guest', () => {
    const profile = resolveInvoiceAddresseeProfile({
      itinerary: {
        agency: '',
        agent: '',
        agencyAddress: '',
        invoiceAddresseeType: 'client',
        invoiceAddresseeGuestId: 'g1',
        clientBillingAddress: '12 Main St\nNairobi',
        clientBillingEmail: 'alex@example.com',
      },
      guests: [namedGuest],
    })
    expect(profile.type).toBe('client')
    expect(profile.legalName).toBe('Alex Morgan')
    expect(profile.addressLines).toEqual(['12 Main St', 'Nairobi'])
    expect(profile.email).toBe('alex@example.com')
  })

  it('blocks client invoice when contact guest is unnamed', () => {
    const ready = invoiceAddresseeReady(
      { agency: '', invoiceAddresseeType: 'client', invoiceAddresseeGuestId: 'g1' },
      [{ ...namedGuest, firstName: '', lastName: '', invoiceContact: true }],
    )
    expect(ready.ok).toBe(false)
  })
})
