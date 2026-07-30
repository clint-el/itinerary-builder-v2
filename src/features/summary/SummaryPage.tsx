import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, ChevronRight, FileText, List } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  isBuilderStatus,
  isTerminalStatus,
  nightsBetween,
  partyGuests,
  transitions,
} from '@/shared/lib/helpers'
import type { LifecycleTransition } from '@/shared/lib/types'
import { cn, formatDay } from '@/shared/lib/utils'
import { StatusChip } from '@/shared/ui/StatusChip'
import {
  buildSummaryCards,
  buildSummaryDays,
  buildSummaryPricing,
  GRID,
  holdsSummaryOf,
  linesFromQuoteGroups,
  linesFromServices,
  type SummaryBlock,
  type SummaryCard,
  type SummaryCell,
} from './summaryModel'

function transitionButtonClass(t: LifecycleTransition) {
  if (t.primary) return 'bg-sol-brand text-white hover:bg-sol-brand/90'
  if (t.danger) return 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
  return 'border border-border bg-white text-neutral-900 hover:bg-neutral-50'
}

function marginTone(text: string) {
  const m = /^(-?\d+)%/.exec(text)
  if (!m) return '#A1A1A1'
  const p = Number(m[1])
  if (p >= 30) return '#059669'
  if (p >= 15) return '#B45309'
  if (p > 0) return '#931115'
  return '#A1A1A1'
}

function holdTone(text: string) {
  if (text === 'On hold') return '#0369A1'
  if (text === 'Requested') return '#B45309'
  return '#C4C4C8'
}

function cellClass(align: 'l' | 'c' | 'r', dense: boolean, label: string) {
  const base = cn(
    'flex min-w-0 items-center whitespace-nowrap text-[13px] text-[#171717]',
    dense ? 'py-1.5' : 'py-2.5',
    'px-3.5',
    align === 'c' && 'justify-center text-center',
    align === 'r' && 'justify-end text-right tabular-nums',
  )
  if (label === 'Hold') return cn(base, 'text-[11.5px] font-semibold')
  if (label === 'Supplier') return cn(base, 'font-semibold')
  if (label === 'Date') return cn(base, 'text-[#737373]')
  if (label.includes('Per Adult')) return cn(base, 'text-[12px] text-[#737373]')
  if (label.includes('Cost / Sell')) return cn(base, 'text-[12.5px] font-semibold')
  return base
}

function headerClass(align: 'l' | 'c' | 'r', dense: boolean) {
  return cn(
    'flex items-center bg-[#FCFCFD] px-3.5 text-[10.5px] font-bold uppercase tracking-wide text-[#B4B4BA]',
    dense ? 'py-[7px]' : 'py-[9px]',
    align === 'c' && 'justify-center',
    align === 'r' && 'justify-end',
  )
}

