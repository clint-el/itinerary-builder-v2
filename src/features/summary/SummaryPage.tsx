import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarDays, ChevronLeft, List } from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import { isBuilderStatus, isTerminalStatus, nightsBetween, transitions } from '@/shared/lib/helpers'
import type { LifecycleTransition } from '@/shared/lib/types'
import { cn, formatDay } from '@/shared/lib/utils'
import { StatusChip } from '@/shared/ui/StatusChip'
import {
  buildSummaryCards,
  buildSummaryDays,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
} from './summaryModel'

function transitionButtonClass(t: LifecycleTransition) {
  if (t.primary) return 'bg-sol-brand text-white hover:bg-sol-brand/90'
  if (t.danger) return 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
  return 'border border-border bg-white text-neutral-900 hover:bg-neutral-50'
}

export function SummaryPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { itineraries, getServices, getQuoteGroups, updateStatus } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)
  const services = getServices(id)
  const quoteGroups = getQuoteGroups(id)
  const [view, setView] = useState<'summary' | 'byday'>('summary')

  const lifecycle = useMemo(
    () => (itinerary ? transitions(itinerary.status) : []),
    [itinerary],
  )

  const lines = useMemo(() => {
    if (services.length > 0) return linesFromServices(services)
    if (quoteGroups.length > 0) return linesFromQuoteGroups(quoteGroups)
    return []
  }, [services, quoteGroups])

  const cards = useMemo(() => buildSummaryCards(lines), [lines])
  const days = useMemo(() => buildSummaryDays(lines), [lines])
  const pricing = useMemo(() => buildSummaryPricing(lines), [lines])

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
  const guests =
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
      'inline-flex h-9 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold',
      active ? 'bg-[#931115] text-white' : 'bg-transparent text-[#525252]',
    )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F4F4F5]">
      <div className="flex h-14 shrink-0 items-center gap-3.5 border-b bg-white px-6">
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

      <div className="mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-6 py-5">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="mb-1 text-[21px] font-bold text-[#171717]">
                {itinerary.title || 'Untitled itinerary'}
              </h1>
              <div className="text-[13px] font-medium text-[#A1A1A1]">
                {itinerary.reference} · {destination}
              </div>
            </div>
            <StatusChip status={itinerary.status} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Meta label="Lead Traveler" value={lead} />
            <Meta label="Agency" value={itinerary.agency || '—'} />
            <Meta label="Travel Dates" value={travelDates} />
            <Meta label="Guests" value={guests} />
            <Meta
              label="Nights"
              value={nightsCount ? `${nightsCount} night${nightsCount === 1 ? '' : 's'}` : '—'}
            />
          </div>
        </div>

        <div className="inline-flex items-center gap-1 self-start rounded-[11px] border border-[#E5E7EB] bg-white p-1">
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
          <div className="min-w-0 flex-1 space-y-4">
            {lines.length === 0 ? (
              <div className="rounded-[14px] border border-[#E5E7EB] bg-white p-8 text-center text-sm text-muted-foreground">
                No services added yet.
              </div>
            ) : view === 'summary' ? (
              cards.map((c) => (
                <div
                  key={c.type}
                  className="overflow-x-auto overflow-y-hidden rounded-[14px] border border-[#E5E7EB] bg-white"
                >
                  <div
                    className="flex items-center gap-2.5 px-4 py-3.5"
                    style={{ background: c.tint }}
                  >
                    <span
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
                      style={{ background: c.iconBg, color: c.iconFg }}
                    >
                      {c.initial}
                    </span>
                    <span className="text-[14.5px] font-bold text-[#171717]">{c.name}</span>
                    <span className="text-xs font-semibold text-[#A1A1A1]">{c.countLabel}</span>
                  </div>
                  <ServiceTable card={c} />
                </div>
              ))
            ) : (
              <div className="flex flex-col rounded-[14px] border border-[#E5E7EB] bg-white px-5 pb-5 pt-2">
                {days.map((d) => (
                  <div
                    key={d.dayNum + d.dateLabel}
                    className="grid grid-cols-[132px_1fr] gap-5 border-b border-[#F3F4F6] py-4 last:border-0"
                  >
                    <div className="pt-0.5">
                      <div className="text-xs font-bold uppercase tracking-wide text-[#931115]">
                        {d.dayNum}
                      </div>
                      <div className="mt-1 text-[15px] font-bold text-[#171717]">{d.dateLabel}</div>
                      <div className="text-xs font-medium text-[#A1A1A1]">{d.weekday}</div>
                    </div>
                    <div className="flex min-w-0 flex-col gap-3">
                      {d.groups.map((g) => (
                        <div
                          key={`${d.dayNum}-${g.type}`}
                          className="overflow-x-auto overflow-y-hidden rounded-[10px] border border-[#F1F1F3]"
                        >
                          <div
                            className="flex items-center gap-2 px-3.5 py-2"
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
                          <ServiceTable card={g} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="sticky top-0 w-[300px] shrink-0">
            <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-[22px] py-5">
              <div className="mb-3.5 text-base font-bold text-[#171717]">Pricing</div>
              <div className="mb-4 flex flex-col gap-3.5">
                {pricing.priceGroups.map((g) => (
                  <div key={g.name}>
                    <div className="mb-1 text-[10.5px] font-bold uppercase tracking-wide text-[#94A3B8]">
                      {g.name}
                    </div>
                    {g.items.map((li, i) => (
                      <div
                        key={`${g.name}-${i}`}
                        className="flex items-baseline justify-between gap-2.5 border-b border-[#F3F4F6] py-1.5"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-semibold text-[#171717]">
                            {li.supplier}
                          </div>
                          <div className="truncate text-[11px] text-[#A1A1A1]">{li.desc}</div>
                        </div>
                        <span className="whitespace-nowrap text-[12.5px] font-semibold text-[#171717]">
                          {li.value}
                        </span>
                      </div>
                    ))}
                    <div className="flex items-baseline justify-between gap-2.5 py-1.5">
                      <span className="text-xs font-bold text-[#931115]">{g.name} total</span>
                      <span className="text-[12.5px] font-bold text-[#931115]">{g.subtotal}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3">
                {pricing.pricing.map((p) => (
                  <div key={p.label} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] text-[#737373]">{p.label}</span>
                    <span className="text-[13.5px] font-semibold" style={{ color: p.color }}>
                      {p.value}
                    </span>
                  </div>
                ))}
              </div>
              <div className="my-4 h-px bg-[#E5E7EB]" />
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14.5px] font-bold text-[#171717]">Sell total</span>
                <span className="text-[15px] font-bold text-[#171717]">{pricing.sellTotal}</span>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t bg-white px-6 py-3">
        <div className="flex min-w-0 items-center gap-3 text-[13px] text-[#525252]">
          <Button variant="outline" onClick={() => navigate(`/build/${id}`)}>
            <ChevronLeft />
            Back to editing
          </Button>
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

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-[#A1A1A1]">
        {label}
      </div>
      <div className="text-sm font-semibold text-[#171717]">{value}</div>
    </div>
  )
}

function ServiceTable({
  card,
}: {
  card: {
    gridCols: string
    headers: { label: string; align: 'l' | 'c' }[]
    rows: { cells: string[] }[]
  }
}) {
  return (
    <>
      <div className="grid items-stretch" style={{ gridTemplateColumns: card.gridCols }}>
        {card.headers.map((h) => (
          <div
            key={h.label}
            className={cn(
              'flex items-center border-y border-[#EDEFF2] bg-[#FBFBFC] px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-wide text-[#94A3B8]',
              h.align === 'c' && 'justify-center text-center',
            )}
          >
            {h.label}
          </div>
        ))}
      </div>
      {card.rows.map((r, ri) => (
        <div
          key={ri}
          className="grid items-stretch"
          style={{ gridTemplateColumns: card.gridCols }}
        >
          {r.cells.map((cell, ci) => (
            <div
              key={ci}
              className={cn(
                'flex min-w-0 items-center border-b border-[#F3F4F6] px-3.5 py-3 text-[13px] text-[#171717]',
                card.headers[ci]?.align === 'c' && 'justify-center text-center',
                ci === 0 && 'text-[#737373]',
                ci === 1 && 'font-semibold',
              )}
            >
              <span className="truncate">{cell}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  )
}
