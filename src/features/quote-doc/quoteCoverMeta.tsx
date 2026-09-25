import type { InvoiceAddresseeProfile } from '@/features/invoice-doc/invoiceAddresseeModel'
import type {
  AgentInvoiceProfile,
  BookedByContact,
  BookingAgentBlock,
  GuestDetailRow,
} from '@/features/quote-doc/quoteLedgerModel'
import type { GuestDetail } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

const PAX_BADGE_STYLES: Record<GuestDetail['ageBand'], string> = {
  adult: 'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]',
  child: 'border-[#BFDBFE] bg-[#EFF6FF] text-[#1D4ED8]',
  infant: 'border-[#E9D5FF] bg-[#FAF5FF] text-[#7E22CE]',
}

function PaxBandBadge({ ageBand, age }: { ageBand: GuestDetail['ageBand']; age?: number }) {
  const label =
    ageBand === 'child' && age != null ? `Child · ${age}` : ageBand === 'adult' ? 'Adult' : 'Infant'
  return (
    <span
      className={cn(
        'inline-flex rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.6px] border',
        PAX_BADGE_STYLES[ageBand],
      )}
    >
      {label}
    </span>
  )
}

function LeadBadge() {
  return (
    <span className="inline-flex rounded border border-[#BBF7D0] bg-[#F0FDF4] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.6px] text-[#15803D]">
      Lead
    </span>
  )
}

export function BookedByMetaRow({ contact }: { contact: BookedByContact }) {
  return (
    <div className="flex items-start justify-between gap-2.5 border-b border-[#EFEFEF] py-[7px]">
      <span className="shrink-0 text-[10.5px] text-[#8A8A8A]">Booked by</span>
      <div className="min-w-0 shrink text-right">
        <div className="text-[12.5px] font-semibold leading-snug text-[#101010]">{contact.name}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[#525252]">{contact.email}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[#525252]">{contact.phone}</div>
      </div>
    </div>
  )
}

export function BookingConsultantRow({ contact }: { contact: BookedByContact }) {
  return (
    <div className="flex items-start justify-between gap-6 border-t border-[#101010] py-[10px]">
      <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">
        Booking consultant
      </span>
      <div className="min-w-0 shrink text-right">
        <div className="text-[12.5px] font-semibold leading-snug text-[#101010]">{contact.name}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[#525252]">{contact.email}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-[#525252]">{contact.phone}</div>
      </div>
    </div>
  )
}

export function InvoicedToProfile({
  profile,
}: {
  profile: AgentInvoiceProfile | InvoiceAddresseeProfile
}) {
  const extended = profile as InvoiceAddresseeProfile
  return (
    <div className="py-2">
      <div className="text-[12.5px] font-semibold leading-snug text-[#101010]">{profile.legalName}</div>
      {profile.addressLines.length ? (
        <div className="mt-1 flex flex-col gap-0.5 whitespace-pre-wrap text-[11px] leading-relaxed text-[#525252]">
          {profile.addressLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : null}
      {extended.email ? (
        <div className="mt-1 text-[11px] leading-snug text-[#525252]">{extended.email}</div>
      ) : null}
      {extended.phone ? (
        <div className="mt-0.5 text-[11px] leading-snug text-[#525252]">{extended.phone}</div>
      ) : null}
    </div>
  )
}

export function GuestDetailsSection({ lines }: { lines: GuestDetailRow[] }) {
  return (
    <div>
      <div className="border-b border-[#101010] pb-1.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
        Guest details
      </div>
      {lines.length ? (
        <div className="mt-2 overflow-hidden border border-[#101010]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 border-b border-[#101010] px-3 py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
            <span>Guest</span>
            <span className="text-right">Pax</span>
          </div>
          {lines.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 border-b border-[#F0F0F0] px-3 py-[7px] last:border-b-0"
            >
              <span className="text-[11.5px] font-medium leading-snug text-[#3D3D3D]">{row.name}</span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <PaxBandBadge ageBand={row.ageBand} age={row.age} />
                {row.lead ? <LeadBadge /> : null}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <span className="mt-2 block text-xs text-[#8A8A8A]">Guest roster not captured</span>
      )}
    </div>
  )
}

export function BookingAgentSection({ block }: { block: BookingAgentBlock }) {
  return (
    <div>
      <div className="border-b border-[#101010] pb-1.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
        Booking agent
      </div>
      <div className="mt-2 text-[13px] font-semibold text-[#101010]">{block.name}</div>
      {block.addressLines.length ? (
        <div className="mt-0.5 flex flex-col gap-0.5 text-[11.5px] leading-relaxed text-[#555555]">
          {block.addressLines.map((line) => (
            <div key={line}>{line}</div>
          ))}
        </div>
      ) : (
        <div className="mt-0.5 text-[11.5px] text-[#555555]">—</div>
      )}
    </div>
  )
}

export function MetaRow({
  label,
  value,
  mono,
  accent,
  bold,
}: {
  label: string
  value: string
  mono?: boolean
  accent?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2.5 border-b border-[#EFEFEF] py-[7px]">
      <span className={cn('text-[10.5px]', accent ? 'text-[#931115]' : 'text-[#8A8A8A]')}>{label}</span>
      <span
        className={cn(
          'text-[12.5px]',
          mono && "font-['IBM_Plex_Mono'] text-[13px] font-medium",
          accent && 'font-semibold text-[#931115]',
          bold && 'font-semibold',
        )}
      >
        {value}
      </span>
    </div>
  )
}
