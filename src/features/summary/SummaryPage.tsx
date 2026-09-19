import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  FileText,
  History,
  List,
  Lock,
  Ticket,
} from 'lucide-react'
import { useStore } from '@/app/store'
import {
  GuestDetailsSheet,
  GuestsToolbarButton,
  guestIssueHint,
} from '@/features/guests/GuestDetailsSheet'
import { Button } from '@/components/ui/button'
import {
  depthOf,
  isBuilderStatus,
  isTerminalStatus,
  nightsBetween,
  parentReference,
  partyGuests,
  statusMeta,
  transitions,
} from '@/shared/lib/helpers'
import {
  evaluateTransition,
  isStructureLocked,
  itineraryCommercialFp,
  roleAllowsVoucherAction,
} from '@/shared/lib/lifecycleRules'
import type { LifecycleTransition } from '@/shared/lib/types'
import { cn, formatDay } from '@/shared/lib/utils'
import { StatusChip } from '@/shared/ui/StatusChip'
import {
  buildDepositSummary,
  buildLifecycleActivityLog,
  buildPaymentHistory,
  buildPriceGroups,
  buildSummaryCards,
  buildSummaryDayGroups,
  buildSummaryPricing,
  buildVouchers,
  holdsSummaryOf,
  linesFromQuoteGroups,
  linesFromServices,
  voucherOutstandingSummary,
  type PriceDisplayMode,
  type SummaryCard,
  type SummaryCellTone,
  type SummaryTable,
  type VoucherValueMode,
} from './summaryModel'
import { VouchersView } from './VouchersView'

function transitionButtonClass(t: LifecycleTransition) {
  if (t.primary) return 'bg-sol-brand text-white hover:bg-sol-brand/90'
  if (t.danger) return 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
  return 'border border-border bg-white text-neutral-900 hover:bg-neutral-50'
}

const TONE_CLASS: Record<SummaryCellTone, string> = {
  plain: '',
  date: 'text-[12.5px] text-[#737373]',
  name: 'font-semibold',
  meta: 'text-[12.5px]',
  hold: 'text-[11.5px] font-semibold',
  cost: 'tabular-nums',
  sell: 'font-semibold tabular-nums',
  margin: 'text-[12.5px] font-semibold tabular-nums',
}

function alignClass(align: 'l' | 'c' | 'r') {
  if (align === 'c') return 'justify-center text-center'
  if (align === 'r') return 'justify-end text-right'
  return ''
}

const HEADER_CELL =
  'flex items-center border-b border-[#EDEFF2] bg-[#FBFBFC] px-3.5 py-[9px] text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]'

const BODY_CELL =
  'flex min-w-0 items-center border-b border-[#F3F4F6] px-3.5 py-[11px] text-[13px] text-[#171717]'

/** Column headers + rows for one service-type table, shared by the summary and by-day views. */
function SummaryTableView({ table }: { table: SummaryTable }) {
  return (
    <div style={{ minWidth: 'fit-content' }}>
      <div className="grid items-stretch" style={{ gridTemplateColumns: table.gridCols }}>
        {table.headers.map((h) => (
          <div key={h.label} className={cn(HEADER_CELL, alignClass(h.align))}>
            {h.label}
          </div>
        ))}
      </div>
      {table.rows.map((row) =>
        row.kind === 'extra' ? (
          <div
            key={row.key}
            className="grid items-center border-b border-[#F3F4F6] bg-[#FCFCFD]"
            style={{ gridTemplateColumns: '92px minmax(0,1fr) 120px' }}
          >
            <span />
            <div className="flex min-w-0 items-center gap-2 px-3.5 py-2">
              <CornerDownLeft className="size-[13px] shrink-0 text-[#C4C4C8]" />
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.3px] text-[#0369A1]">
                Extra
              </span>
              <span className="truncate text-[12.5px] font-semibold text-[#171717]">{row.label}</span>
              <span className="shrink-0 whitespace-nowrap text-[11.5px] font-medium text-[#A1A1A1]">
                {row.meta}
              </span>
            </div>
            <div className="px-3.5 py-2 text-right text-[12.5px] font-semibold tabular-nums text-[#171717]">
              {row.value}
            </div>
          </div>
        ) : (
          <div key={row.key} className="grid items-stretch" style={{ gridTemplateColumns: table.gridCols }}>
            {row.cells.map((cell, i) => (
              <div key={i} className={cn(BODY_CELL, alignClass(cell.align))} style={{ color: cell.color }}>
                <span className={cn('min-w-0 truncate', TONE_CLASS[cell.tone])} title={cell.value}>
                  {cell.value}
                </span>
              </div>
            ))}
          </div>
        ),
      )}
    </div>
  )
}

