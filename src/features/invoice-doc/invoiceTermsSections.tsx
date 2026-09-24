import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import type { LedgerCancellationRow, buildLedgerPaymentTerms } from '@/features/quote-doc/quoteLedgerModel'
import { hasRichTextContent } from '@/features/quote-doc/quoteTextModel'
import type { QuoteTextContent } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

function TermsSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-[#101010] pb-1.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
      {children}
    </div>
  )
}

export function PerSupplierPaymentTermsTable({
  paymentTerms,
}: {
  paymentTerms: ReturnType<typeof buildLedgerPaymentTerms>
}) {
  return (
    <>
      <TermsSectionLabel>Per-supplier payment terms</TermsSectionLabel>
      <div className="mt-2 border border-[#101010]">
        <div className="grid grid-cols-[1fr_100px_100px] gap-2 border-b border-[#EFEFEF] px-4 py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
          <span>Supplier</span>
          <span>Deposit</span>
          <span>Balance due</span>
        </div>
        {paymentTerms.rows.map((row) => (
          <div
            key={row.supplier}
            className="grid grid-cols-[1fr_100px_100px] gap-2 border-b border-[#EFEFEF] px-4 py-3 text-[11px] last:border-b-0"
          >
            <span className="font-semibold">{row.supplier}</span>
            <span>{row.deposit}</span>
            <span>{row.balanceDue}</span>
          </div>
        ))}
      </div>
    </>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] font-semibold uppercase tracking-[0.8px] text-[#8A8A8A]">{children}</div>
  )
}

/** Mirrors builder cancellation policy fields: name, description, travel dates, refundable, penalty rules. */
export function SupplierCancellationPolicyCard({ row }: { row: LedgerCancellationRow }) {
  return (
    <div className="border border-[#E4E4E4] px-4 py-3 text-[11px] leading-relaxed text-[#3D3D3D]">
      <FieldLabel>Supplier</FieldLabel>
      <p className="mt-1 font-semibold text-[#101010]">{row.supplier}</p>

      <div className="mt-3">
        <FieldLabel>Policy name</FieldLabel>
        <p className="mt-1 text-[12px] font-semibold text-[#101010]">{row.policy}</p>
      </div>

      {row.description ? (
        <div className="mt-3">
          <FieldLabel>Description</FieldLabel>
          <p className="mt-1 whitespace-pre-wrap text-[#525252]">{row.description}</p>
        </div>
      ) : null}

      <div className="mt-3">
        <FieldLabel>Travel dates</FieldLabel>
        <p className="mt-1 text-[#525252]">{row.travelDates}</p>
      </div>

      <div className="mt-3">
        <FieldLabel>Refundable</FieldLabel>
        <p className="mt-1">
          <span
            className={cn(
              'font-semibold',
              row.refundableTone === 'blue' ? 'text-[#0369A1]' : 'text-[#931115]',
            )}
          >
            {row.refundableLabel}
          </span>
        </p>
      </div>

      {row.ruleLines.length ? (
        <div className="mt-3">
          <FieldLabel>Penalty rules</FieldLabel>
          <ul className="mt-1.5 space-y-1.5">
            {row.ruleLines.map((line, index) => (
              <li
                key={`${row.supplier}-rule-${index}`}
                className="rounded-md bg-[#F9FAFB] px-2.5 py-1.5 text-[11px] text-[#171717]"
              >
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export function GeneralCancellationPolicySection({ quoteText }: { quoteText: QuoteTextContent }) {
  if (!hasRichTextContent(quoteText.generalCancellationPolicyHtml)) return null
  return (
    <div className="mt-7">
      <TermsSectionLabel>General cancellation policy</TermsSectionLabel>
      <RichTextDocumentContent
        html={quoteText.generalCancellationPolicyHtml!}
        variant="muted"
        className="mt-2"
      />
    </div>
  )
}
