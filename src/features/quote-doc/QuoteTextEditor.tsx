import { RichTextEditor } from '@/features/quote-doc/RichTextEditor'
import { defaultQuoteText } from '@/features/quote-doc/quoteTextModel'
import type { QuoteTextContent } from '@/shared/lib/types'

export function QuoteTextEditor({
  value,
  onChange,
  onPersist,
}: {
  value: QuoteTextContent
  onChange: (next: QuoteTextContent) => void
  onPersist: (next: QuoteTextContent) => void
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
        <p className="mt-1 text-[11px] text-[#737373]">Rich text — frozen into the generated PDF.</p>
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
      <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#737373]">
          Notes &amp; standing commercial copy
        </div>
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#A1A1A1]">Notes</div>
          <RichTextEditor
            value={draft.notesHtml}
            onChange={(notesHtml) => update({ notesHtml })}
            placeholder="Planner notes printed on the document…"
            minHeight={90}
          />
        </div>
        <div className="mt-3">
          <div className="text-[10px] font-bold uppercase tracking-wide text-[#A1A1A1]">Standing commercial copy</div>
          <RichTextEditor
            value={draft.standingCommercialHtml}
            onChange={(standingCommercialHtml) => update({ standingCommercialHtml })}
            minHeight={80}
          />
        </div>
      </div>
    </div>
  )
}