function ServiceCard({ card }: { card: SummaryCard }) {
  return (
    <section className="overflow-x-auto overflow-y-hidden rounded-lg border border-[#E5E7EB] bg-white">
      <div
        className="flex items-center gap-2.5 border-b border-[#EDEFF2] px-3.5 py-[11px]"
        style={{ background: card.tint }}
      >
        <span
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
          style={{ background: card.iconBg, color: card.iconFg }}
        >
          {card.initial}
        </span>
        <span className="text-[13.5px] font-bold text-[#171717]">{card.name}</span>
        <span className="text-[11.5px] font-medium text-[#A1A1A1]">{card.countLabel}</span>
      </div>
      <SummaryTableView table={card} />
    </section>
  )
}

export function SummaryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const {
    itineraries,
    getServices,
    getQuoteGroups,
    getGuestDetails,
    applyLifecycleTransition,
    issueSupplierVoucher,
    resendSupplierVoucher,
    submitVoucherAnswers,
    clearVoucherReply,
    demoRole,
  } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const [view, setView] = useState<'summary' | 'vouchers' | 'activity'>('summary')
  const [summaryMode, setSummaryMode] = useState<'service' | 'day'>('service')
  const [priceMode, setPriceMode] = useState<PriceDisplayMode>('all')
  const [openPriceGroups, setOpenPriceGroups] = useState<Record<string, boolean>>({})
  const [depositsOpen, setDepositsOpen] = useState(false)
  const [voucherMode, setVoucherMode] = useState<VoucherValueMode>('cost')
  const [flash, setFlash] = useState<string | null>(null)
  const [guestSheetOpen, setGuestSheetOpen] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    },
    [],
  )

  const guestDetails = useMemo(() => getGuestDetails(id), [getGuestDetails, id])
  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, guestDetails) : []),
    [itinerary, guestDetails],
  )

  const lifecycle = useMemo(
    () => (itinerary ? transitions(itinerary.status) : []),
    [itinerary],
  )

  const gatedLifecycle = useMemo(() => {
    if (!itinerary) return []
    return lifecycle.map((t) => {
      const generating =
        t.to === 'QUOTED' && itinerary.status === 'PREPARED'
          ? ('quote' as const)
          : t.to === 'INVOICED' && itinerary.status === 'APPROVED'
            ? ('invoice' as const)
            : undefined
      const gate = evaluateTransition(itinerary, services, t.to, {
        role: demoRole,
        generating,
      })
      return { ...t, gate }
    })
  }, [itinerary, lifecycle, services, demoRole])

  const docHint = useMemo(() => {
    if (!itinerary) return null
    const fp = itineraryCommercialFp(services)
    if (itinerary.status === 'PREPARED' || itinerary.status === 'QUOTED') {
      if (!itinerary.quoteFingerprint) return 'Quote snapshot not generated yet'
      if (itinerary.quoteFingerprint !== fp) return 'Quote snapshot is out of date'
      return 'Quote snapshot matches current lines'
    }
    if (itinerary.status === 'APPROVED' || itinerary.status === 'INVOICED') {
      if (!itinerary.invoiceFingerprint) return 'Invoice snapshot not generated yet'
      if (itinerary.invoiceFingerprint !== fp) return 'Invoice snapshot is out of date'
      return 'Invoice snapshot matches current lines'
    }
    return null
  }, [itinerary, services])

  const lines = useMemo(() => {
    if (services.length > 0) return linesFromServices(services, guests)
    if (quoteGroups.length > 0) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [services, quoteGroups, guests])

  const cards = useMemo(() => buildSummaryCards(lines, priceMode), [lines, priceMode])
  const dayBlocks = useMemo(() => buildSummaryDayGroups(lines, priceMode), [lines, priceMode])
  const priceGroups = useMemo(() => buildPriceGroups(lines), [lines])
  const totalGuests =
    guests.length || (itinerary ? (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0) : 0)
  const pricing = useMemo(() => buildSummaryPricing(lines, totalGuests), [lines, totalGuests])
  const deposits = useMemo(
    () => buildDepositSummary(lines, pricing.sellNumber),
    [lines, pricing.sellNumber],
  )
  const arrivalIso = useMemo(() => {
    const dates = lines.map((l) => l.date).filter(Boolean).sort()
    return dates[0] || itinerary?.travelDateFrom || ''
  }, [lines, itinerary?.travelDateFrom])
  const payments = useMemo(
    () => buildPaymentHistory(pricing.sellNumber, arrivalIso),
    [pricing.sellNumber, arrivalIso],
  )
  const vouchers = useMemo(
    () =>
      view === 'vouchers' && itinerary
        ? buildVouchers(
            lines,
            voucherMode,
            itinerary.reference || itinerary.id || 'CPS',
            services,
            guests,
            guestDetails,
            itinerary.agency || '',
            itinerary.supplierVouchers || {},
            itinerary.voucherLineAnswers || {},
            itinerary.voucherMeta || {},
          )
        : [],
    [
      view,
      lines,
      voucherMode,
      itinerary,
      services,
      guests,
      guestDetails,
    ],
  )
  const activityLog = useMemo(
    () => buildLifecycleActivityLog(itinerary?.lifecycleLog),
    [itinerary?.lifecycleLog],
  )
  const showSidePanel = view === 'summary'
  const holdRollup = useMemo(() => holdsSummaryOf(lines), [lines])
  const voucherOutstanding = useMemo(
    () => voucherOutstandingSummary(itinerary?.voucherMeta),
    [itinerary?.voucherMeta],
  )
  const isSubQuote = itinerary ? depthOf(itinerary.reference) === 2 : false
  const parentRef = itinerary ? parentReference(itinerary.reference) : ''
  const grandRef = parentRef ? parentReference(parentRef) : ''

  if (!itinerary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F4F4F5]">
        <p className="text-sm text-muted-foreground">Itinerary not found.</p>
        <Button asChild variant="outline">
          <Link to="/">Back to inquiries</Link>
        </Button>
      </div>
    )
  }

  const lead =
    [itinerary.leadFirst, itinerary.leadLast].filter(Boolean).join(' ') || 'Lead traveler TBC'
  const guestsLabel =
    itinerary.guestsLabel ||
    [
      itinerary.adults ? `${itinerary.adults} Ad` : '',
      itinerary.children ? `${itinerary.children} Ch` : '',
      itinerary.infants ? `${itinerary.infants} In` : '',
    ]
      .filter(Boolean)
      .join(' · ') ||
    '—'
  const destination =
    (itinerary.destinations && itinerary.destinations.length
      ? itinerary.destinations.join(', ')
      : itinerary.destination) || 'Destination TBC'
  const travelDates = itinerary.travelDateFrom
    ? `${formatDay(itinerary.travelDateFrom)}${
        itinerary.travelDateTo ? ` – ${formatDay(itinerary.travelDateTo)}` : ''
      }`
    : 'Dates TBC'
  const nightsCount =
    nightsBetween(itinerary.travelDateFrom, itinerary.travelDateTo) ||
    lines
      .filter((l) => l.type === 'accommodation')
      .reduce((a, l) => a + (l.nights || 0), 0) ||
    0

  const metaStrip = [
    { label: 'Lead Traveler', value: lead },
    { label: 'Agency', value: itinerary.agency || '—' },
    { label: 'Travel Dates', value: travelDates },
    { label: 'Guests', value: guestsLabel },
    { label: 'Nights', value: nightsCount ? `${nightsCount} night${nightsCount === 1 ? '' : 's'}` : '—' },
    { label: 'Hold Status', value: holdRollup.summary },
  ]

  const nextHint = isTerminalStatus(itinerary.status)
    ? 'This itinerary is in a terminal state.'
    : gatedLifecycle.length
      ? 'Choose the next step.'
      : 'No manual transitions available.'

  function applyTransition(t: LifecycleTransition & { gate?: { ok: boolean; reason?: string } }) {
    if (t.gate && !t.gate.ok) {
      showFlash(t.gate.reason || 'Transition blocked')
      return
    }
    let reason: string | undefined
    if (t.reason) {
      const entered = window.prompt(`Reason for: ${t.label}`)
      if (entered == null || !entered.trim()) return
      reason = entered.trim()
    }
    const generating =
      t.to === 'QUOTED' && itinerary!.status === 'PREPARED'
        ? ('quote' as const)
        : t.to === 'INVOICED' && itinerary!.status === 'APPROVED'
          ? ('invoice' as const)
          : undefined
    const result = applyLifecycleTransition(id, t.to, { reason, generating })
    if (!result.ok) {
      showFlash(result.reason)
      return
    }
    if (t.to === 'VOUCHERED') {
      showFlash('Vouchers auto-raised for suppliers')
      setView('vouchers')
    }
    if (isBuilderStatus(t.to)) navigate(`/build/${id}`)
  }

  function showFlash(message: string) {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlash(message)
    flashTimerRef.current = setTimeout(() => setFlash(null), 2800)
  }

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold',
      active ? 'bg-[#931115] text-white' : 'bg-transparent text-[#525252]',
    )

  const segClass = (active: boolean) =>
    cn(
      'h-7 rounded-[7px] border px-[13px] text-[12px] font-semibold',
      active ? 'border-[#931115] bg-white text-[#931115]' : 'border-transparent bg-transparent text-[#737373]',
    )

  const valueModeClass = (active: boolean) =>
    cn(
      'h-7 rounded-[7px] px-3 text-[12px] font-semibold',
      active ? 'bg-white text-[#171717] shadow-sm' : 'bg-transparent text-[#737373]',
    )

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F4F5]">
      <header className="flex h-14 shrink-0 items-center gap-3.5 border-b border-[#E5E7EB] bg-white px-6">
        <img src="/assets/sol-logo.svg" alt="SOL" className="h-auto w-[30px]" />
        <div className="flex min-w-0 items-center gap-[7px] text-[13px] font-semibold text-[#A1A1A1]">
          <Link to="/" className="text-[#931115] hover:text-[#7a0e12]">
            Inquiries
          </Link>
          <ChevronRight className="size-3.5 shrink-0 text-[#D4D4D8]" />
          {isSubQuote && grandRef ? (
            <>
              <span className="truncate">{grandRef}</span>
              <ChevronRight className="size-3.5 shrink-0 text-[#D4D4D8]" />
              <span className="truncate">{parentRef}</span>
              <ChevronRight className="size-3.5 shrink-0 text-[#D4D4D8]" />
            </>
          ) : (
            <span className="truncate">{itinerary.reference}</span>
          )}
          <ChevronRight className="size-3.5 shrink-0 text-[#D4D4D8]" />
          <span className="text-[#171717]">Summary</span>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-4 p-6">
        <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mb-[5px] truncate text-[21px] font-bold text-[#171717]">
                {itinerary.title || 'Untitled itinerary'}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[#A1A1A1]">
                <span>
                  {itinerary.reference} · {destination}
                </span>
                {isSubQuote ? (
                  <span className="inline-flex h-[22px] items-center rounded-full bg-[#EFF6FF] px-2.5 text-[11px] font-bold text-[#1D4ED8]">
                    Sub-quote
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold"
                style={{ background: holdRollup.bg, color: holdRollup.fg }}
              >
                <span className="size-[7px] rounded-full" style={{ background: holdRollup.fg }} />
                {holdRollup.chip}
              </span>
              {voucherOutstanding.issued ? (
                <span className="inline-flex h-[26px] items-center whitespace-nowrap rounded-full bg-[#FEF3C7] px-3 text-[12.5px] font-bold text-[#B45309]">
                  {voucherOutstanding.label}
                </span>
              ) : null}
              <StatusChip status={itinerary.status} />
              {isStructureLocked(itinerary.status) ? (
                <span className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full bg-[#FEF3C7] px-3 text-[12.5px] font-bold text-[#B45309]">
                  <Lock className="size-3" />
                  Structure locked
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 xl:grid-cols-6">
            {metaStrip.map((m) => (
              <div key={m.label} className="min-w-0">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#A1A1A1]">
                  {m.label}
                </div>
                <div className="truncate text-[14px] font-semibold text-[#171717]" title={m.value}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex w-fit items-center gap-1 rounded-[11px] border border-[#E5E7EB] bg-white p-[5px]">
            <button type="button" className={tabClass(view === 'summary')} onClick={() => setView('summary')}>
              <List className="size-3.5" />
              Summary
            </button>
            <button type="button" className={tabClass(view === 'vouchers')} onClick={() => setView('vouchers')}>
              <Ticket className="size-3.5" />
              Vouchers
            </button>
            <button type="button" className={tabClass(view === 'activity')} onClick={() => setView('activity')}>
              <History className="size-3.5" />
              Activities
            </button>
          </div>
          {view === 'summary' ? (
            <div className="flex flex-wrap items-center gap-3.5 rounded-[11px] border border-[#E5E7EB] bg-white px-2.5 py-1.5">
              <div className="flex items-center gap-2.5">
                <span className="text-[11.5px] font-semibold text-[#A1A1A1]">View</span>
                <div className="flex gap-[3px] rounded-[9px] bg-[#F3F4F6] p-[3px]">
                  <button type="button" className={segClass(summaryMode === 'service')} onClick={() => setSummaryMode('service')}>
                    By service type
                  </button>
                  <button type="button" className={segClass(summaryMode === 'day')} onClick={() => setSummaryMode('day')}>
                    Day by day
                  </button>
                </div>
              </div>
              <span className="h-[22px] w-px shrink-0 bg-[#E5E7EB]" />
              <div className="flex items-center gap-2.5">
                <span className="text-[11.5px] font-semibold text-[#A1A1A1]">Values shown</span>
                <div className="flex gap-[3px] rounded-[9px] bg-[#F3F4F6] p-[3px]">
                  {(
                    [
                      ['cost', 'Cost'],
                      ['sell', 'Sell'],
                      ['all', 'Everything'],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={segClass(priceMode === mode)}
                      onClick={() => setPriceMode(mode)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-start gap-4">
          <main className="flex min-w-0 flex-1 flex-col gap-4">
            {view === 'activity' ? (
              activityLog.length === 0 ? (
                <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-8 text-center text-sm text-muted-foreground">
                  No status changes yet. Lifecycle transitions will appear here.
                </div>
              ) : (
                <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-5 py-4">
                  <h2 className="mb-3 text-[15px] font-bold text-[#171717]">Lifecycle activity</h2>
                  <div className="flex flex-col">
                    {activityLog.map((entry) => {
                      const fromMeta = statusMeta(entry.from)
                      const toMeta = statusMeta(entry.to)
                      const isVoucher = entry.category && entry.category !== 'status'
                      const when = new Date(entry.at)
                      const whenLabel = Number.isNaN(when.getTime())
                        ? entry.at
                        : when.toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                      return (
                        <div key={entry.id} className="border-b border-[#F3F4F6] py-3.5">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-[13.5px] font-semibold text-[#171717]">
                              {entry.label || `Move to ${toMeta.label}`}
                            </span>
                            <span className="text-[11.5px] text-[#A1A1A1]">{whenLabel}</span>
                          </div>
                          {isVoucher ? (
                            <div className="mt-1.5 text-[12.5px] text-[#525252]">
                              <span className="mr-2 inline-flex rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-[#1D4ED8]">
                                {entry.category}
                              </span>
                              {entry.detail}
                              {entry.actor ? ` · ${entry.actor}` : ''}
                            </div>
                          ) : (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px] text-[#525252]">
                            <span
                              className="rounded-full px-[9px] py-0.5 text-[11px] font-semibold"
                              style={{ background: fromMeta.bg, color: fromMeta.fg }}
                            >
                              {fromMeta.label}
                            </span>
                            <span className="text-[#A1A1A1]">→</span>
                            <span
                              className="rounded-full px-[9px] py-0.5 text-[11px] font-semibold"
                              style={{ background: toMeta.bg, color: toMeta.fg }}
                            >
                              {toMeta.label}
                            </span>
                            <span className="text-[#A1A1A1]">·</span>
                            <span>{entry.actor}</span>
                          </div>
                          )}
                          {entry.reason ? (
                            <p className="mt-2 text-[12.5px] leading-snug text-[#737373]">
                              Reason: {entry.reason}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            ) : view === 'vouchers' ? (
              <VouchersView
                vouchers={vouchers}
                mode={voucherMode}
                setMode={setVoucherMode}
                valueModeClass={valueModeClass}
                itineraryId={id}
                bookingRef={itinerary.reference || itinerary.id}
                onOpenGuests={() => setGuestSheetOpen(true)}
                canIssue={roleAllowsVoucherAction(demoRole, 'issue')}
                canRecordOnBehalf={roleAllowsVoucherAction(demoRole, 'recordOnBehalf')}
                issueVoucher={(entityId, opts) => issueSupplierVoucher(id, entityId, opts)}
                resendVoucher={(entityId) => resendSupplierVoucher(id, entityId)}
                submitVoucherAnswers={(entityId, input) => submitVoucherAnswers(id, entityId, input)}
                clearVoucherReply={(entityId) => clearVoucherReply(id, entityId)}
                followUps={itinerary.mandatoryFollowUps}
                raised={
                  itinerary.status === 'VOUCHERED' ||
                  itinerary.status === 'CONFIRMED' ||
                  itinerary.status === 'TRAVEL_IN_PROGRESS' ||
                  itinerary.status === 'COMPLETED'
                }
              />
            ) : lines.length === 0 ? (
              <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-8 text-center text-sm text-muted-foreground">
                No services added yet.
              </div>
            ) : summaryMode === 'service' ? (
              cards.map((c) => <ServiceCard key={c.type} card={c} />)
            ) : (
              <section className="flex flex-col rounded-[14px] border border-[#E5E7EB] bg-white px-5 pb-5 pt-2">
                {dayBlocks.map((d) => (
                  <div
                    key={d.key}
                    className="grid grid-cols-[132px_minmax(0,1fr)] gap-5 border-b border-[#F3F4F6] py-4"
                  >
                    <div className="pt-0.5">
                      <div className="text-[12px] font-bold uppercase tracking-[0.4px] text-[#931115]">
                        {d.dayNum}
                      </div>
                      <div className="mt-[3px] text-[15px] font-bold text-[#171717]">{d.dateLabel}</div>
                      <div className="text-[12px] font-medium text-[#A1A1A1]">{d.weekday}</div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      {d.groups.map((g) => (
                        <div
                          key={g.key}
                          className="overflow-x-auto overflow-y-hidden rounded-[10px] border border-[#F1F1F3]"
                        >
                          <div
                            className="flex items-center gap-2.5 px-[13px] py-[9px]"
                            style={{ background: g.tint }}
                          >
                            <span
                              className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold"
                              style={{ background: g.iconBg, color: g.iconFg }}
                            >
                              {g.initial}
                            </span>
                            <span className="text-[13px] font-bold text-[#171717]">{g.name}</span>
                          </div>
                          <SummaryTableView table={g} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </main>

          {showSidePanel ? (
            <aside className="sticky top-4 w-[330px] shrink-0">
              <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-[22px] py-5">
                <h2 className="mb-3.5 text-[16px] font-bold text-[#171717]">Pricing</h2>
                <div className="mb-3 flex items-baseline justify-between gap-2.5 border-b border-[#E5E7EB] pb-[7px] text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                  <span>Service</span>
                  <span>Sell price</span>
                </div>
                <div className="mb-3.5 flex flex-col">
                  {priceGroups.map((group) => {
                    const open = !!openPriceGroups[group.key]
                    return (
                      <div key={group.key} className="border-b border-[#F3F4F6]">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenPriceGroups((current) => ({ ...current, [group.key]: !current[group.key] }))
                          }
                          className="flex w-full items-center gap-2 py-2 text-left"
                        >
                          <ChevronRight
                            className={cn('size-3 shrink-0 text-[#A1A1A1] transition-transform', open && 'rotate-90')}
                          />
                          <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-[#171717]">{group.name}</span>
                          <span className="whitespace-nowrap text-[11px] text-[#A1A1A1]">{group.countLabel}</span>
                          <span className="whitespace-nowrap text-[12.5px] font-bold text-[#171717]">{group.subtotal}</span>
                        </button>
                        {open ? (
                          <div className="flex flex-col gap-1.5 pb-2 pl-[19px]">
                            {group.items.map((item) => (
                              <div key={item.key} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                                <span className="min-w-0 truncate text-[#525252]" title={`${item.supplier} ${item.desc}`}>
                                  {item.supplier} <span className="text-[#A1A1A1]">{item.desc}</span>
                                </span>
                                <span className="shrink-0 font-medium text-[#525252]">{item.value}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
                {pricing.hasDiscounts ? (
                  <div className="mb-4 flex flex-col gap-3 rounded-[10px] border border-[#E5E7EB] px-3.5 py-3">
                    <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                      Special offers &amp; discounts
                    </div>
                    {pricing.discounts.map((d) => (
                      <div key={d.label} className="border-t border-[#F3F4F6] pt-0.5">
                        <div className="text-[12.5px] font-semibold text-[#171717]">{d.label}</div>
                        <div className="mt-0.5 text-[11px] font-semibold" style={{ color: d.noteColor }}>
                          {d.note}
                        </div>
                        <div className="mt-1.5 flex items-baseline gap-3.5 text-[11.5px] text-[#A1A1A1]">
                          <span className="whitespace-nowrap">
                            Cost <b className="font-semibold text-[#171717]">{d.costDelta}</b>
                          </span>
                          <span className="whitespace-nowrap">
                            Sell <b className="font-semibold text-[#171717]">{d.sellDelta}</b>
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-col gap-3">
                  {pricing.pricing.map((p) => (
                    <div key={p.label} className="flex items-baseline justify-between gap-3">
                      <span className="whitespace-nowrap text-[13.5px] text-[#737373]">{p.label}</span>
                      <span className="whitespace-nowrap text-[13.5px] font-semibold tabular-nums" style={{ color: p.color }}>
                        {p.value}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="my-4 h-px bg-[#E5E7EB]" />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="whitespace-nowrap text-[14.5px] font-bold text-[#171717]">Sell total</span>
                  <span className="text-[15px] font-bold tabular-nums text-[#171717]">{pricing.sellTotal}</span>
                </div>
                {pricing.perPerson ? (
                  <div className="mt-1 text-right text-[11.5px] text-[#A1A1A1]">{pricing.perPerson}</div>
                ) : null}
                <div className="my-4 h-px bg-[#E5E7EB]" />
                <button
                  type="button"
                  onClick={() => setDepositsOpen((open) => !open)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <ChevronRight
                    className={cn('size-3 shrink-0 text-[#A1A1A1] transition-transform', depositsOpen && 'rotate-90')}
                  />
                  <span className="min-w-0 flex-1 text-[14px] font-bold text-[#171717]">Total deposit</span>
                  <span className="text-[15px] font-bold text-[#931115]">{deposits.depositTotal}</span>
                </button>
                <div className="mt-1 flex items-baseline justify-between gap-3 pl-[19px] text-[11.5px] text-[#A1A1A1]">
                  <span className="whitespace-nowrap">
                    {deposits.depositPctLabel} · {deposits.depositCountLabel}
                  </span>
                  <span className="whitespace-nowrap">Balance {deposits.depositBalance}</span>
                </div>
                {depositsOpen ? (
                  <div className="mt-2 flex flex-col pl-[19px]">
                    {deposits.depositRows.map((row) => (
                      <div
                        key={row.supplier}
                        title={row.rule}
                        className="flex items-baseline justify-between gap-2 border-t border-[#F3F4F6] py-[5px]"
                      >
                        <span className="min-w-0 text-[11.5px] text-[#525252]">
                          {row.supplier} <span className="text-[#A1A1A1]">{row.terms}</span>
                        </span>
                        <span className="shrink-0 text-[11.5px] font-semibold text-[#171717]">{row.amount}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </aside>
          ) : null}
        </div>

        {showSidePanel && lines.length > 0 ? (
          <aside className="w-full">
            <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-[22px] py-5">
              <div className="mb-3.5 flex items-baseline justify-between gap-3">
                <h2 className="text-[16px] font-bold text-[#171717]">Payment history</h2>
                <span className="text-[11.5px] text-[#A1A1A1]">{payments.arrivalNote}</span>
              </div>
              <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                <div className="rounded-[10px] border border-[#E5E7EB] px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                    Sell total
                  </div>
                  <div className="mt-1 text-[17px] font-bold text-[#171717]">{payments.sellTotal}</div>
                </div>
                <div className="rounded-[10px] border border-[#E5E7EB] px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                    Paid to date
                  </div>
                  <div className="mt-1 text-[17px] font-bold text-[#059669]">{payments.paid}</div>
                  <div className="mt-0.5 text-[11px] text-[#A1A1A1]">{payments.paidPctLabel}</div>
                </div>
                <div className="rounded-[10px] border border-[#E5E7EB] px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                    Outstanding
                  </div>
                  <div className="mt-1 text-[17px] font-bold text-[#931115]">{payments.outstanding}</div>
                </div>
                <div className="rounded-[10px] border border-[#E5E7EB] px-3.5 py-2.5">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                    Full payment due
                  </div>
                  <div className="mt-1 text-[17px] font-bold text-[#171717]">{payments.finalDue}</div>
                  <div
                    className="mt-0.5 text-[11px] font-semibold"
                    style={{ color: payments.finalDueColor }}
                  >
                    {payments.finalDueNote}
                  </div>
                </div>
              </div>
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-[#F3F4F6]">
                <div
                  className="h-1.5 rounded-full bg-[#059669]"
                  style={{ width: `${payments.paidPct}%` }}
                />
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  <div className="grid grid-cols-[96px_minmax(0,1fr)_176px_108px_110px] gap-2.5 border-b border-[#E5E7EB] pb-[7px]">
                    {['Date', 'Instalment', 'Method / ref', 'Status', 'Amount'].map((label) => (
                      <span
                        key={label}
                        className={cn(
                          'text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]',
                          label === 'Amount' && 'text-right',
                        )}
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                  {payments.rows.map((pm) => (
                    <div
                      key={pm.label}
                      className="grid grid-cols-[96px_minmax(0,1fr)_176px_108px_110px] items-center gap-2.5 border-b border-[#F3F4F6] py-[9px]"
                    >
                      <span className="whitespace-nowrap text-[12.5px] text-[#525252]">{pm.date}</span>
                      <span className="min-w-0 text-[12.5px] font-semibold text-[#171717]">{pm.label}</span>
                      <span className="min-w-0 truncate text-[11.5px] text-[#A1A1A1]">{pm.method}</span>
                      <span
                        className="inline-flex h-[22px] w-fit items-center justify-center justify-self-start whitespace-nowrap rounded-md px-[9px] text-[11px] font-bold"
                        style={{ background: pm.statusBg, color: pm.statusFg }}
                      >
                        {pm.status}
                      </span>
                      <span className="whitespace-nowrap text-right text-[13px] font-bold tabular-nums text-[#171717]">
                        {pm.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </aside>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#E5E7EB] bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 text-[13px] text-[#525252]">
          <Button variant="outline" onClick={() => navigate(`/build/${id}`)}>
            <ChevronLeft />
            Back to editing
          </Button>
          <GuestsToolbarButton
            count={guestDetails.length || guests.length}
            hasIssues={guestIssueHint(guestDetails)}
            onClick={() => setGuestSheetOpen(true)}
          />
          {lines.length > 0 ? (
            <Button variant="outline" onClick={() => navigate(`/quote-doc/${id}`)}>
              <FileText />
              View quote PDF
            </Button>
          ) : null}
          <StatusChip status={itinerary.status} />
          {isStructureLocked(itinerary.status) ? (
            <span className="inline-flex h-6 items-center gap-1.5 rounded-[7px] bg-[#FEF3C7] px-2.5 text-[11.5px] font-semibold text-[#B45309]">
              <Lock className="size-3" />
              Structure locked
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            {nextHint}
            {docHint ? <span className="text-[#A1A1A1]"> · {docHint}</span> : null}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {gatedLifecycle.length === 0 ? (
            <span className="text-[13px] italic text-[#A1A1A1]">No further actions in this state.</span>
          ) : (
            gatedLifecycle.map((t) => {
              const blocked = !t.gate.ok
              return (
                <Button
                  key={t.to}
                  className={cn(transitionButtonClass(t), blocked && 'opacity-45')}
                  variant={t.primary ? 'default' : 'outline'}
                  disabled={blocked}
                  title={blocked && !t.gate.ok ? t.gate.reason : undefined}
                  onClick={() => applyTransition(t)}
                >
                  {t.label}
                </Button>
              )
            })
          )}
        </div>
      </div>

      {flash ? (
        <div className="fixed bottom-7 left-1/2 z-[95] flex -translate-x-1/2 items-center gap-2.5 rounded-[10px] bg-[#171717] px-[18px] py-[11px] text-[13px] font-semibold text-white shadow-2xl">
          <span className="text-[#4ADE80]">✓</span>
          {flash}
        </div>
      ) : null}

      {itinerary ? (
        <GuestDetailsSheet
          open={guestSheetOpen}
          onClose={() => setGuestSheetOpen(false)}
          itinerary={itinerary}
        />
      ) : null}
    </div>
  )
}
