import {
  defaultQuoteText,
  parseQuoteTextLines,
  quoteTextLinesToText,
} from '@/features/quote-doc/quoteTextModel'
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
        <p className="mt-1 text-[11px] text-[#737373]">One item per line — frozen into the generated PDF.</p>
        <textarea
          value={quoteTextLinesToText(draft.generalInclusions)}
          onChange={(e) => update({ generalInclusions: parseQuoteTextLines(e.target.value) })}
          rows={6}
          className="mt-2 w-full resize-y rounded-lg border border-[#E5E7EB] px-2.5 py-2 font-mono text-[11.5px] leading-relaxed"
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">General exclusions</div>
        <textarea
          value={quoteTextLinesToText(draft.generalExclusions)}
          onChange={(e) => update({ generalExclusions: parseQuoteTextLines(e.target.value) })}
          rows={5}
          className="mt-2 w-full resize-y rounded-lg border border-[#E5E7EB] px-2.5 py-2 font-mono text-[11.5px] leading-relaxed"
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Notes</div>
        <textarea
          value={draft.notes}
          onChange={(e) => update({ notes: e.target.value })}
          rows={3}
          placeholder="Planner notes printed on the document…"
          className="mt-2 w-full resize-y rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[12px] leading-relaxed"
        />
      </div>
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Standing commercial copy</div>
        <textarea
          value={draft.standingCommercial ?? ''}
          onChange={(e) => update({ standingCommercial: e.target.value })}
          rows={2}
          className="mt-2 w-full resize-y rounded-lg border border-[#E5E7EB] px-2.5 py-2 text-[12px] leading-relaxed"
        />
      </div>
    </div>
  )
}
