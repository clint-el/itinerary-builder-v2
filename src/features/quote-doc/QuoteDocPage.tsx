import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import {
  ChevronLeft,
  Download,
  Minus,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  balanceDueDate,
  buildLedgerCancellationRows,
  buildLedgerPaymentTerms,
  fmtLedgerAmount,
  fmtLedgerDateLong,
  fmtLedgerUsd,
  guestDetailLines,
  paxComposition,
  bookedByContact,
  bookingAgentBlock,
  quoteValidUntil,
} from '@/features/quote-doc/quoteLedgerModel'
import { BookedByMetaRow, BookingAgentSection, GuestDetailsSection } from '@/features/quote-doc/quoteCoverMeta'
import {
  buildDepositSummary,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
} from '@/features/summary/summaryModel'
import { DocumentLayoutPicker } from '@/features/quote-doc/DocumentLayoutPicker'
import {
  isTravelCounsellorsAgency,
  layoutModeFromPresentation,
  quotationCoverKindLabel,
  resolveQuoteDocumentOptions,
  type DocumentLayoutMode,
} from '@/features/quote-doc/documentOptionsModel'
import { isPackagedPresentation, presentationLabel } from '@/features/quote-doc/quotePackagedModel'
import { rateBasisLabel, rateBasisTag } from '@/features/quote-doc/quoteRateBasisModel'
import { DocumentSendDialog } from '@/features/quote-doc/DocumentSendDialog'
import { QuotePackagedContent } from '@/features/quote-doc/QuotePackagedContent'
import { QuoteTextEditor } from '@/features/quote-doc/QuoteTextEditor'
import { RichTextDocumentContent } from '@/features/quote-doc/RichTextDocumentContent'
import { QuoteTextSupplement } from '@/features/quote-doc/quoteTextBlocks'
import { resolveQuoteText } from '@/features/quote-doc/quoteTextModel'
import {
  isQuoteStale,
  renderModelFromLive,
  renderModelFromSnapshot,
  summaryLinesFromQuote,
} from '@/features/quote-doc/quoteSnapshotModel'
import type {
  QuoteRateBasis,
  QuoteRateBasisSelection,
  QuoteTextContent,
} from '@/shared/lib/types'
import { nightsBetween, partyGuests } from '@/shared/lib/helpers'
import type { AddedService, Hold } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

const PAGE_W = 794
const PAGE_H = 1123
const MAROON = '#580B0B'
const GRID_SCHEDULE = 'grid grid-cols-[52px_118px_minmax(0,1fr)_56px_26px_50px_72px_84px] gap-x-2'

type PageDef = { key: number; label: string }

