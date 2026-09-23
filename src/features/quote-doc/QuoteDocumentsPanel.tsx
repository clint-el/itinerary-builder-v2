import { Link } from 'react-router-dom'
import { ExternalLink, Printer } from 'lucide-react'
import { fmtLedgerUsd } from '@/features/quote-doc/quoteLedgerModel'
import { presentationLabel } from '@/features/quote-doc/quotePackagedModel'
import { rateBasisLabel } from '@/features/quote-doc/quoteRateBasisModel'
import { isQuoteStale } from '@/features/quote-doc/quoteSnapshotModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { QuoteDocument } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

function fmtGeneratedAt(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso.slice(0, 10)
  }
}

export function QuoteDocumentsPanel({
  itineraryId,
  quotes,
  currentFingerprint,
}: {
  itineraryId: string
  quotes: QuoteDocument[]
  currentFingerprint: string
}) {
  if (!quotes.length) {
    return (
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">Quote documents</h2>
        <p className="mt-2 text-[13px] text-[#737373]">
          No quotes generated yet. Open the quote PDF and use Generate quote to create Q1.
        </p>
        <Button asChild variant="outline" className="mt-4 h-9">
          <Link to={`/quote-doc/${itineraryId}/draft`}>Preview quote</Link>
        </Button>
      </section>
    )
  }

  const latest = quotes.reduce((a, b) => (a.seq >= b.seq ? a : b))

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[#171717]">Quote documents</h2>
          <p className="mt-1 text-[13px] text-[#737373]">
            {quotes.length} frozen snapshot{quotes.length === 1 ? '' : 's'} · latest {latest.docNumber}
          </p>
        </div>
        <Button asChild variant="outline" className="h-9">
          <Link to={`/quote-doc/${itineraryId}/${latest.seq}`}>
            <ExternalLink className="size-3.5" />
            Open latest
          </Link>
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-[#E5E7EB]">
        <div className="grid grid-cols-[64px_64px_88px_56px_1fr_96px_80px_108px] gap-3 border-b bg-[#FAFAFA] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
          <span>Quote</span>
          <span>Version</span>
          <span>Format</span>
          <span>Basis</span>
          <span>Generated</span>
          <span className="text-right">Total</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
        {[...quotes].reverse().map((quote) => {
          const stale = isQuoteStale(quote, currentFingerprint)
          return (
            <div
              key={quote.id}
              className="grid grid-cols-[64px_64px_88px_56px_1fr_96px_80px_108px] items-center gap-3 border-b px-4 py-3 text-[13px] last:border-b-0"
            >
              <span className="font-semibold">{quote.docNumber}</span>
              <span className="font-['IBM_Plex_Mono'] text-[12px]">{quote.versionLabel}</span>
              <span className="text-[12px] text-[#525252]">
                {presentationLabel(quote.presentation ?? 'B2B_ITEMISED')}
              </span>
              <span className="text-[12px] text-[#525252]">{rateBasisLabel(quote.rateBasis)}</span>
              <span className="min-w-0 truncate text-[#525252]">
                {fmtGeneratedAt(quote.generatedAt)}
                <span className="text-[#A1A1A1]"> · {quote.generatedBy}</span>
                <span className="block text-[11px] text-[#737373]">
                  {quote.lastSentAt ? `Sent ${fmtGeneratedAt(quote.lastSentAt)}` : 'Not sent yet'}
                </span>
              </span>
              <span className="text-right font-['IBM_Plex_Mono'] font-medium">
                {fmtLedgerUsd(quote.sellTotal)}
              </span>
              <span>
                <Badge
                  className={cn(
                    'rounded-md px-2 py-0 text-[11px] font-semibold',
                    stale
                      ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
                      : 'border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]',
                  )}
                  variant="outline"
                >
                  {stale ? 'Stale' : 'Active'}
                </Badge>
              </span>
              <span className="flex justify-end gap-1.5">
                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                  <Link to={`/quote-doc/${itineraryId}/${quote.seq}`}>
                    <ExternalLink className="size-3.5" />
                    Open
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="sm" className="h-8 px-2">
                  <Link to={`/quote-doc/${itineraryId}/${quote.seq}`} target="_blank">
                    <Printer className="size-3.5" />
                    Print
                  </Link>
                </Button>
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
