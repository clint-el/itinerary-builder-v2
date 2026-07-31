import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
import africanStyleImg from '@/assets/African-Style.webp'
import frontRowSeatsImg from '@/assets/Front-Row-Seats.webp'
import plainsMajestyImg from '@/assets/Plains-Majesty.webp'
import totallyFocusedImg from '@/assets/totally-focused.webp'
import { Button } from '@/components/ui/button'
import {
  buildDepositSummary,
  buildInclusions,
  buildSummaryCards,
  buildSummaryDays,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
  SUMMARY_TYPE_META,
  type SummaryLine,
} from '@/features/summary/summaryModel'
import { nightsBetween, partyGuests } from '@/shared/lib/helpers'
import type { AddedService, Hold, Itinerary } from '@/shared/lib/types'
import { cn, formatDay, formatUsd } from '@/shared/lib/utils'

const TERMS = [
  {
    title: 'Provisional holds',
    body: 'Rooms and flights are held provisionally and are released automatically if the deposit is not received by the date shown. Availability cannot be guaranteed after release.',
  },
  {
    title: 'Cancellation',
    body: 'Cancellation more than 60 days before travel forfeits the deposit. Within 60 days, 100% of the total is payable. Individual properties may apply stricter terms in peak season.',
  },
  {
    title: 'Rates and currency',
    body: 'Rates are quoted in US dollars and are subject to change in the event of government-imposed increases in park fees, taxes or fuel levies before the deposit is received.',
  },
  {
    title: 'Children',
    body: 'Child rates apply to guests aged 12 and under sharing with two adults. Some properties operate minimum-age policies on game activities.',
  },
]

const PAGE_CLASS =
  'qd-page mt-7 flex h-[1123px] w-[794px] shrink-0 flex-col bg-white px-14 pb-10 pt-14 shadow-[0_12px_32px_rgba(0,0,0,0.35)]'
const TYPE_COLORS: Record<SummaryLine['type'], string> = {
  accommodation: '#059669',
  flight: '#2563EB',
  transportation: '#D97706',
  activity: '#7E22CE',
  extra: '#0369A1',
  other: '#475569',
}
const STAY_IMAGES = [africanStyleImg, totallyFocusedImg, frontRowSeatsImg, plainsMajestyImg]
const MAX_DOC_DAYS = 60

type BreakdownGroup = {
  name: string
  subtotal: number
  lines: { label: string; detail: string; qty: string; amount: number }[]
}

function dateFromIso(iso: string) {
  return iso ? new Date(`${iso}T00:00:00`) : new Date()
}

function addDays(iso: string, days: number) {
  const dt = dateFromIso(iso)
  dt.setDate(dt.getDate() + days)
  return dt
}

