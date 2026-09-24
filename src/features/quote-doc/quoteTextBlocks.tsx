import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import { hasRichTextContent, resolveQuoteText } from '@/features/quote-doc/quoteTextModel'
import type { QuoteTextContent } from '@/shared/lib/types'

export function QuoteTextSupplement({ quoteText }: { quoteText: QuoteTextContent }) {
  const resolved = resolveQuoteText(quoteText)
  const notes = resolved.notesHtml
  const standingCommercial = resolved.standingCommercialHtml
  const hasNotes = hasRichTextContent(notes)

  return (
    <div className="mt-[26px] border-t border-[#EFEFEF] pt-[26px]">
      <div>
        <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
          Safari specific notes
        </div>
        {hasNotes ? (
          <RichTextDocumentContent html={notes} variant="muted" className="mt-2" />
        ) : (
          <p className="mt-2 text-[11px] text-[#A1A1AA]">No safari specific notes added.</p>
        )}
      </div>

      <div className="mt-4 border-t border-[#EFEFEF] pt-3">
        <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
          General notes
        </div>
        <RichTextDocumentContent html={standingCommercial} variant="muted" className="mt-2" />
      </div>
    </div>
  )
}
