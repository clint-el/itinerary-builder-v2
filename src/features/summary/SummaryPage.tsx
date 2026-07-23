import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronDown, ChevronLeft } from 'lucide-react'
import { useStore } from '@/app/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { TAB_META } from '@/shared/lib/catalogs'
import {
  isTerminalStatus,
  marginFromSell,
  parseMoney,
  quoteGroupsTotal,
  transitions,
} from '@/shared/lib/helpers'
import type { LifecycleTransition, QuoteExtra, QuoteGroup, QuoteService } from '@/shared/lib/types'
import { cn, formatDay, formatUsd } from '@/shared/lib/utils'
import { StatusChip } from '@/shared/ui/StatusChip'

const ICON_META = {
  lodge: { initial: 'A', bg: '#ECFDF5', fg: '#059669' },
  vehicle: { initial: 'T', bg: '#FEF3C7', fg: '#D97706' },
  flight: { initial: 'F', bg: '#EFF6FF', fg: '#2563EB' },
} as const

function statusChipStyle(label?: string) {
  const l = String(label || '').toLowerCase()
  if (l === 'confirmed') return { bg: 'rgba(0,212,146,0.14)', fg: '#067A55' }
  if (l === 'hold') return { bg: '#F4E2E3', fg: '#931115' }
  if (l === 'prepared') return { bg: '#DFF2FE', fg: '#0B69A3' }
  return { bg: '#F1F5F9', fg: '#475569' }
}

function groupSubtotal(group: QuoteGroup) {
  return group.services.reduce((sum, sv) => sum + parseMoney(sv.subtotal), 0)
}

