import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'
import { VoucherAnswerForm } from './VoucherAnswerForm'
import type { VoucherCard } from './summaryModel'

/**
 * Exactly what the supplier's confirmation page (and the preview) renders — cost-only, one
 * template for both so the email/link and the PDF filing copy can never disagree (BR-27).
 */
export function VoucherRecipientBody({
  card,
  bookingRef,
  readOnly,
  submitLabel,
  courtesyNameField,
  onSubmit,
}: {
  card: VoucherCard
  bookingRef: string
  readOnly: boolean
  submitLabel?: string
  courtesyNameField?: boolean
  onSubmit?: (ticks: Record<string, boolean>, reasons: Record<string, string>, courtesyName?: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">Confirmation request</div>
          <h1 className="mt-0.5 text-xl font-bold text-[#171717]">{card.supplier}</h1>
          <div className="mt-1 text-[13px] text-[#525252]">
            {card.ref} · {card.dateRange}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">Total payable (cost)</div>
          <div className="text-[19px] font-bold text-[#171717]">{card.total}</div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 text-[13px] sm:grid-cols-4">
        <Field label="Booking">{bookingRef}</Field>
        <Field label="Lead guest">{card.leadGuest || '—'}</Field>
        <Field label="Party">{card.partyMix}</Field>
        <Field label="Agency">{card.agency || '—'}</Field>
      </section>

      {card.rooms.length ? (
        <section>
          <SectionTitle>Rooming</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {card.rooms.map((r, i) => (
              <div key={i} className="flex items-baseline justify-between gap-3 rounded-lg border border-[#F1F1F3] px-3 py-2">
                <span className="text-[13px] font-semibold text-[#171717]">{r.room}</span>
                <span className="min-w-0 flex-1 truncate px-3 text-[12.5px] text-[#525252]" title={r.who}>
                  {r.who}
                </span>
                <span className="whitespace-nowrap text-[11.5px] text-[#A1A1A1]">{r.meta}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div className="text-[12.5px] text-[#A1A1A1]">This supplier has no accommodation on this trip.</div>
      )}

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <SectionTitle>Guest requirements</SectionTitle>
          <span className="text-[11.5px] text-[#A1A1A1]">{card.guestCoverageLabel}</span>
        </div>
        <div className="flex flex-col gap-1">
          {card.guestRoster.map((g) => (
            <div key={g.name} className="flex items-baseline justify-between gap-3 border-b border-[#F3F4F6] py-1.5 last:border-0">
              <span className="min-w-0 shrink-0 text-[12.5px] font-semibold text-[#171717]">
                {g.name} <span className="font-normal text-[#A1A1A1]">· {g.role}</span>
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 truncate text-right text-[12.5px]',
                  g.status === 'not_captured' ? 'italic text-[#A1A1A1]' : 'text-[#525252]',
                )}
              >
                {g.text}
              </span>
            </div>
          ))}
        </div>
      </section>

      {card.note ? (
        <section>
          <SectionTitle>Note from your planner</SectionTitle>
          <p className="rounded-lg border border-[#F1F1F3] bg-[#FAFAFB] px-3 py-2.5 text-[13px] leading-relaxed text-[#525252]">
            {card.note}
          </p>
        </section>
      ) : null}

      <section>
        <SectionTitle>Service lines to confirm</SectionTitle>
        <VoucherAnswerForm
          card={card}
          readOnly={readOnly}
          submitLabel={submitLabel}
          courtesyNameField={courtesyNameField}
          onSubmit={onSubmit}
        />
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-4 py-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">Payment terms</div>
          <div className="mt-0.5 text-[12.5px] text-[#525252]">{card.depositRule}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">Deposit</div>
          <div className="text-[14px] font-bold text-[#931115]">
            {card.deposit} <span className="font-normal text-[#A1A1A1]">· {card.depositDue}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">{children}</div>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">{label}</div>
      <div className="truncate text-[13px] font-semibold text-[#171717]" title={typeof children === 'string' ? children : undefined}>
        {children}
      </div>
    </div>
  )
}