/** Local-calendar date arithmetic — toISOString() would shift the day in non-UTC zones. */
function isoAddDays(iso: string, days: number) {
  const dt = addDays(iso, days)
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

function fmtLongDate(dt: Date) {
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function fmtDayDate(iso: string) {
  if (!iso) return 'Date TBC'
  return dateFromIso(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })
}

function destinationLabel(itinerary: Pick<Itinerary, 'destinations' | 'destination'>) {
  return (itinerary.destinations?.length ? itinerary.destinations.join(' & ') : itinerary.destination) || 'Destination TBC'
}

function lineLabel(line: SummaryLine) {
  if (line.type === 'accommodation') return `${line.supplier} — ${line.roomType || 'Room'}`
  if (line.type === 'flight') return line.route || line.supplier
  if (line.type === 'transportation') {
    return line.kind === 'disposal'
      ? `${line.vType || 'Vehicle'} at disposal · ${line.location || line.supplier}`
      : `${line.pickup || 'Pickup TBC'} → ${line.dropoff || 'Drop-off TBC'}`
  }
  return line.service || line.supplier
}

function lineDetail(line: SummaryLine) {
  const bits = [line.date ? formatDay(line.date) : '', line.supplier]
  if (line.type === 'accommodation') bits.push(line.basis || '')
  if (line.type === 'flight') bits.push(line.charter || '')
  return bits.filter(Boolean).join(' · ')
}

function lineQty(line: SummaryLine) {
  if (line.type === 'accommodation') return `${line.nights || 1} night${line.nights === 1 ? '' : 's'}`
  if (line.type === 'transportation') {
    return line.kind === 'disposal'
      ? `${line.days || 1} day${line.days === 1 ? '' : 's'}`
      : `${line.veh || 1} vehicle${line.veh === 1 ? '' : 's'}`
  }
  if (line.qty) return line.qty
  if (line.pax) return `${line.pax} pax`
  return '1'
}

function dayItemDetail(line: SummaryLine) {
  if (line.type === 'accommodation') {
    return `${line.basis || 'Basis TBC'}${line.nights ? ` · ${line.nights} nights` : ''}`
  }
  if (line.type === 'flight') return [line.supplier, line.charter].filter(Boolean).join(' · ')
  if (line.type === 'transportation') {
    return line.kind === 'disposal'
      ? [line.vType, `${line.days || 1} day(s)`].filter(Boolean).join(' · ')
      : [line.vType, line.supplier].filter(Boolean).join(' · ')
  }
  return line.supplier
}

export function QuoteDocPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { itineraries, getServices, getQuoteGroups, getGuestDetails } = useStore()
  const itinerary = itineraries.find((item) => item.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, getGuestDetails(id)) : []),
    [itinerary, id, getGuestDetails],
  )

  const [zoom, setZoom] = useState(80)
  const [optionsOpen, setOptionsOpen] = useState(false)
  const [showNarrative, setShowNarrative] = useState(true)
  const [showImages, setShowImages] = useState(true)
  const [showBreakdown, setShowBreakdown] = useState(true)
  const [showTerms, setShowTerms] = useState(true)
  const [priceMode, setPriceMode] = useState<'total' | 'pp'>('pp')
  const [warningDismissed, setWarningDismissed] = useState(false)
  const [activePage, setActivePage] = useState(1)
  const [version, setVersion] = useState(1)
  const [flash, setFlash] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const optionsRef = useRef<HTMLDivElement>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (services.length) return linesFromServices(services, guests)
    if (quoteGroups.length) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [quoteGroups, services, guests])
  const cards = useMemo(() => buildSummaryCards(lines), [lines])
  const totalGuestsForPricing =
    guests.length || (itinerary ? (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0) : 0)
  const pricing = useMemo(
    () => buildSummaryPricing(lines, totalGuestsForPricing),
    [lines, totalGuestsForPricing],
  )
  const deposits = useMemo(
    () => buildDepositSummary(lines, pricing.sellNumber),
    [lines, pricing.sellNumber],
  )
  const { inclusions, exclusionsBody } = useMemo(() => buildInclusions(lines), [lines])
  const sortedLines = useMemo(
    () => [...lines].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999')),
    [lines],
  )
  const accommodationLines = useMemo(
    () => sortedLines.filter((line) => line.type === 'accommodation'),
    [sortedLines],
  )
  const accommodationProperties = useMemo(() => {
    const properties = new Map<string, SummaryLine[]>()
    for (const line of accommodationLines) {
      const existing = properties.get(line.supplier) || []
      existing.push(line)
      properties.set(line.supplier, existing)
    }
    return [...properties.entries()].map(([supplier, propertyLines]) => {
      const first = propertyLines[0]
      return {
        ...first,
        supplier,
        roomType: [...new Set(propertyLines.map((line) => line.roomType).filter(Boolean))].join(' + '),
        nights: Math.max(...propertyLines.map((line) => line.nights || 0)),
      }
    })
  }, [accommodationLines])
  const breakdownGroups = useMemo<BreakdownGroup[]>(
    () =>
      cards.map((card) => {
        const categoryLines = sortedLines.filter((line) => line.type === card.type)
        return {
          name: card.name,
          subtotal: categoryLines.reduce((sum, line) => sum + (line.rack || 0), 0),
          lines: categoryLines.map((line) => ({
            label: lineLabel(line),
            detail: lineDetail(line),
            qty: lineQty(line),
            amount: line.rack || 0,
          })),
        }
      }),
    [cards, sortedLines],
  )
  const dayRows = useMemo(() => {
    const start = itinerary?.travelDateFrom
    const end = itinerary?.travelDateTo
    if (!start || !end) {
      return buildSummaryDays(lines).map((day) => ({
        ...day,
        date: sortedLines.find((line) => line.date && day.dateLabel.includes(formatDay(line.date)))?.date,
        lines: sortedLines.filter((line) => line.date && day.dateLabel.includes(formatDay(line.date))),
      }))
    }

    const totalDays = Math.max(1, Math.min(MAX_DOC_DAYS, nightsBetween(start, end) + 1))
    return Array.from({ length: totalDays }, (_, offset) => {
      const date = isoAddDays(start, offset)
      const dated = sortedLines.filter((line) => line.date === date && line.type !== 'accommodation')
      const stays = accommodationProperties.filter((line) => {
        if (!line.date) return false
        return date >= line.date && date < isoAddDays(line.date, line.nights || 1)
      })
      const unique = new Map<string, SummaryLine>()
      for (const line of [...dated, ...stays]) {
        const key = `${line.type}:${lineLabel(line)}`
        if (!unique.has(key)) unique.set(key, line)
      }
      return {
        dayNum: `Day ${offset + 1}`,
        dateLabel: fmtDayDate(date),
        weekday: '',
        items: [],
        date,
        lines: [...unique.values()],
      }
    })
  }, [accommodationProperties, itinerary?.travelDateFrom, itinerary?.travelDateTo, lines, sortedLines])

  if (!itinerary) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#3F3F46] text-white">
        <p className="text-sm text-white/70">Itinerary not found.</p>
        <Button asChild variant="outline"><Link to="/">Back to inquiries</Link></Button>
      </div>
    )
  }

  const adults =
    itinerary.adults ??
    itinerary.paxAdults ??
    (itinerary.adultsRes || 0) + (itinerary.adultsNonRes || 0)
  const children =
    itinerary.children ??
    itinerary.paxChildren ??
    (itinerary.childrenRes || 0) + (itinerary.childrenNonRes || 0)
  const infants = itinerary.infants ?? (itinerary.infantsRes || 0) + (itinerary.infantsNonRes || 0)
  const nightsCount =
    nightsBetween(itinerary.travelDateFrom, itinerary.travelDateTo) ||
    accommodationLines.reduce((sum, line) => sum + (line.nights || 0), 0)
  const daysCount = nightsCount ? nightsCount + 1 : Math.max(dayRows.length, 1)
  const lead =
    [itinerary.leadFirst, itinerary.leadLast].filter(Boolean).join(' ') || itinerary.title || 'Guest'
  const guestsLabel =
    itinerary.guestsLabel ||
    [
      adults ? `${adults} adult${adults === 1 ? '' : 's'}` : '',
      children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
      infants ? `${infants} infant${infants === 1 ? '' : 's'}` : '',
    ].filter(Boolean).join(', ') ||
    '—'
  const travelDates = itinerary.travelDateFrom
    ? `${formatDay(itinerary.travelDateFrom)}${itinerary.travelDateTo ? ` – ${formatDay(itinerary.travelDateTo)}` : ''}`
    : 'TBC'
  const validUntil = fmtLongDate(addDays(new Date().toISOString().slice(0, 10), 14))
  const balanceDue = itinerary.travelDateFrom
    ? fmtLongDate(addDays(itinerary.travelDateFrom, -60))
    : '60 days before travel'
  const pendingHolds = services.reduce((count: number, service: AddedService) => {
    const holds = (service.draft?.holds as Hold[] | undefined) || []
    return count + holds.filter((hold) => hold.status === 'Requested').length
  }, 0)
  const weightedGuests = adults + children * 0.7
  const perAdult = weightedGuests ? pricing.sellNumber / weightedGuests : 0
  const perChild = perAdult * 0.7
  const versionLabel = `v${version}`
  const pageDefs = [
    { key: 1, label: 'Cover' },
    { key: 2, label: 'Day 1 – 8' },
    { key: 21, label: 'Day 9 onwards' },
    ...(showNarrative ? [{ key: 3, label: 'Where you stay' }] : []),
    { key: 4, label: 'Investment' },
    { key: 42, label: 'Investment 2' },
    { key: 41, label: 'Totals' },
    { key: 43, label: 'Inclusions' },
    ...(showTerms ? [{ key: 5, label: 'Terms' }] : []),
  ]
  const pageNumber = (key: number) => pageDefs.findIndex((page) => page.key === key) + 1
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
    if (width) setZoom(Math.max(40, Math.min(150, Math.floor(((width - 64) / 794) * 100))))
  }
  const regenerate = () => {
    const next = version + 1
    setVersion(next)
    setOptionsOpen(false)
    showFlash(`Quote regenerated as v${next}`)
  }

  return (
    <div className="qd-shell flex h-screen flex-col overflow-hidden bg-[#3F3F46]">
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
            Quote {itinerary.reference} · {versionLabel}
          </span>
          <span className="truncate text-[11.5px] text-[#A1A1A1]">
            Generated {fmtLongDate(new Date())} by {itinerary.safariPlanner || 'Safari planner'}
          </span>
        </div>
        <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full bg-[#F3E8FF] px-2.5 text-[11.5px] font-bold text-[#7E22CE]">
          <span className="size-1.5 rounded-full bg-[#7E22CE]" /> Quoted
        </span>
        <div className="flex-1" />
        <div className="flex shrink-0 items-center gap-0.5 rounded-lg bg-[#F4F4F5] p-[3px]">
          <ZoomButton title="Zoom out" onClick={() => setZoom((value) => Math.max(40, value - 10))}>
            <Minus className="size-3.5" />
          </ZoomButton>
          <button type="button" title="Fit to width" onClick={fitWidth} className="h-[26px] min-w-12 rounded-md text-[12.5px] font-semibold hover:bg-white">
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
              <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Sections</p>
              <OptionToggle label="Property narrative" on={showNarrative} onClick={() => setShowNarrative((value) => !value)} />
              <OptionToggle label="Lodge imagery" on={showImages} onClick={() => setShowImages((value) => !value)} />
              <OptionToggle label="Price breakdown by category" on={showBreakdown} onClick={() => setShowBreakdown((value) => !value)} />
              <OptionToggle label="Payment schedule & terms" on={showTerms} onClick={() => setShowTerms((value) => !value)} />
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
              <p className="mt-3 text-[11.5px] leading-relaxed text-[#A1A1A1]">
                Cost and margin are never shown on the client document.
              </p>
            </div>
          ) : null}
        </div>
        <Button variant="outline" className="h-[34px] shrink-0" onClick={regenerate}>
          <RefreshCw className="size-3.5" /> Regenerate
        </Button>
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
          <button type="button" onClick={() => navigate(`/build/${id}`)} className="text-[12.5px] font-bold text-[#92400E] underline">
            Review holds
          </button>
          <div className="flex-1" />
          <button type="button" onClick={() => setWarningDismissed(true)} className="text-[#92400E]"><X className="size-4" /></button>
        </div>
      ) : null}

      <div className="qd-shell flex min-h-0 flex-1">
        <div className="qd-chrome w-[132px] shrink-0 overflow-y-auto border-r border-[#18181B] bg-[#27272A] py-4">
          {pageDefs.map((page, index) => {
            const active = activePage === page.key
            return (
              <button
                key={page.key}
                type="button"
                onClick={() => scrollToPage(page.key)}
                className={cn('flex w-full flex-col items-center gap-1.5 px-3 py-2.5', active && 'bg-[#3F3F46]')}
              >
                <span className={cn(
                  'block h-[105px] w-[74px] overflow-hidden rounded-[3px] bg-white shadow-[0_2px_8px_rgba(0,0,0,.4)] outline',
                  active ? 'outline-2 outline-[#931115]' : 'outline-1 outline-white/10',
                )}>
                  <span className={cn('block', page.key === 1 ? 'h-[46px] bg-[#E7E5E4]' : 'h-[10px] bg-[#931115]')} />
                  <span className="mx-2.5 mt-2 block h-1.5 w-3/5 rounded-sm bg-[#E5E7EB]" />
                  <span className="mx-2.5 mt-1 block h-1 w-4/5 rounded-sm bg-[#EFEFF1]" />
                  <span className="mx-2.5 mt-1 block h-1 w-3/4 rounded-sm bg-[#EFEFF1]" />
                </span>
                <span className={cn('text-center text-[10.5px] font-semibold', active ? 'text-white' : 'text-[#A1A1AA]')}>
                  {index + 1} · {page.label}
                </span>
              </button>
            )
          })}
        </div>

        <div ref={viewportRef} className="qd-scroll min-w-0 flex-1 overflow-auto py-7">
          <div className="qd-print-area mx-auto flex w-[794px] flex-col items-center" style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
            <section data-qd-page="1" className="qd-page flex h-[1123px] w-[794px] shrink-0 flex-col overflow-hidden bg-white shadow-[0_12px_32px_rgba(0,0,0,0.35)]">
              <div className="relative h-[470px] shrink-0 overflow-hidden bg-[#E7E5E4]">
                <img src={plainsMajestyImg} alt="" className="absolute inset-0 size-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-transparent" />
                <div className="absolute left-14 top-11 flex items-center gap-2.5">
                  <img src="/assets/sol-logo.svg" alt="SOL" className="w-[38px]" />
                  <span className="text-[15px] font-bold tracking-[2px] text-[#931115]">SOL</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col px-14 pb-11 pt-[52px]">
                <span className="text-[12px] font-bold uppercase tracking-[2.4px] text-[#931115]">Safari proposal</span>
                <h1 className="mt-4 text-[42px] font-bold leading-[1.12] tracking-[-0.8px] text-[#171717]">{destinationLabel(itinerary)}</h1>
                <p className="mt-3.5 text-[17px] text-[#525252]">Prepared for {lead} · {daysCount} days, {nightsCount} nights</p>
                <div className="my-8 h-px bg-[#E5E7EB]" />
                <div className="grid grid-cols-3 gap-x-5 gap-y-6">
                  <CoverMeta label="Reference" value={itinerary.reference} />
                  <CoverMeta label="Travel dates" value={travelDates} />
                  <CoverMeta label="Guests" value={guestsLabel} />
                  <CoverMeta label="Prepared for" value={itinerary.agency || '—'} />
                  <CoverMeta label="Safari planner" value={itinerary.safariPlanner || '—'} />
                  <CoverMeta label="Quote valid until" value={validUntil} accent />
                </div>
                <div className="flex-1" />
                <PageFooter left="Safari Operations Ltd · reservations@sol-safaris.com · +254 20 000 0000" right={`${versionLabel} · Page 1`} />
              </div>
            </section>

            <DayPage
              pageKey={2}
              title="Your day by day"
              rows={dayRows.slice(0, 8)}
              reference={itinerary.reference}
              version={versionLabel}
              page={pageNumber(2)}
              showLegend
            />
            <DayPage
              pageKey={21}
              title="Your day by day · continued"
              rows={dayRows.slice(8)}
              reference={itinerary.reference}
              version={versionLabel}
              page={pageNumber(21)}
              stats={[
                ['Duration', `${daysCount} days · ${nightsCount} nights`],
                ['Properties', `${accommodationProperties.length} camps & lodges`],
                ['Internal flights', `${lines.filter((line) => line.type === 'flight').length} sectors`],
                ['Guests', guestsLabel],
              ]}
            />

            {showNarrative ? (
              <section data-qd-page="3" className={PAGE_CLASS}>
                <PageHeading title="Where you'll stay" right={itinerary.reference} />
                <div className="flex flex-col gap-[22px]">
                  {accommodationProperties.slice(0, 5).map((line, index) => (
                    <div key={`${line.supplier}-${line.date}-${index}`} className="flex gap-5">
                      {showImages ? <img src={STAY_IMAGES[index % STAY_IMAGES.length]} alt="" className="h-[132px] w-[190px] shrink-0 rounded-[10px] object-cover" /> : null}
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-[#931115]">
                          {line.nights ? `${line.nights} night${line.nights === 1 ? '' : 's'}` : 'Stay'} · {line.date ? formatDay(line.date) : 'Dates TBC'}
                        </span>
                        <h3 className="mt-1.5 text-[17px] font-bold text-[#171717]">{line.supplier}</h3>
                        <p className="mt-0.5 text-[12.5px] font-semibold text-[#A1A1A1]">{line.roomType || 'Room'} · {line.basis || 'Basis TBC'}</p>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#525252]">
                          Enjoy {line.nights || 'your'} night{line.nights === 1 ? '' : 's'} at {line.supplier}, with the room and meal basis shown in your itinerary.
                        </p>
                      </div>
                    </div>
                  ))}
                  {!accommodationProperties.length ? <EmptyCopy text="No accommodation services have been added yet." /> : null}
                </div>
                <div className="flex-1" />
                <PageFooter left={`${itinerary.reference} · ${versionLabel}`} right={`Page ${pageNumber(3)}`} />
              </section>
            ) : null}

            <BreakdownPage
              pageKey={4}
              title="Your investment"
              groups={breakdownGroups.slice(0, 3)}
              visible={showBreakdown}
              reference={itinerary.reference}
              version={versionLabel}
              page={pageNumber(4)}
            />
            <BreakdownPage
              pageKey={42}
              title="Your investment · continued"
              groups={breakdownGroups.slice(3)}
              visible={showBreakdown}
              reference={itinerary.reference}
              version={versionLabel}
              page={pageNumber(42)}
            />

            <section data-qd-page="41" className={PAGE_CLASS}>
              <PageHeading title="What it comes to" right="All prices in USD" />
              <div className="mb-4 flex items-baseline justify-between">
                <span className="text-[13.5px] text-[#525252]">Itinerary subtotal</span>
                <span className="text-[14px] font-semibold text-[#171717]">{pricing.sellTotal}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#931115] px-6 py-5">
                <span className="text-[13px] font-semibold uppercase tracking-wide text-[#F5D3D4]">Total for the party</span>
                <span className="text-[26px] font-bold tracking-[-0.5px] text-white">{pricing.sellTotal}</span>
              </div>
              {priceMode === 'pp' && weightedGuests > 0 ? (
                <div className="mt-3.5 flex gap-3.5">
                  {adults > 0 ? <PriceTile label="Per adult" value={formatUsd(perAdult)} /> : null}
                  {children > 0 ? <PriceTile label={`Per child${itinerary.childAges?.length ? ` (${itinerary.childAges.join(', ')})` : ''}`} value={formatUsd(perChild)} /> : null}
                </div>
              ) : null}
              {showBreakdown ? (
                <>
                  <p className="mb-1.5 mt-8 text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">Summary by category</p>
                  {breakdownGroups.map((group) => (
                    <div key={group.name} className="flex items-baseline justify-between border-b border-[#F1F1F3] py-3">
                      <span className="text-[14px] text-[#171717]">
                        {group.name}
                        <span className="mt-0.5 block text-[11.5px] text-[#A1A1A1]">{group.lines.length} service line{group.lines.length === 1 ? '' : 's'}</span>
                      </span>
                      <span className="text-[14.5px] font-semibold text-[#171717]">{formatUsd(group.subtotal)}</span>
                    </div>
                  ))}
                </>
              ) : null}
              <div className="flex-1" />
              <PageFooter left={`${itinerary.reference} · ${versionLabel}`} right={`Page ${pageNumber(41)}`} />
            </section>

            <section data-qd-page="43" className={PAGE_CLASS}>
              <PageHeading title="What is included" right={itinerary.reference} />
              <p className="mb-3.5 text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                What each supplier includes
              </p>
              <div className="flex flex-col gap-3">
                {inclusions.length ? (
                  inclusions.map((item) => (
                    <p key={item.supplier} className="m-0 text-[12.5px] leading-relaxed text-[#525252]">
                      <span className="font-bold text-[#171717]">{item.supplier}.</span> {item.body}
                    </p>
                  ))
                ) : (
                  <EmptyCopy text="No services have been added to describe inclusions." />
                )}
              </div>
              <p className="mb-2 mt-[30px] text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                Not included
              </p>
              <p className="m-0 text-[12.5px] leading-relaxed text-[#525252]">{exclusionsBody}</p>
              <div className="flex-1" />
              <PageFooter left={`${itinerary.reference} · ${versionLabel}`} right={`Page ${pageNumber(43)}`} />
            </section>

            {showTerms ? (
              <section data-qd-page="5" className={PAGE_CLASS}>
                <PageHeading title="Payment & booking terms" right={itinerary.reference} />
                <ScheduleRow
                  label="Deposit on acceptance"
                  due={`Calculated from each supplier’s own payment terms · ${deposits.depositPctOfSell}% of total`}
                  amount={deposits.depositTotal}
                />
                <ScheduleRow
                  label="Balance"
                  due={`Due 60 days before travel · ${balanceDue}`}
                  amount={deposits.depositBalance}
                />
                <p className="mb-2 mt-[18px] text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                  How the deposit is calculated
                </p>
                <p className="mb-2.5 text-[12px] leading-relaxed text-[#525252]">
                  Deposits are not a flat percentage. Each supplier on this itinerary applies its own terms, and the
                  amount below is the sum of those individual requirements.
                </p>
                <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB]">
                  {deposits.depositRows.map((row) => (
                    <div
                      key={row.supplier}
                      className="grid grid-cols-[1fr_96px_84px] items-baseline gap-2.5 border-b border-[#F3F4F6] px-3.5 py-[7px] last:border-b-0"
                    >
                      <span className="truncate text-[12px] font-semibold text-[#171717]">{row.supplier}</span>
                      <span className="text-[11px] text-[#A1A1A1]">{row.shortRule}</span>
                      <span className="text-right text-[12px] font-semibold text-[#171717]">{row.amount}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[1fr_84px] gap-2.5 bg-[#F9FAFB] px-3.5 py-2.5">
                    <span className="text-[12px] font-bold text-[#171717]">Total deposit payable on acceptance</span>
                    <span className="text-right text-[12.5px] font-bold text-[#931115]">{deposits.depositTotal}</span>
                  </div>
                </div>
                <div className="mt-7 flex flex-col gap-4">
                  {TERMS.map((term) => (
                    <div key={term.title}>
                      <p className="mb-1 text-[12.5px] font-bold text-[#171717]">{term.title}</p>
                      <p className="text-[12.5px] leading-relaxed text-[#525252]">{term.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-5 py-4">
                  <p className="text-[12.5px] leading-relaxed text-[#525252]">
                    This proposal is held provisionally and expires on <strong className="text-[#931115]">{validUntil}</strong>. Rooms and flights are subject to availability until deposit is received.
                  </p>
                </div>
                <div className="flex-1" />
                <PageFooter left={`${itinerary.reference} · ${versionLabel}`} right={`Page ${pageNumber(5)}`} />
              </section>
            ) : null}
          </div>
        </div>
      </div>
      {flash ? (
        <div className="qd-chrome fixed bottom-6 right-6 z-[95] flex items-center gap-2.5 rounded-lg bg-[#171717] px-4.5 py-3 text-[13.5px] font-semibold text-white shadow-2xl">
          <span className="text-[#00D492]">✓</span>{flash}
        </div>
      ) : null}
    </div>
  )
}

function ZoomButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} onClick={onClick} className="flex h-[26px] w-7 items-center justify-center rounded-md text-[#525252] hover:bg-white">{children}</button>
}

function OptionToggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left hover:bg-[#F9FAFB]">
      <span className={cn('flex size-[17px] shrink-0 items-center justify-center rounded-[5px] border', on ? 'border-[#931115] bg-[#931115]' : 'border-[#D4D4D8] bg-white')}>
        {on ? <span className="text-[10px] font-bold text-white">✓</span> : null}
      </span>
      <span className="text-[13px] font-semibold text-[#171717]">{label}</span>
    </button>
  )
}

function CoverMeta({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">{label}</span>
      <span className={cn('text-[15px] font-semibold', accent ? 'text-[#931115]' : 'text-[#171717]')}>{value}</span>
    </div>
  )
}

function PageHeading({ title, right }: { title: string; right: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-2xl font-bold tracking-[-0.3px] text-[#171717]">{title}</h2>
        <span className="text-[11.5px] font-semibold text-[#A1A1A1]">{right}</span>
      </div>
      <div className="mb-[18px] mt-3 h-[3px] w-[52px] bg-[#931115]" />
    </>
  )
}

function PageFooter({ left, right }: { left: string; right: string }) {
  return <div className="flex justify-between text-[11.5px] text-[#A1A1A1]"><span>{left}</span><span>{right}</span></div>
}

function EmptyCopy({ text }: { text: string }) {
  return <p className="py-6 text-[13px] text-[#A1A1A1]">{text}</p>
}

function DayPage({
  pageKey,
  title,
  rows,
  reference,
  version,
  page,
  showLegend,
  stats,
}: {
  pageKey: number
  title: string
  rows: (ReturnType<typeof buildSummaryDays>[number] & { date?: string; lines: SummaryLine[] })[]
  reference: string
  version: string
  page: number
  showLegend?: boolean
  stats?: string[][]
}) {
  return (
    <section data-qd-page={pageKey} className={PAGE_CLASS}>
      <PageHeading title={title} right={reference} />
      {showLegend ? (
        <div className="mb-1 flex items-center gap-4 border-b border-[#E5E7EB] pb-3">
          {(['flight', 'transportation', 'activity', 'accommodation'] as const).map((type) => (
            <span key={type} className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              <span className="size-[7px] rounded-full" style={{ background: TYPE_COLORS[type] }} />
              {type === 'accommodation' ? 'Stay' : SUMMARY_TYPE_META[type].name}
            </span>
          ))}
        </div>
      ) : null}
      {rows.length ? rows.map((day) => (
        <div key={`${day.dayNum}-${day.dateLabel}`} className="grid grid-cols-[92px_1fr] gap-3.5 border-b border-[#F4F4F5] py-[11px]">
          <div>
            <span className="block text-[12.5px] font-bold text-[#931115]">{day.dayNum}</span>
            <span className="mt-0.5 block text-[11.5px] text-[#A1A1A1]">{day.date ? fmtDayDate(day.date) : day.dateLabel}</span>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            {day.lines.map((line, index) => (
              <div key={`${line.type}-${line.supplier}-${index}`} className="grid grid-cols-[10px_1fr_auto] items-baseline gap-2.5">
                <span className="size-[7px] rounded-full" style={{ background: TYPE_COLORS[line.type] }} />
                <span className="text-[13px] text-[#171717]">{lineLabel(line)}</span>
                <span className="whitespace-nowrap text-[11.5px] text-[#A1A1A1]">{dayItemDetail(line)}</span>
              </div>
            ))}
          </div>
        </div>
      )) : <EmptyCopy text="No services are available for this part of the itinerary." />}
      <div className="flex-1" />
      {stats ? (
        <div className="mb-3.5 flex items-center gap-7 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-[22px] py-3.5">
          {stats.map(([label, value]) => (
            <span key={label} className="flex flex-col gap-0.5">
              <span className="text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">{label}</span>
              <span className="text-[14px] font-bold text-[#171717]">{value}</span>
            </span>
          ))}
        </div>
      ) : null}
      <PageFooter left={`${reference} · ${version}`} right={`Page ${page}`} />
    </section>
  )
}

function BreakdownPage({
  pageKey,
  title,
  groups,
  visible,
  reference,
  version,
  page,
}: {
  pageKey: number
  title: string
  groups: BreakdownGroup[]
  visible: boolean
  reference: string
  version: string
  page: number
}) {
  return (
    <section data-qd-page={pageKey} className={PAGE_CLASS}>
      <PageHeading title={title} right="All prices in USD" />
      {visible ? (
        <>
          <div className="grid grid-cols-[1fr_92px_96px] gap-x-3 border-b border-[#E5E7EB] pb-2 text-[10.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">
            <span>Service</span><span className="text-right">Qty</span><span className="text-right">Amount</span>
          </div>
          {groups.length ? groups.map((group) => (
            <div key={group.name} className="mt-3.5">
              <div className="grid grid-cols-[1fr_96px] items-baseline gap-3 border-b border-[#EDEFF2] pb-1.5">
                <span className="text-[12px] font-bold uppercase tracking-wide text-[#931115]">{group.name}</span>
                <span className="text-right text-[12.5px] font-bold text-[#931115]">{formatUsd(group.subtotal)}</span>
              </div>
              {group.lines.map((line, index) => (
                <div key={`${line.label}-${index}`} className="grid grid-cols-[1fr_92px_96px] items-baseline gap-x-3 border-b border-[#F6F6F7] py-2">
                  <span className="text-[13px] text-[#171717]">{line.label}<span className="mt-0.5 block text-[11px] text-[#A1A1A1]">{line.detail}</span></span>
                  <span className="text-right text-[11.5px] text-[#737373]">{line.qty}</span>
                  <span className="whitespace-nowrap text-right text-[13px] font-semibold text-[#171717]">{formatUsd(line.amount)}</span>
                </div>
              ))}
            </div>
          )) : <EmptyCopy text="No category detail is available for this page." />}
        </>
      ) : <EmptyCopy text="Price breakdown by category is hidden in document options." />}
      <div className="flex-1" />
      <PageFooter left={`${reference} · ${version}`} right={`Page ${page}`} />
    </section>
  )
}

function PriceTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl border border-[#E5E7EB] px-[18px] py-4">
      <span className="block text-[11.5px] font-bold uppercase tracking-wide text-[#A1A1A1]">{label}</span>
      <span className="mt-1.5 block text-[20px] font-bold text-[#171717]">{value}</span>
    </div>
  )
}

function ScheduleRow({ label, due, amount }: { label: string; due: string; amount: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-[#F1F1F3] py-3">
      <span className="text-[14px] font-semibold text-[#171717]">{label}<span className="mt-0.5 block text-[12px] font-medium text-[#A1A1A1]">{due}</span></span>
      <span className="whitespace-nowrap text-[14.5px] font-semibold text-[#171717]">{amount}</span>
    </div>
  )
}
