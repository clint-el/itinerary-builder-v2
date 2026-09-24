import {
  defaultInvoiceAddresseeType,
  effectiveInvoiceAddresseeGuestId,
  effectiveInvoiceAddresseeType,
} from '@/features/invoice-doc/invoiceAddresseeModel'
import { isTravelCounsellorsAgency } from '@/features/quote-doc/documentOptionsModel'
import { guestDisplayName } from '@/features/guests/guestUtils'
import type { GuestDetail, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

type GuestInvoiceBillingSectionProps = {
  itinerary: Itinerary
  guests: GuestDetail[]
  onChange: (patch: Partial<Itinerary>) => void
  onSelectInvoiceGuest: (guestId: string) => void
}

export function GuestInvoiceBillingSection({
  itinerary,
  guests,
  onChange,
  onSelectInvoiceGuest,
}: GuestInvoiceBillingSectionProps) {
  if (isTravelCounsellorsAgency(itinerary)) return null

  const type = effectiveInvoiceAddresseeType(itinerary)
  const contactId = effectiveInvoiceAddresseeGuestId(itinerary, guests)
  const contact = contactId ? guests.find((g) => g.id === contactId) : undefined

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-4">
      <div>
        <span className="text-sm font-bold text-[#171717]">Invoice billing contact</span>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[#737373]">
          Used on the invoice cover when Invoiced to is set to Client. Defaults to{' '}
          {defaultInvoiceAddresseeType(itinerary) === 'client' ? 'client on B2C bookings' : 'agency on B2B bookings'}.
        </p>
      </div>

      <div className="inline-flex w-fit overflow-hidden rounded-lg border border-[#E5E7EB]">
        {(['agency', 'client'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onChange({ invoiceAddresseeType: value })}
            className={cn(
              'h-[34px] border-0 border-r border-[#E5E7EB] px-4 text-[13px] font-semibold capitalize last:border-r-0',
              type === value ? 'bg-[#931115] text-white' : 'bg-white text-[#525252]',
            )}
          >
            {value}
          </button>
        ))}
      </div>

      {type === 'client' ? (
        <>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Invoice contact guest
            </label>
            <select
              value={contactId ?? ''}
              onChange={(e) => onSelectInvoiceGuest(e.target.value)}
              className="mt-1.5 h-[38px] w-full max-w-md rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#171717]"
            >
              <option value="">Select guest…</option>
              {guests.map((g) => (
                <option key={g.id} value={g.id}>
                  {guestDisplayName(g, guests)}
                </option>
              ))}
            </select>
            {contact ? (
              <p className="mt-1 text-[12px] text-[#525252]">
                Cover name: <span className="font-semibold">{guestDisplayName(contact, guests)}</span>
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Field
              label="Billing email"
              value={itinerary.clientBillingEmail ?? ''}
              onChange={(v) => onChange({ clientBillingEmail: v })}
              placeholder="client@example.com"
            />
            <Field
              label="Billing phone"
              value={itinerary.clientBillingPhone ?? ''}
              onChange={(v) => onChange({ clientBillingPhone: v })}
              placeholder="+1 …"
              mono
            />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Billing address
            </label>
            <textarea
              value={itinerary.clientBillingAddress ?? ''}
              onChange={(e) => onChange({ clientBillingAddress: e.target.value })}
              placeholder="Street, city, country — plain text, line breaks preserved on the invoice"
              className="mt-1.5 min-h-[88px] w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#171717] outline-none"
            />
          </div>
        </>
      ) : (
        <p className="text-[12.5px] leading-relaxed text-[#737373]">
          Agency legal name and address come from the booking agency profile on the invoice cover.
        </p>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  mono,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'mt-1.5 h-[38px] w-full rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] text-[#171717] outline-none',
          mono && "font-['IBM_Plex_Mono']",
        )}
      />
    </div>
  )
}
