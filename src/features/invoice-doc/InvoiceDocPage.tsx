import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import { ChevronLeft, Download, Mail, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  buildLedgerCancellationRows,
  buildLedgerPaymentTerms,
  fmtLedgerDateLong,
} from '@/features/quote-doc/quoteLedgerModel'
import { DocumentSendDialog } from '@/features/quote-doc/DocumentSendDialog'
import { QuotePackagedContent } from '@/features/quote-doc/QuotePackagedContent'
import { QuoteTextEditor } from '@/features/quote-doc/QuoteTextEditor'
import { presentationLabel } from '@/features/quote-doc/quotePackagedModel'
import { resolveQuoteText } from '@/features/quote-doc/quoteTextModel'
import { InvoiceLedgerContent } from '@/features/invoice-doc/InvoiceLedgerContent'
import {
  invoiceAsQuoteRenderModel,
  isInvoiceStale,
  lifecycleStageLabel,
  renderModelFromLive,
  renderModelFromSnapshot,
} from '@/features/invoice-doc/invoiceSnapshotModel'
import {
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
} from '@/features/summary/summaryModel'
import type { InvoiceLifecycleStage, QuotePresentation, QuoteTextContent } from '@/shared/lib/types'
import { nightsBetween, partyGuests } from '@/shared/lib/helpers'
import { cn } from '@/shared/lib/utils'

const PAGE_W = 794

type PageDef = { key: number; label: string }

