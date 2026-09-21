import { Link } from 'react-router-dom'
import { ExternalLink, Printer } from 'lucide-react'
import { fmtLedgerUsd } from '@/features/quote-doc/quoteLedgerModel'
import {
  isInvoiceStale,
  lifecycleStageLabel,
} from '@/features/invoice-doc/invoiceSnapshotModel'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { InvoiceDocument } from '@/shared/lib/types'
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

export function InvoiceDocumentPanel({
  itineraryId,
  invoice,
  currentFingerprint,
  canGenerate,
}: {
  itineraryId: string
  invoice?: InvoiceDocument
  currentFingerprint: string
  canGenerate: boolean
}) {
  if (!invoice) {
    return (
      <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
        <h2 className="text-[15px] font-bold text-[#171717]">Invoice document</h2>
        <p className="mt-2 text-[13px] text-[#737373]">
          No invoice generated yet.{' '}
          {canGenerate
            ? 'Preview the draft invoice, then use Generate invoice on that page.'
            : 'You can preview the draft layout below. Generate invoice becomes available once the itinerary is Approved.'}
        </p>
        <Button asChild variant="outline" className="mt-4 h-9">
          <Link to={`/invoice-doc/${itineraryId}`}>Preview draft invoice</Link>
        </Button>
      </section>
    )
  }

  const stale = isInvoiceStale(invoice, currentFingerprint)
  const pos = invoice.paymentPosition

  return (
    <section className="rounded-xl border border-[#E5E7EB] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[#171717]">Invoice document</h2>
          <p className="mt-1 text-[13px] text-[#737373]">
            {invoice.invoiceNumber} · {lifecycleStageLabel(invoice.lifecycleStage)} · updated {fmtGeneratedAt(invoice.generatedAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="h-9">
            <Link to={`/invoice-doc/${itineraryId}`}>
              <ExternalLink className="size-3.5" />
              Open
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-9">
            <Link to={`/invoice-doc/${itineraryId}`} target="_blank">
              <Printer className="size-3.5" />
              Print
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total" value={fmtLedgerUsd(pos.total)} />
        <Stat label="Paid" value={fmtLedgerUsd(pos.paid)} />
        <Stat label="Balance" value={fmtLedgerUsd(pos.balance)} />
        <Stat label="Due now" value={fmtLedgerUsd(pos.amountDueImmediately)} emphasis />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            'rounded-md px-2 py-0 text-[11px] font-semibold',
            stale
              ? 'border-[#FDE68A] bg-[#FEF3C7] text-[#92400E]'
              : 'border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]',
          )}
          variant="outline"
        >
          {stale ? 'Stale — update required' : 'Active'}
        </Badge>
        {invoice.revisions.length ? (
          <span className="text-[12px] text-[#737373]">
            {invoice.revisions.length} revision{invoice.revisions.length === 1 ? '' : 's'} in audit log
          </span>
        ) : null}
      </div>
    </section>
  )
}

function Stat({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-3 py-2.5', emphasis ? 'border-[#FECACA] bg-[#FEF9F9]' : 'border-[#E5E7EB]')}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#737373]">{label}</div>
      <div className={cn("mt-0.5 font-['IBM_Plex_Mono'] text-[14px] font-semibold", emphasis ? 'text-[#931115]' : 'text-[#171717]')}>
        {value}
      </div>
    </div>
  )
}