export function SummaryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { itineraries, getServices, getQuoteGroups, getGuestDetails, updateStatus } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const [view, setView] = useState<'summary' | 'byday'>('summary')
  const [openPriceGroups, setOpenPriceGroups] = useState<Record<string, boolean>>({})
  const [depositsOpen, setDepositsOpen] = useState(false)

  const guests = useMemo(
    () => (itinerary ? partyGuests(itinerary, getGuestDetails(id)) : []),
    [itinerary, id, getGuestDetails],
  )

  const lifecycle = useMemo(
    () => (itinerary ? transitions(itinerary.status) : []),
    [itinerary],
  )

  const lines = useMemo(() => {
    if (services.length > 0) return linesFromServices(services, guests)
    if (quoteGroups.length > 0) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [services, quoteGroups, guests])

  const cards = useMemo(() => buildSummaryCards(lines), [lines])
  const days = useMemo(() => buildSummaryDays(lines), [lines])
  const totalGuests =
    guests.length || (itinerary ? (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0) : 0)
  const pricing = useMemo(() => buildSummaryPricing(lines, totalGuests), [lines, totalGuests])
  const holdRollup = useMemo(() => holdsSummaryOf(lines), [lines])
  const byDaySections = useMemo(() => {
    const keys = [...new Set(lines.map((line) => line.date || 'undated'))].sort()
    return days.map((day, index) => ({
      ...day,
      cards: buildSummaryCards(lines.filter((line) => (line.date || 'undated') === keys[index])),
    }))
  }, [days, lines])

  if (!itinerary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F6F6F7]">
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
    : lifecycle.length
      ? 'Choose the next step.'
      : 'No manual transitions available.'

  function applyTransition(t: LifecycleTransition) {
    if (t.reason) {
      const reason = window.prompt(`Reason for: ${t.label}`)
      if (reason == null || !reason.trim()) return
    }
    updateStatus(id, t.to)
    if (isBuilderStatus(t.to)) navigate(`/build/${id}`)
  }

  const tabClass = (active: boolean) =>
    cn(
      'inline-flex h-8 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold',
      active ? 'bg-[#931115] text-white' : 'bg-transparent text-[#71717A]',
    )

  return (
    <div className="flex min-h-screen flex-col bg-[#F6F6F7]">
      <div className="flex h-14 shrink-0 items-center gap-3.5 border-b border-[#E7E7EA] bg-white px-6">
        <img src="/assets/sol-logo.svg" alt="SOL" className="h-auto w-[30px]" />
        <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#A1A1A1]">
          <Link to="/" className="text-[#931115] hover:text-[#7a0e12]">
            Inquiries
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="truncate">{itinerary.reference}</span>
          <span className="text-neutral-300">/</span>
          <span className="text-[#171717]">Summary</span>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1920px] flex-1 flex-col gap-4 px-6 py-6 pb-10">
        <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-6 py-5">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-[21px] font-bold text-[#171717]">
                {itinerary.title || 'Untitled itinerary'}
              </h1>
              <div className="mt-1 text-[13px] font-medium text-[#A1A1A1]">
                {itinerary.reference} · {destination}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className="inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12px] font-bold"
                style={{ background: holdRollup.bg, color: holdRollup.fg }}
              >
                <span className="size-1.5 rounded-full" style={{ background: holdRollup.fg }} />
                {holdRollup.chip}
              </span>
              <StatusChip status={itinerary.status} />
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

        <div className="flex w-fit items-center gap-1 rounded-[11px] border border-[#E5E7EB] bg-white p-[5px]">
          <button type="button" className={tabClass(view === 'summary')} onClick={() => setView('summary')}>
            <List className="size-3.5" />
            Summary
          </button>
          <button type="button" className={tabClass(view === 'byday')} onClick={() => setView('byday')}>
            <CalendarDays className="size-3.5" />
            By Day
          </button>
        </div>

        <div className="flex items-start gap-4">
          <main className="min-w-0 flex-1 space-y-4">
            {lines.length === 0 ? (
              <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-8 text-center text-sm text-muted-foreground">
                No services added yet.
              </div>
            ) : view === 'summary' ? (
              cards.map((c) => <ServiceCard key={c.type} card={c} />)
            ) : (
              <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-5 pb-5 pt-2">
                {byDaySections.map((d) => (
                  <div
                    key={d.dayNum + d.dateLabel}
                    className="grid grid-cols-[132px_minmax(0,1fr)] gap-5 border-b border-[#F3F4F6] py-4 last:border-0"
                  >
                    <div className="pt-0.5">
                      <div className="text-[12px] font-bold uppercase tracking-[0.4px] text-[#931115]">
                        {d.dayNum}
                      </div>
                      <div className="mt-1 text-[15px] font-bold text-[#171717]">{d.dateLabel}</div>
                      <div className="text-xs font-medium text-[#A1A1A1]">{d.weekday}</div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      {d.cards.map((card) => (
                        <ServiceCard key={card.type} card={card} compact />
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )}
          </main>

          <aside className="sticky top-4 w-[330px] shrink-0">
            <section className="rounded-[14px] border border-[#E5E7EB] bg-white px-[22px] py-5">
              <h2 className="mb-3.5 text-[16px] font-bold text-[#171717]">Pricing</h2>
              <div className="mb-3 flex items-baseline justify-between border-b border-[#E5E7EB] pb-2 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                <span>Service</span>
                <span>Sell price</span>
              </div>
              <div className="mb-4 flex flex-col">
                {cards.map((card) => {
                  const open = !!openPriceGroups[card.type]
                  return (
                    <div key={card.type} className="border-b border-[#F3F4F6]">
                      <button
                        type="button"
                        onClick={() =>
                          setOpenPriceGroups((current) => ({ ...current, [card.type]: !current[card.type] }))
                        }
                        className="flex w-full items-center gap-2 py-2 text-left"
                      >
                        <ChevronRight
                          className={cn('size-3 shrink-0 text-[#A1A1A1] transition-transform', open && 'rotate-90')}
                        />
                        <span className="min-w-0 flex-1 text-[12.5px] font-semibold text-[#171717]">{card.name}</span>
                        <span className="whitespace-nowrap text-[11px] text-[#A1A1A1]">{card.countLabel}</span>
                        <span className="whitespace-nowrap text-[12.5px] font-bold text-[#171717]">{card.subtotal}</span>
                      </button>
                      {open ? (
                        <div className="flex flex-col gap-1.5 pb-2 pl-5">
                          {card.blocks.map((block) => (
                            <div key={block.key} className="flex items-baseline justify-between gap-2 text-[11.5px]">
                              <span className="min-w-0 truncate text-[#525252]" title={block.name}>
                                {block.name} <span className="text-[#A1A1A1]">{block.meta}</span>
                              </span>
                              <span className="shrink-0 font-medium text-[#525252]">{block.subtotal}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            {pricing.hasDiscounts ? (
              <div className="mb-4 rounded-[10px] border border-[#E5E7EB] px-3.5 py-3">
                <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
                  Special offers &amp; discounts
                </div>
                <div className="flex flex-col gap-3">
                  {pricing.discounts.map((d, i) => (
                    <div key={d.label} className={cn(i > 0 && 'border-t border-[#F3F4F6] pt-3')}>
                      <div className="text-[12.5px] font-semibold text-[#171717]">{d.label}</div>
                      <div className="mt-1 text-[11px] font-semibold text-[#059669]">Applied to cost &amp; sell · {d.pct}</div>
                      <div className="mt-1.5 flex items-baseline gap-3 text-[11.5px] text-[#A1A1A1]">
                        <span>Cost <b className="text-[#171717]">{d.costDelta}</b></span>
                        <span>Sell <b className="text-[#171717]">{d.sellDelta}</b></span>
                      </div>
                    </div>
                  ))}
                </div>
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
                <span className="text-[14.5px] font-bold text-[#171717]">Sell total</span>
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
                <span className="text-[15px] font-bold text-[#931115]">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                    pricing.sellNumber * 0.3,
                  )}
                </span>
              </button>
              <div className="mt-1 flex justify-between pl-5 text-[11.5px] text-[#A1A1A1]">
                <span>30% · due on confirmation</span>
                <span>
                  Balance{' '}
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                    pricing.sellNumber * 0.7,
                  )}
                </span>
              </div>
              {depositsOpen ? (
                <div className="mt-2 border-t border-[#F3F4F6] pt-2 pl-5 text-[11.5px] text-[#525252]">
                  Supplier deposits are calculated from the applicable contract terms.
                </div>
              ) : null}
            </section>
          </aside>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#E7E7EA] bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 text-[13px] text-[#525252]">
          <Button variant="outline" onClick={() => navigate(`/build/${id}`)}>
            <ChevronLeft />
            Back to editing
          </Button>
          {lines.length > 0 ? (
            <Button variant="outline" onClick={() => navigate(`/quote-doc/${id}`)}>
              <FileText />
              View quote PDF
            </Button>
          ) : null}
          <StatusChip status={itinerary.status} />
          <span className="truncate">{nextHint}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {lifecycle.length === 0 ? (
            <span className="text-[13px] italic text-[#A1A1A1]">No further actions in this state.</span>
          ) : (
            lifecycle.map((t) => (
              <Button
                key={t.to}
                className={transitionButtonClass(t)}
                variant={t.primary ? 'default' : 'outline'}
                onClick={() => applyTransition(t)}
              >
                {t.label}
              </Button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ServiceCard({ card: c, compact = false }: { card: SummaryCard; compact?: boolean }) {
  return (
    <section className={cn('overflow-hidden border border-[#E5E7EB] bg-white', compact ? 'rounded-[10px]' : 'rounded-[14px]')}>
      <div className={cn('flex items-center gap-2.5 border-b border-[#F1F1F3]', compact ? 'px-3.5 py-2.5' : 'px-[18px] py-3.5')}>
        <span
          className={cn(
            'flex shrink-0 items-center justify-center font-bold',
            compact ? 'size-6 rounded-md text-[11px]' : 'size-7 rounded-lg text-[12px]',
          )}
          style={{ background: c.iconBg, color: c.iconFg }}
        >
          {c.initial}
        </span>
        <span className={cn('font-bold text-[#171717]', compact ? 'text-[13px]' : 'text-[14.5px]')}>{c.name}</span>
        <span className="text-[12px] font-semibold text-[#A1A1A1]">{c.countLabel}</span>
      </div>
      <div className="overflow-x-auto overscroll-x-contain">
        <div style={{ minWidth: c.type === 'transportation' ? 1180 : c.type === 'flight' ? 1080 : 1000 }}>
          <div className="grid" style={{ gridTemplateColumns: GRID[c.type] }}>
            {c.headers.map((h) => (
              <div key={h.label} className={headerClass(h.align, compact)}>
                {h.label}
              </div>
            ))}
          </div>
          {c.blocks.map((b) => (
            <ServiceBlock key={b.key} block={b} gridCols={GRID[c.type]} headers={c.headers} dense={compact} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ServiceBlock({
  block: b,
  gridCols,
  headers,
  dense,
}: {
  block: SummaryBlock
  gridCols: string
  headers: SummaryCell[]
  dense: boolean
}) {
  return (
    <div>
      {b.rows.map((r, ri) =>
        r.isChild ? (
          <div
            key={ri}
            className={cn('flex items-center gap-2.5 border-b border-[#F6F6F7] pl-[34px] pr-3.5', dense ? 'py-1.5' : 'py-2')}
          >
            <span className="flex-none rounded-[5px] bg-[#F4F4F5] px-[7px] py-[3px] text-[9.5px] font-bold uppercase tracking-wide text-[#71717A]">
              Extra
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#3F3F46]">{r.cells[0]}</span>
            <span className="flex-none whitespace-nowrap text-[11.5px] font-medium text-[#B4B4BA]">{r.meta}</span>
            <span className="flex flex-none items-baseline gap-0 tabular-nums">
              <span className="w-[76px] text-right text-xs text-[#A1A1A1]">{r.cells[1]}</span>
              <span className="w-[76px] text-right text-[12.5px] font-semibold text-[#3F3F46]">{r.cells[2]}</span>
              <span className="w-[70px] text-right text-xs font-semibold" style={{ color: marginTone(r.cells[3]) }}>
                {r.cells[3]}
              </span>
            </span>
          </div>
        ) : (
          <div key={ri} className="grid" style={{ gridTemplateColumns: gridCols }}>
            {r.cells.map((cell, ci) => {
              const header = headers[ci]
              const align = header?.align ?? 'l'
              const cls = cellClass(align, dense, header?.label || '')
              if (header?.label === 'Hold') return (
                <div key={ci} className={cls} style={{ color: holdTone(cell) }}>
                  {cell}
                </div>
              )
              return (
                <div key={ci} className={cn(cls, 'truncate')}>
                  {cell}
                </div>
              )
            })}
          </div>
        ),
      )}
    </div>
  )
}