export function InvoiceDocPage() {
  const { id = '' } = useParams()
  const {
    itineraries,
    getServices,
    getQuoteGroups,
    getGuestDetails,
    getInvoice,
    generateInvoice,
    sendInvoice,
    upsertItinerary,
  } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const guestDetails = getGuestDetails(id)
  const invoice = getInvoice(id)
  const currentFp = useMemo(() => itineraryCommercialFp(services), [services])

  const zoom = 100
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showTerms, setShowTerms] = useState(true)
  const [stage, setStage] = useState<InvoiceLifecycleStage>('deposit')
  const [presentation, setPresentation] = useState<QuotePresentation>('B2B_ITEMISED')
  const [quoteText, setQuoteText] = useState<QuoteTextContent>(() => resolveQuoteText(itinerary?.quoteTextDraft))
  const [sendOpen, setSendOpen] = useState(false)
  const [activePage, setActivePage] = useState(1)
  const [flash, setFlash] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDraftMode = !invoice
  const stale = invoice ? isInvoiceStale(invoice, currentFp) : false

  const renderModel = useMemo(() => {
    if (invoice && itinerary) return renderModelFromSnapshot(invoice, stale)
    if (itinerary) {
      return renderModelFromLive({
        itinerary,
        services,
        quoteGroups,
        guestDetails,
        stage,
        presentation,
        quoteText,
        showTerms,
      })
    }
    return null
  }, [invoice, itinerary, stale, services, quoteGroups, guestDetails, stage, presentation, quoteText, showTerms])

  useEffect(() => {
    if (invoice?.lifecycleStage) setStage(invoice.lifecycleStage)
    if (invoice?.presentation) setPresentation(invoice.presentation)
    if (invoice?.showTerms !== undefined) setShowTerms(invoice.showTerms)
  }, [invoice?.lifecycleStage, invoice?.presentation, invoice?.showTerms])

  useEffect(() => {
    if (itinerary) setQuoteText(resolveQuoteText(itinerary.quoteTextDraft, invoice?.quoteText))
  }, [itinerary?.id, itinerary?.quoteTextDraft, invoice?.quoteText])

  useEffect(() => {
    if (!optionsOpen) return
    const close = (event: MouseEvent) => {
      if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) setOptionsOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [optionsOpen])

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    [],
  )

  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, guestDetails) : []),
    [itinerary, guestDetails],
  )
  const lines = useMemo(() => {
    if (services.length) return linesFromServices(services, guests)
    if (quoteGroups.length) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [services, quoteGroups, guests])

  const totalGuests =
    guests.length ||
    (itinerary ? (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0) : 0)
  const pricing = useMemo(() => buildSummaryPricing(lines, totalGuests), [lines, totalGuests])
  const paymentTerms = useMemo(() => buildLedgerPaymentTerms(lines), [lines])
  const cancellationRows = useMemo(
    () =>
      buildLedgerCancellationRows(
        lines,
        itinerary?.travelDateFrom || '',
        itinerary?.travelDateTo || '',
      ),
    [lines, itinerary?.travelDateFrom, itinerary?.travelDateTo],
  )

  const isPackaged = (renderModel?.presentation ?? presentation) === 'B2B_PACKAGED'
  const termsOn = invoice ? (renderModel?.showTerms ?? true) : showTerms

  const pageDefs = useMemo<PageDef[]>(() => {
    if (isPackaged) {
      const base: PageDef[] = [
        { key: 1, label: 'Cover' },
        { key: 2, label: 'Includes' },
        { key: 3, label: 'Totals' },
      ]
      if (termsOn) base.push({ key: 4, label: 'Terms' })
      return base
    }
    const base: PageDef[] = [
      { key: 1, label: 'Cover' },
      { key: 2, label: 'Schedule' },
      { key: 3, label: 'Payment' },
      { key: 4, label: 'Inclusions' },
    ]
    if (termsOn) base.push({ key: 5, label: 'Terms' })
    return base
  }, [isPackaged, termsOn])

  const totalPages = pageDefs.length
  const refLabel = renderModel?.refLabel ?? `${id} · draft`
  const invoiceNumber = renderModel?.invoiceNumber ?? `${id}-INV`
  const coverTitle = renderModel?.coverTitle ?? itinerary?.title ?? 'Safari'
  const issuedOn = renderModel?.invoiceDate
    ? fmtLedgerDateLong(renderModel.invoiceDate)
    : fmtLedgerDateLong(new Date().toISOString().slice(0, 10))
  const grossSell = renderModel?.grossSell ?? 0
  const sellTotal = renderModel?.sellTotal ?? pricing.sellNumber
  const pricingDiscounts = renderModel?.pricingSummary.discounts ?? pricing.discounts.map((d) => ({
    label: d.label,
    amount: Number.parseFloat(d.sellDelta.replace(/[^0-9.-]/g, '')) || 0,
  }))
  const optionRows = renderModel?.optionRows ?? []

  const daysCount =
    (itinerary?.travelDateFrom && itinerary?.travelDateTo
      ? Math.max(1, nightsBetween(itinerary.travelDateFrom, itinerary.travelDateTo) + 1)
      : 0) || 0
  const nightsCount =
    nightsBetween(itinerary?.travelDateFrom || '', itinerary?.travelDateTo || '') || 0
  const lead =
    [itinerary?.leadFirst, itinerary?.leadLast].filter(Boolean).join(' ') || 'Lead traveler TBC'
  const countries =
    (itinerary?.destinations && itinerary.destinations.length
      ? itinerary.destinations.join(', ')
      : itinerary?.destination) || '—'

  if (!itinerary) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#3F3F46] text-white">
        <p>Itinerary not found.</p>
      </div>
    )
  }

  const canGenerate = ['APPROVED', 'INVOICED', 'VOUCHERED', 'CONFIRMED'].includes(itinerary.status)
  const financeBlocked = itinerary.financeLocked

  function showFlash(message: string) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(message)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2800)
  }

  function scrollToPage(key: number) {
    setActivePage(key)
    viewportRef.current
      ?.querySelector<HTMLElement>(`[data-inv-page="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function persistQuoteText(next: QuoteTextContent) {
    if (!itinerary) return
    upsertItinerary({ ...itinerary, quoteTextDraft: next })
  }

  function handleGenerateInvoice() {
    if (financeBlocked) {
      showFlash('Invoice generation is blocked while Finance Lock is engaged')
      return
    }
    const doc = generateInvoice(id, {
      stage,
      generatedBy: itinerary!.safariPlanner || 'Safari planner',
      presentation,
      quoteText,
      showTerms,
      transitionToInvoiced: itinerary!.status === 'APPROVED',
    })
    if (!doc) {
      showFlash('Could not generate invoice')
      return
    }
    setOptionsOpen(false)
    showFlash(
      invoice
        ? `Invoice ${doc.invoiceNumber} updated · ${presentationLabel(doc.presentation ?? 'B2B_ITEMISED').toLowerCase()} · ${lifecycleStageLabel(doc.lifecycleStage).toLowerCase()}`
        : `Invoice ${doc.invoiceNumber} generated · ${presentationLabel(doc.presentation ?? 'B2B_ITEMISED').toLowerCase()} · ${lifecycleStageLabel(doc.lifecycleStage).toLowerCase()}`,
    )
  }

  return (
    <div className="inv-shell flex h-screen flex-col overflow-hidden bg-[#3F3F46] font-['IBM_Plex_Sans',system-ui,sans-serif] text-[#101010]">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          .inv-chrome { display: none !important; }
          .inv-scroll { overflow: visible !important; padding: 0 !important; }
          .inv-print-area { transform: none !important; gap: 0 !important; }
          .inv-page { box-shadow: none !important; page-break-after: always; }
        }
      `}</style>

      <div className="inv-chrome flex shrink-0 items-center gap-3 border-b border-[#18181B] bg-[#27272A] px-4 py-2.5">
        <Link
          to={`/summary/${id}`}
          className="flex h-[34px] items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-[#D4D4D8] hover:bg-[#3F3F46]"
        >
          <ChevronLeft className="size-4" />
          Summary
        </Link>
        <div className="h-5 w-px bg-[#52525B]" />
        <span className="text-[13px] font-semibold text-white">{itinerary.reference}</span>
        <span className="text-[12px] text-[#A1A1AA]">
          {isDraftMode
            ? `Draft preview (${lifecycleStageLabel(stage).toLowerCase()})`
            : `${invoiceNumber}${stale ? ' · stale' : ''}`}
        </span>
        <div className="flex-1" />
        <div ref={optionsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            className="flex h-[34px] items-center gap-1.5 rounded-lg border border-[#52525B] px-3 text-[13px] font-semibold text-[#D4D4D8] hover:bg-[#3F3F46]"
          >
            <SlidersHorizontal className="size-4" /> Document options
          </button>
          {optionsOpen ? (
            <div className="absolute right-0 top-10 z-30 w-[280px] rounded-xl border bg-white p-4 shadow-xl">
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Presentation</p>
              <div className="mb-3 flex flex-col gap-1.5">
                {([
                  ['B2B_ITEMISED', 'Itemised (Ledger)'],
                  ['B2B_PACKAGED', 'Packaged (Includes only)'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPresentation(mode)}
                    className={cn(
                      'h-[32px] rounded-lg border px-3 text-left text-[12px] font-semibold',
                      presentation === mode
                        ? 'border-[#931115] bg-[#FDF2F2] text-[#931115]'
                        : 'border-[#E5E7EB] text-[#525252]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Lifecycle stage</p>
              <div className="flex flex-col gap-1.5">
                {([
                  ['deposit', 'Deposit — full value, deposit in terms'],
                  ['full', 'Full — entire balance due now'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setStage(mode)}
                    className={cn(
                      'h-[32px] rounded-lg border px-3 text-left text-[12px] font-semibold',
                      stage === mode
                        ? 'border-[#931115] bg-[#FDF2F2] text-[#931115]'
                        : 'border-[#E5E7EB] text-[#525252]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="my-3 h-px bg-[#E5E7EB]" />
              <OptionToggle label="Payment terms & cancellation" on={showTerms} onClick={() => setShowTerms((v) => !v)} />
            </div>
          ) : null}
        </div>
        {canGenerate ? (
          <Button
            variant="outline"
            className="h-[34px] shrink-0 border-[#52525B] bg-transparent text-[#D4D4D8] hover:bg-[#3F3F46]"
            disabled={financeBlocked}
            onClick={handleGenerateInvoice}
          >
            <RefreshCw className="size-3.5" /> {invoice ? 'Update invoice' : 'Generate invoice'}
          </Button>
        ) : null}
        {invoice ? (
          <Button
            variant="outline"
            className="h-[34px] shrink-0 border-[#52525B] bg-transparent text-[#D4D4D8] hover:bg-[#3F3F46]"
            onClick={() => setSendOpen(true)}
          >
            <Mail className="size-3.5" /> Send to agent
          </Button>
        ) : null}
        <Button className="h-[34px] shrink-0 bg-[#931115] hover:bg-[#7a0e12]" onClick={() => window.print()}>
          <Download className="size-3.5" /> Download PDF
        </Button>
      </div>

      {financeBlocked ? (
        <div className="inv-chrome flex shrink-0 items-center gap-2.5 border-b border-[#FECACA] bg-[#FEF2F2] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-[#B91C1C]">
            Finance Lock is engaged — invoice generation is blocked.
          </span>
        </div>
      ) : null}

      {stale && invoice ? (
        <div className="inv-chrome flex shrink-0 items-center gap-2.5 border-b border-[#FDE68A] bg-[#FEF3C7] px-4 py-2.5">
          <span className="text-[12.5px] font-semibold text-[#92400E]">
            Invoice is out of date — update before sending to the agent.
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={handleGenerateInvoice}>
            Update invoice
          </Button>
        </div>
      ) : null}

      <div className="inv-shell flex min-h-0 flex-1">
        <div className="inv-chrome w-[132px] shrink-0 overflow-y-auto border-r border-[#18181B] bg-[#27272A] py-4">
          {invoice?.revisions.length ? (
            <div className="mb-3 border-b border-white/10 px-3 pb-3">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[1px] text-[#A1A1AA]">Revisions</div>
              <div className="flex flex-col gap-1">
                {[...invoice.revisions].reverse().slice(0, 4).map((rev) => (
                  <div key={rev.id} className="rounded-md px-2 py-1.5 text-[9.5px] text-[#D4D4D8]">
                    <div className="font-semibold">{rev.at.slice(0, 10)}</div>
                    <div className="truncate text-[#A1A1AA]">{rev.summary}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {pageDefs.map((page, index) => (
            <button
              key={page.key}
              type="button"
              onClick={() => scrollToPage(page.key)}
              className={cn(
                'flex w-full flex-col items-center gap-1.5 px-3 py-2.5',
                activePage === page.key && 'bg-[#3F3F46]',
              )}
            >
              <span className={cn('text-center text-[10.5px] font-semibold', activePage === page.key ? 'text-white' : 'text-[#A1A1AA]')}>
                {index + 1} · {page.label}
              </span>
            </button>
          ))}
        </div>

        {isDraftMode ? (
          <div className="inv-chrome w-[300px] shrink-0 overflow-y-auto border-r border-[#18181B] bg-[#FAFAFA] p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#737373]">Invoice text</div>
            <QuoteTextEditor value={quoteText} onChange={setQuoteText} onPersist={persistQuoteText} />
          </div>
        ) : null}

        <div ref={viewportRef} className="inv-scroll min-w-0 flex-1 overflow-auto py-7">
          <div
            className="inv-print-area mx-auto flex flex-col items-center gap-7"
            style={{ width: PAGE_W, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {renderModel && isPackaged ? (
              <QuotePackagedContent
                itinerary={itinerary}
                renderModel={invoiceAsQuoteRenderModel(renderModel)}
                refLabel={refLabel}
                versionLabel={invoiceNumber}
                coverTitle={coverTitle}
                issuedOn={issuedOn}
                validUntil={renderModel.invoiceDate}
                daysCount={daysCount}
                nightsCount={nightsCount}
                totalGuests={totalGuests}
                adults={itinerary.adults || 0}
                children={itinerary.children || 0}
                infants={itinerary.infants || 0}
                lead={lead}
                countries={countries}
                guests={guests}
                guestDetails={guestDetails}
                showTerms={termsOn}
                totalPages={totalPages}
                paymentTerms={paymentTerms}
                cancellationRows={cancellationRows}
                optionRows={optionRows}
                totalsFooterLeft={`Invoice date ${issuedOn}`}
              />
            ) : null}
            {renderModel && !isPackaged ? (
              <InvoiceLedgerContent
                itinerary={itinerary}
                renderModel={renderModel}
                refLabel={refLabel}
                invoiceNumber={invoiceNumber}
                coverTitle={coverTitle}
                issuedOn={issuedOn}
                daysCount={daysCount}
                nightsCount={nightsCount}
                totalGuests={totalGuests}
                lead={lead}
                countries={countries}
                guests={guests}
                guestDetails={guestDetails}
                showTerms={termsOn}
                totalPages={totalPages}
                paymentTerms={paymentTerms}
                cancellationRows={cancellationRows}
                optionRows={optionRows}
                pricingDiscounts={pricingDiscounts}
                grossSell={grossSell}
                sellTotal={sellTotal}
              />
            ) : null}
          </div>
        </div>
      </div>

      {flash ? (
        <div className="inv-chrome fixed bottom-6 right-6 z-[95] flex items-center gap-2.5 rounded-lg bg-[#171717] px-4 py-3 text-[13.5px] font-semibold text-white shadow-2xl">
          <span className="text-[#00D492]">✓</span>
          {flash}
        </div>
      ) : null}

      <DocumentSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={`Send ${invoiceNumber} to agent`}
        description="Delivery is recorded on the invoice and in the itinerary activity log."
        defaultRecipient={itinerary.agent || ''}
        onSend={(recipient) => {
          const result = sendInvoice(id, recipient)
          showFlash(result.ok ? `Sent ${invoiceNumber} to ${recipient}` : result.reason || 'Send failed')
        }}
      />
    </div>
  )
}

function OptionToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2 text-[12px] font-semibold text-[#525252]"
    >
      {label}
      <span className={cn('rounded px-2 py-0.5 text-[10px]', on ? 'bg-[#DCFCE7] text-[#166534]' : 'bg-[#F4F4F5] text-[#737373]')}>
        {on ? 'On' : 'Off'}
      </span>
    </button>
  )
}