function collectHolds(groups: QuoteGroup[]) {
  const holds: { name: string; svc: string; expiry: string }[] = []
  for (const g of groups) {
    for (const sv of g.services) {
      for (const ex of sv.extras || []) {
        if (String(ex.statusLabel || '').toLowerCase() === 'hold') {
          holds.push({
            name: g.name,
            svc: ex.label,
            expiry: ex.statusSub || sv.statusSub || '—',
          })
        }
      }
    }
  }
  return holds
}

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
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})

  const holds = useMemo(() => collectHolds(quoteGroups), [quoteGroups])
  const lifecycle = useMemo(
    () => (itinerary ? transitions(itinerary.status) : []),
    [itinerary],
  )

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

  const quoteTotal = quoteGroupsTotal(quoteGroups)
  const servicesTotal = services.reduce((sum, s) => sum + (s.price || 0), 0)
  // Prefer quote workspace total, then builder services, then stored itinerary total.
  const total =
    quoteGroups.length > 0 ? quoteTotal : services.length > 0 ? servicesTotal : itinerary.totalUsd || 0
  const net = Math.round((total / 1.3) * 100) / 100
  const rack = total
  const margin = Math.round((total - net) * 100) / 100
  const commission = 0
  const sell = total
  const marginPct = marginFromSell(total) ?? 0

  const lead =
    [itinerary.leadFirst, itinerary.leadLast].filter(Boolean).join(' ') ||
    'Lead traveler TBC'
  const agencyLabel = [itinerary.agent, itinerary.agency].filter(Boolean).join(' · ') || itinerary.agency || '—'
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
  const travelDates =
    itinerary.travelDateFrom
      ? `${formatDay(itinerary.travelDateFrom)}${
          itinerary.travelDateTo ? ` – ${formatDay(itinerary.travelDateTo)}` : ''
        }`
      : 'Dates TBC'

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
  }

  function isExpanded(sv: QuoteService) {
    const key = sv.id
    if (key in expanded) return expanded[key]
    return sv.expanded
  }

  function isGroupExpanded(groupId: string) {
    if (groupId in groupExpanded) return groupExpanded[groupId]
    return true
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#F4F4F5]">
      <div className="flex h-14 shrink-0 items-center justify-between gap-4 border-b bg-white px-6">
        <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
          <Link to="/" className="text-sol-brand hover:underline">
            Itineraries
          </Link>
          <span className="text-neutral-300">/</span>
          <span className="truncate font-medium text-muted-foreground">{itinerary.reference}</span>
          <span className="text-neutral-300">/</span>
          <span>Summary</span>
        </div>
        <Button variant="outline" onClick={() => navigate(`/build/${id}`)}>
          <ChevronLeft />
          Back to editing
        </Button>
      </div>

      <div className="mx-auto flex min-h-0 w-full max-w-[1080px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-6">
        <Card className="rounded-[14px] shadow-none">
          <CardHeader className="gap-4 pb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
                  <CardTitle className="text-[22px]">{itinerary.title || 'Untitled itinerary'}</CardTitle>
                  <StatusChip status={itinerary.status} />
                  {itinerary.creditTerms ? (
                    <span className="inline-flex h-6 items-center rounded-[7px] bg-indigo-50 px-2.5 text-[11.5px] font-semibold text-indigo-700">
                      Credit terms
                    </span>
                  ) : null}
                  {itinerary.financeLocked ? (
                    <span className="inline-flex h-6 items-center rounded-[7px] bg-slate-100 px-2.5 text-[11.5px] font-semibold text-slate-600">
                      Finance locked
                    </span>
                  ) : null}
                </div>
                <p className="text-[13px] font-medium text-muted-foreground">
                  {itinerary.reference} · {destination}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Meta label="Lead Traveler" value={lead} />
            <Meta label="Agency" value={agencyLabel} />
            <Meta label="Travel Dates" value={travelDates} />
            <Meta label="Guests" value={guests} />
            <Meta label="Destination" value={destination} />
            <Meta label="Safari Planner" value={itinerary.safariPlanner || '—'} />
          </CardContent>
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="rounded-[14px] shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Itinerary Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5">
              {quoteGroups.length > 0 ? (
                quoteGroups.map((g) => {
                  const icon = ICON_META[g.icon] || ICON_META.lodge
                  const openGroup = isGroupExpanded(g.id)
                  return (
                    <div key={g.id} className="overflow-hidden rounded-[10px] border border-neutral-100">
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-2.5 bg-neutral-50 px-3.5 py-2.5 text-left',
                          openGroup && 'border-b border-neutral-100',
                        )}
                        aria-expanded={openGroup}
                        onClick={() =>
                          setGroupExpanded((prev) => ({ ...prev, [g.id]: !openGroup }))
                        }
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <ChevronDown
                            className={cn(
                              'size-3.5 shrink-0 text-muted-foreground transition-transform',
                              !openGroup && '-rotate-90',
                            )}
                          />
                          <span
                            className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] text-xs font-bold"
                            style={{ background: icon.bg, color: icon.fg }}
                          >
                            {icon.initial}
                          </span>
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-bold">{g.name}</div>
                            <div className="text-[11.5px] text-muted-foreground">{g.loc || '—'}</div>
                          </div>
                        </div>
                        <span className="shrink-0 text-[13px] font-bold">{formatUsd(groupSubtotal(g))}</span>
                      </button>
                      {openGroup ? (
                        <div className="flex flex-col">
                          {g.services.map((sv) => {
                            const chip = statusChipStyle(sv.statusLabel)
                            const open = isExpanded(sv)
                            return (
                              <div key={sv.id} className="border-b border-neutral-50 last:border-b-0">
                                <button
                                  type="button"
                                  className="flex w-full items-center justify-between gap-2.5 px-3.5 py-2.5 text-left"
                                  onClick={() =>
                                    setExpanded((prev) => ({ ...prev, [sv.id]: !open }))
                                  }
                                >
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold">
                                      {sv.title}
                                      {sv.sub ? ` ${sv.sub}` : ''}
                                      {sv.isNew ? (
                                        <Badge variant="info" className="ml-2 align-middle">
                                          New
                                        </Badge>
                                      ) : null}
                                    </div>
                                    <div className="text-[11.5px] text-muted-foreground">
                                      {sv.dates || '—'} · {sv.alloc || '—'}
                                    </div>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-2.5">
                                    <span
                                      className="inline-flex h-[22px] items-center rounded-full px-2.5 text-[11.5px] font-semibold"
                                      style={{ background: chip.bg, color: chip.fg }}
                                    >
                                      {sv.statusLabel}
                                    </span>
                                    <span className="min-w-[74px] text-right text-[12.5px] font-semibold">
                                      {sv.subtotal}
                                    </span>
                                  </div>
                                </button>
                                {open && sv.extras?.length ? (
                                  <div className="space-y-1 bg-neutral-50/70 px-3.5 pb-2.5">
                                    {sv.extras.map((ex, i) => (
                                      <ExtraRow key={`${sv.id}-ex-${i}`} extra={ex} />
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  )
                })
              ) : services.length > 0 ? (
                services.map((svc) => {
                  const meta = TAB_META[svc.tab]
                  const openGroup = isGroupExpanded(svc.id)
                  return (
                    <div key={svc.id} className="overflow-hidden rounded-lg border bg-neutral-50">
                      <button
                        type="button"
                        className="flex w-full items-start gap-3 p-3 text-left"
                        aria-expanded={openGroup}
                        onClick={() =>
                          setGroupExpanded((prev) => ({ ...prev, [svc.id]: !openGroup }))
                        }
                      >
                        <ChevronDown
                          className={cn(
                            'mt-1 size-3.5 shrink-0 text-muted-foreground transition-transform',
                            !openGroup && '-rotate-90',
                          )}
                        />
                        <span
                          className="flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.initial}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold">{svc.title}</div>
                              {openGroup ? (
                                <>
                                  <div className="text-xs text-muted-foreground">{svc.subtitle}</div>
                                  <div className="mt-1 text-xs font-medium text-neutral-600">
                                    {svc.meta}
                                  </div>
                                </>
                              ) : null}
                            </div>
                            <div className="text-sm font-bold">{svc.priceLabel}</div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )
                })
              ) : (
                <p className="text-sm text-muted-foreground">No services added yet.</p>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="rounded-[14px] shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                <Row label="Net cost" value={formatUsd(net)} />
                <Row label="Rack" value={formatUsd(rack)} />
                <Row label={`Margin (${marginPct}%)`} value={formatUsd(margin)} accent />
                <Row label="Agent commission (0%)" value={formatUsd(commission)} />
                <Separator className="my-1" />
                <Row label="Sell total" value={formatUsd(sell)} strong />
              </CardContent>
            </Card>

            <Card className="rounded-[14px] shadow-none">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">Holds</CardTitle>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Soonest: {holds[0]?.expiry || '—'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {holds.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    {holds.map((h, i) => (
                      <div
                        key={`${h.name}-${h.svc}-${i}`}
                        className="flex items-center justify-between gap-2.5 rounded-lg border border-neutral-100 px-2.5 py-2"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-semibold">{h.name}</div>
                          <div className="text-[11px] text-muted-foreground">{h.svc}</div>
                        </div>
                        <span className="shrink-0 text-[11.5px] font-semibold text-sol-brand">
                          Exp {h.expiry}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-[13px] text-muted-foreground">No active holds.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-4 border-t bg-white px-6 py-3.5">
        <div className="flex items-center gap-2.5 text-[13px] text-neutral-500">
          <StatusChip status={itinerary.status} />
          <span>{nextHint}</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2.5">
          {lifecycle.length === 0 ? (
            <span className="text-[13px] italic text-muted-foreground">No further actions in this state.</span>
          ) : (
            lifecycle.map((t) => (
              <button
                key={`${t.to}-${t.label}`}
                type="button"
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold',
                  transitionButtonClass(t),
                )}
                onClick={() => applyTransition(t)}
              >
                {t.label}
                {t.reason ? ' *' : ''}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function ExtraRow({ extra }: { extra: QuoteExtra }) {
  const chip = statusChipStyle(extra.statusLabel)
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5">
      <div className="min-w-0">
        <div className={cn('truncate text-xs font-semibold', extra.isDiscount && 'text-emerald-700')}>
          {extra.label}
          {extra.isNew ? (
            <Badge variant="info" className="ml-1.5 align-middle">
              New
            </Badge>
          ) : null}
        </div>
        {(extra.dates || extra.alloc) && (
          <div className="text-[11px] text-muted-foreground">
            {[extra.dates, extra.alloc].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {extra.statusLabel ? (
          <span
            className="inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-semibold"
            style={{ background: chip.bg, color: chip.fg }}
          >
            {extra.statusLabel}
          </span>
        ) : null}
        {extra.pct ? <span className="text-[11px] font-semibold text-muted-foreground">{extra.pct}</span> : null}
        <span className="min-w-[64px] text-right text-xs font-semibold">{extra.amount || '—'}</span>
      </div>
    </div>
  )
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.3px] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm font-semibold">{value || '—'}</div>
    </div>
  )
}

function Row({
  label,
  value,
  strong,
  accent,
}: {
  label: string
  value: string
  strong?: boolean
  accent?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', strong ? 'text-[15px]' : 'text-[13px]')}>
      <span className={strong ? 'font-bold text-foreground' : 'text-neutral-500'}>{label}</span>
      <span
        className={cn(
          strong ? 'font-bold' : 'font-semibold',
          accent && 'text-emerald-600',
        )}
      >
        {value}
      </span>
    </div>
  )
}