export function QuoteDocPage() {
  const { id = '', quoteSeq: quoteSeqParam } = useParams()
  const navigate = useNavigate()
  const {
    itineraries,
    getServices,
    getQuoteGroups,
    getGuestDetails,
    getQuotes,
    generateQuote,
    sendQuote,
    upsertItinerary,
  } = useStore()
  const itinerary = itineraries.find((item) => item.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const guestDetails = getGuestDetails(id)
  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, guestDetails) : []),
    [itinerary, guestDetails],
  )

  const [zoom, setZoom] = useState(80)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [priceMode, setPriceMode] = useState<'total' | 'pp'>('pp')
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [activePage, setActivePage] = useState(1)
  const [flash, setFlash] = useState<string | null>(null)
  const [layoutMode, setLayoutMode] = useState<DocumentLayoutMode>('itemised')
  const [rateBasisSelection, setRateBasisSelection] = useState<QuoteRateBasisSelection>('nett')
  const [quoteText, setQuoteText] = useState<QuoteTextContent>(() => resolveQuoteText(itinerary?.quoteTextDraft))
  const [sendOpen, setSendOpen] = useState(false)
  const quotes = getQuotes(id)
  const draftPreviewBasis: QuoteRateBasis =
    rateBasisSelection === 'both' ? 'nett' : rateBasisSelection
  const currentFp = useMemo(() => itineraryCommercialFp(services), [services])
  const viewportRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDraftMode = quoteSeqParam === 'draft' || (!quoteSeqParam && quotes.length === 0)
  const activeQuote = useMemo(() => {
    if (isDraftMode) return undefined
    if (quoteSeqParam && quoteSeqParam !== 'draft') {
      const seq = Number.parseInt(quoteSeqParam, 10)
      if (!Number.isNaN(seq)) return quotes.find((quote) => quote.seq === seq)
    }
    if (quotes.length) return quotes.reduce((a, b) => (a.seq >= b.seq ? a : b))
    return undefined
  }, [isDraftMode, quoteSeqParam, quotes])

  const docOptions = useMemo(
    () => (itinerary ? resolveQuoteDocumentOptions(itinerary, { layoutMode }) : null),
    [itinerary, layoutMode],
  )
  const quoteStale = activeQuote ? isQuoteStale(activeQuote, currentFp) : false
  const snapshotLayoutMode = activeQuote
    ? layoutModeFromPresentation(activeQuote.presentation ?? 'B2B_ITEMISED')
    : null
  const useFrozenSnapshot =
    Boolean(activeQuote && itinerary && !quoteStale && snapshotLayoutMode === layoutMode)

  const renderModel = useMemo(() => {
    if (useFrozenSnapshot && activeQuote) {
      return renderModelFromSnapshot(activeQuote, quoteStale)
    }
    if (itinerary && docOptions) {
      return renderModelFromLive({
        itinerary,
        services,
        quoteGroups,
        guestDetails,
        presentation: docOptions.presentation,
        rateBasis: draftPreviewBasis,
        quoteText,
        showTerms: docOptions.showTerms,
        priceMode,
      })
    }
    return null
  }, [
    useFrozenSnapshot,
    activeQuote,
    quoteStale,
    draftPreviewBasis,
    guestDetails,
    itinerary,
    docOptions,
    priceMode,
    quoteGroups,
    quoteText,
    services,
  ])

  useEffect(() => {
    if (itinerary) setQuoteText(resolveQuoteText(itinerary.quoteTextDraft))
  }, [itinerary?.id, itinerary?.quoteTextDraft])

  useEffect(() => {
    if (activeQuote?.priceMode) setPriceMode(activeQuote.priceMode)
  }, [activeQuote?.priceMode, activeQuote?.id])

  const isTravelCounsellors = itinerary ? isTravelCounsellorsAgency(itinerary) : false

  useEffect(() => {
    if (isTravelCounsellors) {
      setLayoutMode('itemised')
      return
    }
    if (activeQuote?.presentation) setLayoutMode(layoutModeFromPresentation(activeQuote.presentation))
  }, [activeQuote?.presentation, isTravelCounsellors])

  useEffect(() => {
    if (activeQuote?.rateBasis) setRateBasisSelection(activeQuote.rateBasis)
  }, [activeQuote?.rateBasis])

  useEffect(() => {
    if (!isDraftMode) return
    if (itinerary?.lastQuoteRateBasisSelection) {
      setRateBasisSelection(itinerary.lastQuoteRateBasisSelection)
      return
    }
    if (quotes.length) {
      const latest = quotes.reduce((a, b) => (a.seq >= b.seq ? a : b))
      setRateBasisSelection(latest.rateBasis)
    }
  }, [isDraftMode, itinerary?.lastQuoteRateBasisSelection, quotes])

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

  const lines = useMemo(() => {
    if (activeQuote) return summaryLinesFromQuote(activeQuote)
    if (services.length) return linesFromServices(services, guests)
    if (quoteGroups.length) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [activeQuote, quoteGroups, services, guests])

  const totalGuests =
    guests.length ||
    (itinerary ? (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0) : 0)
  const pricing = useMemo(() => buildSummaryPricing(lines, totalGuests), [lines, totalGuests])
  const deposits = useMemo(() => buildDepositSummary(lines, renderModel?.sellTotal ?? pricing.sellNumber), [lines, pricing.sellNumber, renderModel?.sellTotal])
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

  const scheduleGroups = renderModel?.scheduleGroups ?? []
  const categoryGrid = renderModel?.categoryTotals ?? []
  const optionRows = renderModel?.optionRows ?? []
  const grossSell = renderModel?.grossSell ?? 0
  const sellTotal = renderModel?.sellTotal ?? pricing.sellNumber

  const isPackaged = isPackagedPresentation(renderModel?.presentation ?? docOptions?.presentation ?? 'B2B_ITEMISED')
  const rateTag = rateBasisTag(renderModel?.rateBasis ?? draftPreviewBasis)
  const termsOn = renderModel?.showTerms ?? docOptions?.showTerms ?? true
  const docQuoteText = renderModel?.quoteText ?? quoteText

  function persistQuoteText(next: QuoteTextContent) {
    if (!itinerary) return
    upsertItinerary({ ...itinerary, quoteTextDraft: next })
  }

  const pageDefs = useMemo<PageDef[]>(() => {
    if (isPackaged) {
      const base: PageDef[] = [
        { key: 1, label: 'Cover' },
        { key: 2, label: 'Schedule' },
        { key: 3, label: 'Totals' },
        { key: 4, label: 'Inclusions' },
      ]
      if (termsOn) base.push({ key: 5, label: 'Terms' })
      return base
    }
    const base: PageDef[] = [
      { key: 1, label: 'Cover' },
      { key: 2, label: 'Schedule' },
      { key: 3, label: 'Totals' },
      { key: 4, label: 'Inclusions' },
    ]
    if (termsOn) base.push({ key: 5, label: 'Terms' })
    return base
  }, [isPackaged, termsOn])

  const totalPages = pageDefs.length
  const versionLabel = renderModel?.versionLabel ?? ''
  const refLabel = renderModel?.refLabel ?? itinerary?.reference ?? id
  const validUntil = renderModel?.validUntil ?? quoteValidUntil(new Date().toISOString().slice(0, 10))
  const pricingDiscounts = renderModel?.pricingSummary.discounts ?? pricing.discounts.map((d) => ({
    label: d.label,
    amount: Number.parseFloat(d.sellDelta.replace(/[^0-9.-]/g, '')) || 0,
  }))

  if (!itinerary || !renderModel) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#3F3F46] text-white">
        <p className="text-sm text-white/70">Itinerary not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to inquiries</Link>
        </Button>
      </div>
    )
  }

  const adults =
    itinerary.adults ??
    itinerary.paxAdults ??
    (itinerary.adultsCitizen || 0) + (itinerary.adultsRes || 0) + (itinerary.adultsNonRes || 0)
  const children =
    itinerary.children ??
    itinerary.paxChildren ??
    (itinerary.childrenCitizen || 0) + (itinerary.childrenRes || 0) + (itinerary.childrenNonRes || 0)
  const infants =
    itinerary.infants ??
    (itinerary.infantsCitizen || 0) + (itinerary.infantsRes || 0) + (itinerary.infantsNonRes || 0)
  const nightsCount =
    nightsBetween(itinerary.travelDateFrom, itinerary.travelDateTo) ||
    lines.filter((l) => l.type === 'accommodation').reduce((sum, l) => sum + (l.nights || 0), 0)
  const daysCount = nightsCount ? nightsCount + 1 : 1
  const lead =
    [itinerary.leadFirst, itinerary.leadLast].filter(Boolean).join(' ') || 'Guest'
  const coverTitle = renderModel.coverTitle
  const issuedOn = fmtLedgerDateLong(
    (renderModel.generatedAt ?? new Date().toISOString()).slice(0, 10),
  )
  const balanceDue = balanceDueDate(itinerary.travelDateFrom || '')
  const perPerson = totalGuests ? sellTotal / totalGuests : 0
  const depositTotalLabel = activeQuote
    ? fmtLedgerAmount(renderModel.depositTotal)
    : deposits.depositTotal
  const depositBalanceLabel = activeQuote
    ? fmtLedgerAmount(renderModel.depositBalance)
    : deposits.depositBalance
  const depositPctLabel = activeQuote
    ? `${renderModel.depositPctOfSell}%`
    : `${deposits.depositPctOfSell}%`
  const countries =
    itinerary.destinations?.length
      ? itinerary.destinations.join(' · ')
      : itinerary.destination || '—'
  const guestLines = guestDetailLines(guests, guestDetails)
  const pendingHolds = services.reduce((count: number, service: AddedService) => {
    const holds = (service.draft?.holds as Hold[] | undefined) || []
    return count + holds.filter((hold) => hold.status === 'Requested').length
  }, 0)

  const showFlash = (message: string) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(message)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2500)
  }
  const scrollToPage = (key: number) => {
    setActivePage(key)
    viewportRef.current
      ?.querySelector<HTMLElement>(`[data-qd-page="${key}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const fitWidth = () => {
    const width = viewportRef.current?.clientWidth || 0
    if (width) setZoom(Math.max(40, Math.min(150, Math.floor(((width - 64) / PAGE_W) * 100))))
  }
  const handleGenerateQuote = () => {
    if (!docOptions) return
    const result = generateQuote(id, {
      generatedBy: itinerary.safariPlanner || 'Safari planner',
      presentation: docOptions.presentation,
      rateBasis: rateBasisSelection,
      quoteText,
      showTerms: docOptions.showTerms,
      priceMode,
    })
    if (!result) return
    setOptionsOpen(false)
    const docs = Array.isArray(result) ? result : [result]
    const latest = docs[docs.length - 1]
    navigate(`/quote-doc/${id}/${latest.seq}`)
    const pres = presentationLabel(latest.presentation).toLowerCase()
    if (docs.length > 1) {
      showFlash(
        `Quotes ${quotes.length ? 'regenerated' : 'generated'} as ${docs.map((d) => d.docNumber).join(' + ')} · ${pres} · rack + nett`,
      )
      return
    }
    showFlash(
      `Quote ${quotes.length ? 'regenerated' : 'generated'} as ${latest.docNumber} / ${latest.versionLabel} · ${pres} · ${rateBasisLabel(latest.rateBasis).toLowerCase()}`,
    )
  }

  return (
    <div className="qd-shell flex h-screen flex-col overflow-hidden bg-[#3F3F46] font-['IBM_Plex_Sans',system-ui,sans-serif] text-[#101010]">
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: #FFFFFF !important;
          }
          body, .qd-print-area, .qd-print-area * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .qd-chrome { display: none !important; }
          .qd-shell, .qd-scroll {
            height: auto !important;
            overflow: visible !important;
            padding: 0 !important;
            background: #FFFFFF !important;
          }
          .qd-print-area {
            transform: none !important;
            width: auto !important;
            margin: 0 !important;
          }
          .qd-page {
            box-shadow: none !important;
            margin: 0 !important;
            break-after: page;
            break-inside: avoid;
          }
          .qd-page:last-of-type { break-after: auto; }
        }
      `}</style>

      <div className="qd-chrome relative z-20 flex h-14 shrink-0 items-center gap-3.5 border-b bg-white px-4">
        <button
          type="button"
          onClick={() => navigate(`/summary/${id}`)}
          className="flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold text-[#525252] hover:bg-[#F9FAFB]"
        >
          <ChevronLeft className="size-4" /> Itinerary
        </button>
        <span className="h-6 w-px shrink-0 bg-[#E5E7EB]" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[13.5px] font-bold text-[#171717]">
            Quotation {itinerary.reference}
            {renderModel.docNumber ? ` · ${renderModel.docNumber}` : ''}
            {versionLabel ? ` · ${versionLabel}` : ''}
          </span>
          <span className="truncate text-[11.5px] text-[#A1A1A1]">
            {renderModel.mode === 'draft'
              ? `Preview (${presentationLabel(renderModel.presentation).toLowerCase()}) — not sent to agent`
              : `${isPackaged ? 'Packaged' : 'Ledger'} layout · generated ${issuedOn} by ${renderModel.generatedBy || itinerary.safariPlanner || 'Safari planner'}`}
          </span>
        </div>
        {renderModel.mode === 'draft' ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#EFF6FF] px-2.5 text-[11.5px] font-bold text-[#1D4ED8]">
            <span className="size-1.5 rounded-full bg-[#1D4ED8]" /> Preview
          </span>
        ) : renderModel.stale ? (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#FEF3C7] px-2.5 text-[11.5px] font-bold text-[#92400E]">
            <span className="size-1.5 rounded-full bg-[#92400E]" /> Stale
          </span>
        ) : (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#FDF2F2] px-2.5 text-[11.5px] font-bold text-[#931115]">
            <span className="size-1.5 rounded-full bg-[#931115]" /> Frozen
          </span>
        )}
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#F4F4F5] p-[3px]">
          <ZoomButton title="Zoom out" onClick={() => setZoom((value) => Math.max(40, value - 10))}>
            <Minus className="size-3.5" />
          </ZoomButton>
          <button
            type="button"
            title="Fit to width"
            onClick={fitWidth}
            className="h-[26px] min-w-12 rounded-md text-[12.5px] font-semibold hover:bg-white"
          >
            {zoom}%
          </button>
          <ZoomButton title="Zoom in" onClick={() => setZoom((value) => Math.min(150, value + 10))}>
            <Plus className="size-3.5" />
          </ZoomButton>
        </div>
        <div ref={optionsRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setOptionsOpen((open) => !open)}
            className="flex h-[34px] items-center gap-1.5 rounded-lg border px-3 text-[13px] font-semibold hover:bg-[#F9FAFB]"
          >
            <SlidersHorizontal className="size-4" /> Document options
          </button>
          {optionsOpen ? (
            <div className="absolute right-0 top-10 z-30 w-[308px] rounded-xl border bg-white p-4 shadow-xl">
              {docOptions ? (
                <>
                  <DocumentLayoutPicker
                    value={layoutMode}
                    onChange={setLayoutMode}
                    lockedMode={isTravelCounsellors ? 'itemised' : undefined}
                  />
                  <div className="my-3 h-px bg-[#E5E7EB]" />
                </>
              ) : null}
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Rate basis</p>
              <div className="flex flex-col gap-1.5">
                {([
                  ['rack', 'Rack — published prices'],
                  ['nett', 'Nett — agent wholesale'],
                  ['both', 'Both — Rack + Nett PDFs'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setRateBasisSelection(mode)}
                    className={cn(
                      'h-[32px] rounded-lg border px-3 text-left text-[12px] font-semibold',
                      rateBasisSelection === mode
                        ? 'border-[#931115] bg-[#FDF2F2] text-[#931115]'
                        : 'border-[#E5E7EB] text-[#525252]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {rateBasisSelection === 'both' ? (
                <p className="mt-2 text-[11.5px] leading-relaxed text-[#A1A1A1]">
                  Preview shows Nett. Generate creates two numbered quotes in one action.
                </p>
              ) : null}
              {!isPackaged ? (
                <>
                  <div className="my-3 h-px bg-[#E5E7EB]" />
                  <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Price display</p>
                  <div className="flex gap-1.5">
                    {([
                      ['total', 'Total only'],
                      ['pp', 'Per person + total'],
                    ] as const).map(([mode, label]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setPriceMode(mode)}
                        className={cn(
                          'h-[30px] flex-1 rounded-lg border text-[12px] font-semibold',
                          priceMode === mode
                            ? 'border-[#931115] bg-[#FDF2F2] text-[#931115]'
                            : 'border-[#E5E7EB] text-[#525252]',
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </>
              ) : null}
              <p className="mt-3 text-[11px] leading-relaxed text-[#737373]">
                Payment terms and cancellation are always included. Cost and margin are never shown on the client
                document.
              </p>
            </div>
          ) : null}
        </div>
        {isDraftMode && quotes.length ? (
          <Button
            variant="outline"
            className="h-[34px] shrink-0"
            onClick={() => navigate(`/quote-doc/${id}/${quotes.reduce((a, b) => (a.seq >= b.seq ? a : b)).seq}`)}
          >
            View latest quote
          </Button>
        ) : null}
        <Button variant="outline" className="h-[34px] shrink-0" onClick={handleGenerateQuote}>
          <RefreshCw className="size-3.5" /> {quotes.length ? 'Regenerate' : 'Generate quote'}
        </Button>
        {activeQuote ? (
          <Button variant="outline" className="h-[34px] shrink-0" onClick={() => setSendOpen(true)}>
            Send to agent
          </Button>
        ) : null}
        <Button className="h-[34px] shrink-0 bg-[#931115] hover:bg-[#7a0e12]" onClick={() => window.print()}>
          <Download className="size-3.5" /> Download PDF
        </Button>
      </div>

      {pendingHolds > 0 && !warningDismissed ? (
        <div className="qd-chrome flex shrink-0 items-center gap-2.5 border-b border-[#FDE68A] bg-[#FEF3C7] px-4 py-2.5">
          <TriangleAlert className="size-4 shrink-0 text-[#92400E]" />
          <span className="text-[12.5px] font-semibold text-[#92400E]">
            {pendingHolds} service hold{pendingHolds === 1 ? '' : 's'} on this itinerary. Confirm before the agent accepts.
          </span>
          <button
            type="button"
            onClick={() => navigate(`/build/${id}`)}
            className="text-[12.5px] font-bold text-[#92400E] underline"
          >
            Review holds
          </button>
          <div className="flex-1" />
          <button type="button" onClick={() => setWarningDismissed(true)} className="text-[#92400E]">
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="qd-shell flex min-h-0 flex-1">
        <div className="qd-chrome w-[132px] shrink-0 overflow-y-auto border-r border-[#18181B] bg-[#27272A] py-4">
          {quotes.length ? (
            <div className="mb-3 border-b border-white/10 px-3 pb-3">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-[1px] text-[#A1A1AA]">Quotes</div>
              <div className="flex flex-col gap-1">
                {[...quotes].reverse().map((quote) => {
                  const stale = isQuoteStale(quote, currentFp)
                  const active = activeQuote?.seq === quote.seq && !isDraftMode
                  return (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => navigate(`/quote-doc/${id}/${quote.seq}`)}
                      className={cn(
                        'rounded-md px-2 py-1.5 text-left text-[10.5px]',
                        active ? 'bg-[#3F3F46] text-white' : 'text-[#D4D4D8] hover:bg-[#3F3F46]/60',
                      )}
                    >
                      <div className="font-semibold">{quote.docNumber} · {quote.versionLabel}</div>
                      <div className="truncate text-[9.5px] text-[#A1A1AA]">
                        {presentationLabel(quote.presentation ?? 'B2B_ITEMISED')} · {rateBasisLabel(quote.rateBasis)} · {fmtLedgerUsd(quote.sellTotal)}
                      </div>
                      {stale ? (
                        <span className="mt-0.5 inline-block rounded bg-[#FEF3C7] px-1 py-px text-[8.5px] font-bold text-[#92400E]">
                          Stale
                        </span>
                      ) : null}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => navigate(`/quote-doc/${id}/draft`)}
                  className={cn(
                    'rounded-md px-2 py-1.5 text-left text-[10.5px]',
                    isDraftMode ? 'bg-[#3F3F46] text-white' : 'text-[#D4D4D8] hover:bg-[#3F3F46]/60',
                  )}
                >
                  <div className="font-semibold">Preview</div>
                  <div className="text-[9.5px] text-[#A1A1AA]">Live itinerary</div>
                </button>
              </div>
            </div>
          ) : null}
          {pageDefs.map((page, index) => {
            const active = activePage === page.key
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => scrollToPage(page.key)}
                className={cn('flex w-full flex-col items-start gap-1.5 px-3 py-2.5', active && 'bg-[#3F3F46]')}
              >
                <span
                  className={cn(
                    'block h-[105px] w-[74px] overflow-hidden rounded-[3px] bg-white shadow-[0_2px_8px_rgba(0,0,0,.4)] outline',
                    active ? 'outline-2 outline-[#931115]' : 'outline-1 outline-white/10',
                  )}
                >
                  <span
                    className="block h-[18px]"
                    style={{ background: page.key === 1 ? MAROON : MAROON, height: page.key === 1 ? '46px' : '10px' }}
                  />
                  <span className="mx-2.5 mt-2 block h-1.5 w-3/5 rounded-sm bg-[#E5E7EB]" />
                  <span className="mx-2.5 mt-1 block h-1 w-4/5 rounded-sm bg-[#EFEFF1]" />
                  <span className="mx-2.5 mt-1 block h-1 w-3/4 rounded-sm bg-[#EFEFF1]" />
                </span>
                <span className={cn('text-left text-[10.5px] font-semibold', active ? 'text-white' : 'text-[#A1A1AA]')}>
                  {index + 1} · {page.label}
                </span>
              </button>
            )
          })}
        </div>

        {isDraftMode ? (
          <div className="qd-chrome w-[300px] shrink-0 overflow-y-auto border-r border-[#18181B] bg-[#FAFAFA] p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-[#737373]">Quote text</div>
            <QuoteTextEditor value={quoteText} onChange={setQuoteText} onPersist={persistQuoteText} />
          </div>
        ) : null}

        <div ref={viewportRef} className="qd-scroll min-w-0 flex-1 overflow-auto py-7">
          <div
            className="qd-print-area mx-auto flex flex-col items-center gap-7"
            style={{ width: PAGE_W, transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
          >
            {isPackaged ? (
              <QuotePackagedContent
                itinerary={itinerary}
                renderModel={renderModel}
                refLabel={refLabel}
                versionLabel={versionLabel}
                coverTitle={coverTitle}
                issuedOn={issuedOn}
                validUntil={validUntil}
                daysCount={daysCount}
                nightsCount={nightsCount}
                totalGuests={totalGuests}
                adults={adults}
                children={children}
                infants={infants}
                lead={lead}
                countries={countries}
                guests={guests}
                guestDetails={guestDetails}
                showTerms={termsOn}
                totalPages={totalPages}
                paymentTerms={paymentTerms}
                cancellationRows={cancellationRows}
                optionRows={optionRows}
              />
            ) : null}

            {!isPackaged ? (
            <>
            {/* COVER */}
            <section
              data-qd-page="1"
              className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              style={{ width: PAGE_W, height: PAGE_H }}
            >
              <div className="flex h-[296px] shrink-0 flex-col justify-between p-9 px-14" style={{ background: MAROON }}>
                <div className="flex items-start justify-between gap-6">
                  <img
                    src="/assets/CPS.png"
                    alt="Cheli & Peacock Safaris"
                    className="block h-auto w-44 brightness-0 invert"
                  />
                  <div className="text-right">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#C79393]">
                      {quotationCoverKindLabel(isTravelCounsellors, false)}
                    </div>
                    <div className="mt-0.5 font-['IBM_Plex_Mono'] text-lg font-medium text-white">{refLabel}</div>
                  </div>
                </div>
                <h1 className="m-0 text-[38px] font-semibold leading-[1.1] tracking-[-0.8px] text-white">
                  {coverTitle}
                  <br />
                  <span className="text-xl font-normal tracking-normal text-[#E9CFCF]">
                    {daysCount} days · {nightsCount} nights
                  </span>
                </h1>
              </div>

              <div className="flex flex-1 flex-col px-14 pb-9 pt-[26px]">
                <div className="grid grid-cols-3 border-t border-[#101010]">
                  <MetaColumn title="Document">
                    <MetaRow label="Reference" value={itinerary.reference} mono />
                    <MetaRow label="Version" value={versionLabel || '—'} mono />
                    <MetaRow label="Issued" value={issuedOn} mono />
                    <MetaRow label="Valid until" value={validUntil} mono accent />
                  </MetaColumn>
                  <MetaColumn title="Travel dates" bordered>
                    <MetaRow
                      label="Arrival"
                      value={itinerary.travelDateFrom ? fmtLedgerDateLong(itinerary.travelDateFrom) : 'TBC'}
                      mono
                    />
                    <MetaRow
                      label="Departure"
                      value={itinerary.travelDateTo ? fmtLedgerDateLong(itinerary.travelDateTo) : 'TBC'}
                      mono
                    />
                    <MetaRow label="Duration" value={`${daysCount} d · ${nightsCount} n`} mono />
                    <MetaRow label="Countries" value={countries} />
                  </MetaColumn>
                  <MetaColumn title="PAX details" last>
                    <MetaRow label="Guests" value={String(totalGuests || '—')} mono />
                    <MetaRow label="Composition" value={paxComposition(adults, children, infants)} mono />
                    <MetaRow label="Lead guest" value={lead} />
                    <BookedByMetaRow contact={bookedByContact(itinerary)} />
                  </MetaColumn>
                </div>

                <div className="mt-8 grid grid-cols-2 gap-7">
                  <div>
                    <BookingAgentSection block={bookingAgentBlock(itinerary)} />
                  </div>
                  <GuestDetailsSection lines={guestLines} />
                </div>

                <div className="mt-8 flex items-center justify-between gap-5 border border-[#101010] px-[22px] py-5">
                  <div>
                    <SectionLabel>Safari total</SectionLabel>
                    <div className="mt-1 text-[11.5px] text-[#555555]">
                      {rateTag} · {totalGuests || '—'} guest{totalGuests === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="font-['IBM_Plex_Mono'] text-[32px] font-semibold tracking-[-0.5px]">
                    {fmtLedgerUsd(sellTotal)}
                  </div>
                </div>

                <div className="flex-1" />
                <PageFooter
                  left="info@chelipeacock.com · +254 730 721 000"
                  right={`1 / ${totalPages}`}
                />
              </div>
            </section>

            {/* SCHEDULE */}
            <section
              data-qd-page="2"
              className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              style={{ width: PAGE_W, minHeight: PAGE_H }}
            >
              <LedgerHeader title="Schedule of services" refLabel={refLabel} />
              <div className="flex flex-1 flex-col px-14 pb-8 pt-[30px]">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="m-0 text-[21px] font-semibold tracking-[-0.3px]">Safari Quotation</h2>
                  <span className="text-[10px] font-semibold uppercase tracking-[1.4px] text-[#931115]">
                    {rateTag}
                  </span>
                </div>

                <div
                  className={cn(
                    GRID_SCHEDULE,
                    'mt-4 border-b border-t border-[#101010] py-[7px] text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]',
                  )}
                >
                  <span>Date</span>
                  <span>Supplier</span>
                  <span>Service</span>
                  <span className="text-center">Pax</span>
                  <span className="text-center">Qty</span>
                  <span className="text-center">Duration</span>
                  <span className="text-right">Unit price</span>
                  <span className="text-right">Amount</span>
                </div>

                {scheduleGroups.length ? (
                  scheduleGroups.map((group) => (
                    <div key={group.name}>
                      <div className="flex items-baseline justify-between gap-2.5 border-b border-[#EDEDED] py-2 pb-1">
                        <span className="text-[9.5px] font-semibold uppercase tracking-[1.3px]" style={{ color: MAROON }}>
                          {group.name}
                        </span>
                        <span className="text-[11px] font-semibold" style={{ color: MAROON }}>
                          {fmtLedgerAmount(group.subtotal)}
                        </span>
                      </div>
                      {group.rows.map((row, i) => (
                        <div
                          key={`${group.name}-${i}`}
                          className={cn(GRID_SCHEDULE, 'border-b border-[#F5F5F5] py-[5px] text-[10.5px] leading-snug')}
                        >
                          <span className="font-['IBM_Plex_Mono'] text-[#6E6E6E]">{row.date}</span>
                          <span className="font-semibold">{row.supplier}</span>
                          <span className="text-[#3D3D3D]">{row.service}</span>
                          <span className="text-center text-[#6E6E6E]">{row.pax}</span>
                          <span className="text-center font-['IBM_Plex_Mono'] text-[#6E6E6E]">{row.qty}</span>
                          <span className="text-center font-['IBM_Plex_Mono'] text-[#6E6E6E]">{row.duration}</span>
                          <span className="text-right font-['IBM_Plex_Mono'] text-[#6E6E6E]">{fmtLedgerAmount(row.unitPrice)}</span>
                          <span className="text-right font-medium">{fmtLedgerAmount(row.amount)}</span>
                        </div>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="py-8 text-[13px] text-[#8A8A8A]">No services have been added to this itinerary yet.</p>
                )}

                <div className="flex-1" />
                <PageFooter
                  left="Cost and margin are never shown on the client document."
                  right={`2 / ${totalPages}`}
                  bordered
                />
              </div>
            </section>

            {/* TOTALS */}
            <section
              data-qd-page="3"
              className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              style={{ width: PAGE_W, height: PAGE_H }}
            >
              <LedgerHeader title="Totals and payment" refLabel={refLabel} />
              <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
                <div className="grid grid-cols-6 border border-[#101010]">
                  {categoryGrid.map((cat, i) => (
                    <div
                      key={cat.name}
                      className={cn(
                        'col-span-2 px-4 py-3.5',
                        i % 3 !== 2 && 'border-r border-[#E4E4E4]',
                        i >= 3 && 'border-t border-[#E4E4E4]',
                      )}
                    >
                      <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">{cat.name}</div>
                      <div className="mt-1 font-['IBM_Plex_Mono'] text-[15px] font-medium">{fmtLedgerAmount(cat.amount)}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-[22px]">
                  <DottedTotalRow label="Itinerary subtotal" amount={fmtLedgerAmount(grossSell)} />
                  {pricingDiscounts.map((d) => (
                    <DottedTotalRow
                      key={d.label}
                      label={d.label}
                      amount={`−${fmtLedgerAmount(Math.abs(d.amount))}`}
                      accent="#0369A1"
                    />
                  ))}
                </div>

                <div className="mt-5 flex items-end justify-between gap-5 border border-[#101010] bg-[#101010] px-[22px] py-[18px] text-white">
                  <div>
                    <div className="text-[9.5px] font-semibold uppercase tracking-[1.6px] text-[#B5B5B5]">Safari total</div>
                    <div className="mt-1 text-[11px] text-[#B5B5B5]">
                      {rateTag} · {totalGuests} guest{totalGuests === 1 ? '' : 's'}
                      {priceMode === 'pp' && totalGuests ? ` · ${fmtLedgerUsd(perPerson)} per person` : ''}
                    </div>
                  </div>
                  <div className="font-['IBM_Plex_Mono'] text-[34px] font-semibold tracking-[-0.8px]">
                    {fmtLedgerAmount(sellTotal)}
                  </div>
                </div>

                <div className="mt-7">
                  <SectionLabel>Payment schedule</SectionLabel>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                    <span>Instalment</span>
                    <span>Basis</span>
                    <span className="text-right">Amount</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F5F5F5] py-2 text-[11.5px]">
                    <span className="font-semibold">Deposit on acceptance</span>
                    <span className="text-[11px] text-[#6E6E6E]">
                      Supplier terms · {depositPctLabel} of total
                    </span>
                    <span className="text-right font-medium">{depositTotalLabel}</span>
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_200px_110px] gap-x-3 border-b border-[#F5F5F5] py-2 text-[11.5px]">
                    <span className="font-semibold">Balance</span>
                    <span className="text-[11px] text-[#6E6E6E]">60 days before arrival · {balanceDue}</span>
                    <span className="text-right font-medium">{depositBalanceLabel}</span>
                  </div>
                </div>

                <p className="mt-6 text-[11px] leading-relaxed text-[#8A8A8A]">
                  Unit rate types differ across the itinerary — per person per day, per person per unit, per unit — so
                  the per-person figure is an average across the party rather than a rate charged to any one guest.
                </p>

                <div className="mt-6">
                  <SectionLabel>Guest price split</SectionLabel>
                  <div className="mt-2 grid grid-cols-4 gap-3">
                    <PaxSplitCell label="Total adults" value={String(renderModel.paxPriceSplit.totalAdults)} />
                    <PaxSplitCell label="Total children" value={String(renderModel.paxPriceSplit.totalChildren)} />
                    <PaxSplitCell label="Total adult price" value={fmtLedgerUsd(renderModel.paxPriceSplit.totalAdultPrice)} />
                    <PaxSplitCell label="Total child price" value={fmtLedgerUsd(renderModel.paxPriceSplit.totalChildPrice)} />
                  </div>
                </div>

                <div className="flex-1" />
                <PageFooter left={`Quote valid until ${validUntil}`} right={`3 / ${totalPages}`} bordered />
              </div>
            </section>

            {/* INCLUSIONS */}
            <section
              data-qd-page="4"
              className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
              style={{ width: PAGE_W, minHeight: PAGE_H }}
            >
              <LedgerHeader title="Inclusions and exclusions" refLabel={refLabel} />
              <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
                <h2 className="m-0 mb-[18px] text-[21px] font-semibold tracking-[-0.3px]">
                  Safari Inclusions &amp; Exclusions
                </h2>

                <div className="grid grid-cols-2 border border-[#101010]">
                  <div className="border-r border-[#E4E4E4] px-5 py-[18px]">
                    <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">
                      General inclusions
                    </div>
                    <RichTextDocumentContent
                      html={docQuoteText.generalInclusionsHtml}
                      variant="plain"
                      className="mt-3 text-[#3D3D3D]"
                    />
                  </div>
                  <div className="px-5 py-[18px]">
                    <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">
                      General exclusions
                    </div>
                    <RichTextDocumentContent
                      html={docQuoteText.generalExclusionsHtml}
                      variant="plain"
                      className="mt-3 text-[#3D3D3D]"
                    />
                  </div>
                </div>

                <QuoteTextSupplement quoteText={docQuoteText} />

                <p className="mt-3.5 text-[11px] leading-relaxed text-[#8A8A8A]">
                  These items are not included in bed and breakfast, half board or day room bookings. Inclusions and
                  exclusions specific to each supplier service option are set out below.
                </p>

                <div className="mt-[26px]">
                  <SectionLabel>Supplier Service options</SectionLabel>
                  <div className="mt-2 grid grid-cols-[120px_88px_88px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                    <span>Supplier</span>
                    <span>Service</span>
                    <span>Option</span>
                    <span>Includes</span>
                    <span>Excludes</span>
                  </div>
                  {optionRows.length ? (
                    optionRows.map((row) => (
                      <div
                        key={`${row.supplier}-${row.service}-${row.option}`}
                        className="grid grid-cols-[120px_88px_88px_minmax(0,1fr)_minmax(0,1fr)] gap-x-3 border-b border-[#F5F5F5] py-2.5 text-[11px] leading-snug"
                      >
                        <span className="font-semibold">{row.supplier}</span>
                        <span className="text-[#3D3D3D]">{row.service}</span>
                        <span className="text-[#3D3D3D]">{row.option}</span>
                        <span className="text-[#3D3D3D]">{row.includes}</span>
                        <span className="text-[#3D3D3D]">{row.excludes}</span>
                      </div>
                    ))
                  ) : (
                    <p className="py-4 text-[12px] text-[#8A8A8A]">Add services to populate per-option inclusions.</p>
                  )}
                </div>

                <div className="flex-1" />
                <PageFooter left="Full per-option terms continue on request" right={`4 / ${totalPages}`} bordered />
              </div>
            </section>

            {/* TERMS */}
            {termsOn ? (
              <section
                data-qd-page="5"
                className="qd-page flex shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]"
                style={{ width: PAGE_W, minHeight: PAGE_H }}
              >
                <LedgerHeader title="Payment terms and cancellation" refLabel={refLabel} />
                <div className="flex flex-1 flex-col px-14 pb-8 pt-[34px]">
                  <h2 className="m-0 mb-1.5 text-[21px] font-semibold tracking-[-0.3px]">
                    Supplier Payment Terms &amp; Cancellation Policies
                  </h2>
                  <p className="m-0 mb-5 text-[11px] leading-relaxed text-[#8A8A8A]">
                    Each supplier sets its own terms for the travel dates quoted. The payment schedule on page 3 takes
                    the strictest of them — the highest deposit and the earliest balance date across the itinerary — so
                    a single deposit settles every booking.
                  </p>

                  <SectionLabel>Payment terms</SectionLabel>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                    <span>Supplier / term</span>
                    <span>Travel dates</span>
                    <span className="text-right">Deposit</span>
                    <span className="text-right">Balance due</span>
                    <span className="text-right">Tax code</span>
                  </div>
                  {paymentTerms.rows.map((row) => (
                    <div
                      key={row.supplier}
                      className="grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-b border-[#F5F5F5] py-2.5 text-[11px] leading-snug"
                    >
                      <span>
                        <b>{row.supplier}</b>
                        <br />
                        <span className="text-[#8A8A8A]">{row.term}</span>
                      </span>
                      <span className="font-['IBM_Plex_Mono'] text-[10px] text-[#3D3D3D]">{row.travelDates}</span>
                      <span className="text-right font-['IBM_Plex_Mono']">{row.deposit}</span>
                      <span className="text-right text-[#3D3D3D]">{row.balanceDue}</span>
                      <span className="text-right text-[10px] text-[#8A8A8A]">{row.taxCode}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[minmax(0,1fr)_128px_62px_96px_62px] gap-x-3 border-t border-[#101010] py-2 text-[11px]">
                    <span className="font-semibold">Applied to this itinerary</span>
                    <span className="text-[10px] text-[#8A8A8A]">Strictest across suppliers</span>
                    <span className="text-right font-['IBM_Plex_Mono'] font-semibold">{paymentTerms.appliedDeposit}</span>
                    <span className="text-right font-semibold">{paymentTerms.appliedBalance}</span>
                    <span />
                  </div>

                  <div className="mt-[26px]">
                    <SectionLabel>Supplier cancellation policies</SectionLabel>
                    <div className="mt-2 grid grid-cols-[148px_124px_104px_minmax(0,1fr)] gap-x-3.5 border-b border-[#F0F0F0] py-2 text-[8.5px] font-semibold uppercase tracking-[0.9px] text-[#8A8A8A]">
                      <span>Supplier / contract</span>
                      <span>Policy</span>
                      <span>Travel dates</span>
                      <span>Charge if cancelled</span>
                    </div>
                    {cancellationRows.length ? (
                      cancellationRows.map((row) => (
                        <div
                          key={row.supplier}
                          className="grid grid-cols-[148px_124px_104px_minmax(0,1fr)] gap-x-3.5 border-b border-[#F5F5F5] py-[11px] text-[11px] leading-snug"
                        >
                          <span>
                            <b>{row.supplier}</b>
                            <br />
                            <span className="text-[#8A8A8A]">{row.description}</span>
                          </span>
                          <span>
                            {row.policy}
                            <br />
                            <span className={cn('text-[10px]', row.refundableTone === 'blue' ? 'text-[#0369A1]' : 'text-[#931115]')}>
                              {row.refundableLabel}
                            </span>
                          </span>
                          <span className="pt-px font-['IBM_Plex_Mono'] text-[10px] text-[#6E6E6E]">{row.travelDates}</span>
                          <span className="flex flex-col gap-1">
                            {row.charges.map((charge) => (
                              <div key={charge.label} className="grid grid-cols-[minmax(0,1fr)_62px] gap-x-2.5 leading-snug">
                                <span className="text-[#3D3D3D]">{charge.label}</span>
                                <span className="text-right font-['IBM_Plex_Mono'] font-medium">{charge.amount}</span>
                              </div>
                            ))}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-[12px] text-[#8A8A8A]">Supplier cancellation policies appear once suppliers are on the itinerary.</p>
                    )}
                  </div>

                  <p className="mt-4 text-[11px] leading-relaxed text-[#8A8A8A]">
                    Charges are a percentage of the service value unless shown as a cash amount. Where a policy is marked
                    non-refundable, no part of the service value is recoverable once the first charge band begins. Days
                    are counted against the travel date of the service concerned, not the start of the safari.
                  </p>

                  <div className="flex-1" />
                  <PageFooter
                    left="Terms are those held against each supplier contract at the date of this quote"
                    right={`5 / ${totalPages}`}
                    bordered
                  />
                </div>
              </section>
            ) : null}
            </>
            ) : null}
          </div>
        </div>
      </div>

      {flash ? (
        <div className="qd-chrome fixed bottom-6 right-6 z-[95] flex items-center gap-2.5 rounded-lg bg-[#171717] px-4 py-3 text-[13.5px] font-semibold text-white shadow-2xl">
          <span className="text-[#00D492]">✓</span>
          {flash}
        </div>
      ) : null}

      <DocumentSendDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title={`Send ${activeQuote?.docNumber ?? 'quote'} to agent`}
        description="Delivery is recorded on the quote and in the itinerary activity log."
        defaultRecipient={itinerary?.agent || ''}
        onSend={(recipient) => {
          if (!activeQuote) return
          const result = sendQuote(id, activeQuote.seq, recipient)
          showFlash(result.ok ? `Sent ${activeQuote.docNumber} to ${recipient}` : result.reason || 'Send failed')
        }}
      />
    </div>
  )
}

function LedgerHeader({ title, refLabel }: { title: string; refLabel: string }) {
  return (
    <div
      className="flex h-[42px] shrink-0 items-center justify-between px-14"
      style={{ background: MAROON }}
    >
      <span className="text-[9.5px] font-semibold uppercase tracking-[2px] text-[#E9CFCF]">{title}</span>
      <span className="font-['IBM_Plex_Mono'] text-[11px] text-[#DFB9B9]">{refLabel}</span>
    </div>
  )
}

function MetaColumn({
  title,
  children,
  bordered,
  last,
}: {
  title: string
  children: React.ReactNode
  bordered?: boolean
  last?: boolean
}) {
  return (
    <div
      className={cn(
        'py-2.5',
        bordered && 'border-x border-[#E4E4E4] px-[18px]',
        last ? 'pl-[18px]' : 'pr-[18px]',
      )}
    >
      <div className="text-[9px] font-semibold uppercase tracking-[1.2px] text-[#931115]">{title}</div>
      <div className="mt-2 flex flex-col">{children}</div>
    </div>
  )
}

function MetaRow({
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-[#101010] pb-1.5 text-[9px] font-semibold uppercase tracking-[1.2px] text-[#8A8A8A]">
      {children}
    </div>
  )
}

function PageFooter({ left, right, bordered }: { left: string; right: string; bordered?: boolean }) {
  return (
    <div
      className={cn(
        'flex justify-between text-[10.5px] text-[#8A8A8A]',
        bordered && 'border-t border-[#E4E4E4] pt-2.5',
      )}
    >
      <span>{left}</span>
      <span className="font-['IBM_Plex_Mono']">{right}</span>
    </div>
  )
}

function DottedTotalRow({
  label,
  amount,
  accent,
}: {
  label: string
  amount: string
  accent?: string
}) {
  return (
    <div className="flex items-baseline gap-2.5 border-b border-[#EDEDED] py-2.5">
      <span className="text-xs text-[#3D3D3D]">{label}</span>
      <span className="flex-1 translate-y-[-3px] border-b border-dotted border-[#C9C9C9]" />
      <span
        className="font-['IBM_Plex_Mono'] text-[12.5px] font-medium"
        style={{ color: accent || '#101010' }}
      >
        {amount}
      </span>
    </div>
  )
}

function PaxSplitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</div>
      <div className="mt-0.5 font-['IBM_Plex_Mono'] text-[13px] font-semibold">{value}</div>
    </div>
  )
}

function ZoomButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className="flex h-[26px] w-7 items-center justify-center rounded-md text-[#525252] hover:bg-white">
      {children}
    </button>
  )
}

