import { RichTextEditor } from '@/features/quote-doc/RichTextEditor'
import { defaultQuoteText } from '@/features/quote-doc/quoteTextModel'
import type { QuoteTextContent } from '@/shared/lib/types'

export function QuoteTextEditor({
  value,
  onChange,
  onPersist,
  includeInvoiceTerms,
}: {
  value: QuoteTextContent
  onChange: (next: QuoteTextContent) => void
  onPersist: (next: QuoteTextContent) => void
  /** General cancellation policy — invoice terms page only. */
  includeInvoiceTerms?: boolean
}) {
  const draft = value ?? defaultQuoteText()

  function update(partial: Partial<QuoteTextContent>) {
    const next = { ...draft, ...partial }
    onChange(next)
    onPersist(next)
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[#E5E7EB] bg-white p-4">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">General inclusions</div>
        <RichTextEditor
          value={draft.generalInclusionsHtml}
          onChange={(generalInclusionsHtml) => update({ generalInclusionsHtml })}
          minHeight={140}
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">General exclusions</div>
        <RichTextEditor
          value={draft.generalExclusionsHtml}
          onChange={(generalExclusionsHtml) => update({ generalExclusionsHtml })}
          minHeight={120}
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Safari specific notes</div>
        <RichTextEditor
          value={draft.notesHtml}
          onChange={(notesHtml) => update({ notesHtml })}
          placeholder="Safari-specific planner notes printed on the document…"
          minHeight={90}
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">General notes</div>
        <RichTextEditor
          value={draft.standingCommercialHtml}
          onChange={(standingCommercialHtml) => update({ standingCommercialHtml })}
          minHeight={80}
        />
      </div>
      {includeInvoiceTerms ? (
        <>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
            General payment terms
          </div>
          <RichTextEditor
            value={draft.generalPaymentTermsHtml ?? ''}
            onChange={(generalPaymentTermsHtml) => update({ generalPaymentTermsHtml })}
            placeholder="Agency-wide payment wording for this invoice…"
            minHeight={100}
          />
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
            General cancellation policy
          </div>
          <RichTextEditor
            value={draft.generalCancellationPolicyHtml ?? ''}
            onChange={(generalCancellationPolicyHtml) => update({ generalCancellationPolicyHtml })}
            placeholder="Agency-wide cancellation wording for this invoice…"
            minHeight={100}
          />
        </div>
        </>
      ) : null}
    </div>
  )
}
