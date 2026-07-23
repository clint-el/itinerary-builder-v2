import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useStore } from '@/app/store'
import { AddServiceOverlay } from '@/features/quote/AddServiceOverlay'
import { GuestDrawer } from '@/features/quote/GuestDrawer'
import { PriceModal } from '@/features/quote/PriceModal'
import { STATUS_META } from '@/shared/lib/catalogs'
import { marginFromSell, nightsBetween, quoteGroupsTotal } from '@/shared/lib/helpers'
import type { QuoteExtra, QuoteGroup, QuoteService } from '@/shared/lib/types'
import { cn, formatDay, formatUsd } from '@/shared/lib/utils'
import { Sidebar } from '@/shared/ui/Sidebar'

const STORAGE_KEY = 'sol-demo-sidebar-collapsed'
const GRID_COLS = 'minmax(0,1fr) 46px 56px 176px 88px 128px 104px'

type QuoteTab = 'itinerary' | 'activity' | 'guests' | 'documents' | 'finance'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function DragHandle() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#D4D4D8"
      strokeWidth="2"
      strokeLinecap="round"
      className="shrink-0 cursor-grab"
    >
      <circle cx="9" cy="6" r="1" />
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="18" r="1" />
      <circle cx="15" cy="6" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="18" r="1" />
    </svg>
  )
}

function GroupIcon({ icon }: { icon: QuoteGroup['icon'] }) {
  if (icon === 'vehicle') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#931115" strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    )
  }
  if (icon === 'flight') {
    return (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#931115" strokeWidth="2">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
      </svg>
    )
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#931115" strokeWidth="2">
      <path d="M10 22v-6.57" />
      <path d="M12 11h.01" />
      <path d="M12 7h.01" />
      <path d="M14 15.43V22" />
      <path d="M15 16a5 5 0 0 0-6 0" />
      <path d="M16 11h.01" />
      <path d="M16 7h.01" />
      <path d="M8 11h.01" />
      <path d="M8 7h.01" />
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  )
}

export function QuotePage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { itineraries, getQuoteGroups, saveQuoteGroups, updateStatus } = useStore()
  const itinerary = itineraries.find((it) => it.id === id)

  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [tab, setTab] = useState<QuoteTab>('itinerary')
  const [groups, setGroups] = useState<QuoteGroup[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [guestOpen, setGuestOpen] = useState(false)
  const [priceOpen, setPriceOpen] = useState(false)
  const [dragGroupId, setDragGroupId] = useState<string | null>(null)
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null)
  const [dragSvc, setDragSvc] = useState<{ groupId: string; serviceId: string } | null>(null)
  const [dragOverSvc, setDragOverSvc] = useState<{ groupId: string; serviceId: string } | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    if (!id) return
    setGroups(structuredClone(getQuoteGroups(id)))
  }, [id, getQuoteGroups])

  const persist = useCallback(
    (next: QuoteGroup[]) => {
      setGroups(next)
      if (id) saveQuoteGroups(id, next)
    },
    [id, saveQuoteGroups],
  )

  const totals = useMemo(() => {
    const total = quoteGroupsTotal(groups)
    return { total, marginPct: marginFromSell(total) ?? 0 }
  }, [groups])

  if (!itinerary) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#F4F4F5]">
        <p className="text-sm text-[#A1A1A1]">Itinerary not found.</p>
        <Link to="/" className="text-sm font-semibold text-[#2563EB]">
          Back to inquiries
        </Link>
      </div>
    )
  }

  const statusMeta = STATUS_META[itinerary.status] ?? STATUS_META.DRAFT
  const nights = nightsBetween(itinerary.travelDateFrom, itinerary.travelDateTo)
  const guestsLabel =
    itinerary.guestsLabel ||
    [
      itinerary.adults ? `${itinerary.adults}A` : '',
      itinerary.children ? `${itinerary.children}C` : '',
      itinerary.infants ? `${itinerary.infants}In` : '',
    ]
      .filter(Boolean)
      .join(', ') ||
    '—'
  const destLabel =
    (itinerary.destinations && itinerary.destinations.length
      ? itinerary.destinations.join(', ')
      : itinerary.destination) || '—'
  const lead =
    [itinerary.leadFirst, itinerary.leadLast].filter(Boolean).join(' ') || 'Lead traveler TBC'
  const agencyLabel = itinerary.agency || '—'
  const agentLabel = itinerary.agent || agencyLabel

  function toggleService(groupId: string, serviceId: string) {
    persist(
      groups.map((g) =>
        g.id !== groupId
          ? g
          : {
              ...g,
              services: g.services.map((sv) =>
                sv.id !== serviceId ? sv : { ...sv, expanded: !sv.expanded },
              ),
            },
      ),
    )
  }

  function onGroupDrop(targetId: string) {
    if (!dragGroupId || dragGroupId === targetId) {
      setDragGroupId(null)
      setDragOverGroupId(null)
      return
    }
    const next = [...groups]
    const from = next.findIndex((g) => g.id === dragGroupId)
    const to = next.findIndex((g) => g.id === targetId)
    if (from < 0 || to < 0) return
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    persist(next)
    setDragGroupId(null)
    setDragOverGroupId(null)
  }

  function onServiceDrop(groupId: string, targetServiceId: string) {
    if (!dragSvc || dragSvc.groupId !== groupId) {
      setDragSvc(null)
      setDragOverSvc(null)
      return
    }
    persist(
      groups.map((g) => {
        if (g.id !== groupId) return g
        const list = [...g.services]
        const from = list.findIndex((s) => s.id === dragSvc.serviceId)
        const to = list.findIndex((s) => s.id === targetServiceId)
        if (from < 0 || to < 0) return g
        const [item] = list.splice(from, 1)
        list.splice(to, 0, item)
        return { ...g, services: list }
      }),
    )
    setDragSvc(null)
    setDragOverSvc(null)
  }

  function handlePrepared() {
    // Only promote Draft → Prepared; never regress later lifecycle states.
    if (itinerary?.status === 'DRAFT') updateStatus(id, 'PREPARED')
    navigate(`/summary/${id}`)
  }

  function onTabClick(next: QuoteTab) {
    if (next === 'guests') {
      setGuestOpen(true)
      return
    }
    setTab(next)
  }

  const tabs: { id: QuoteTab; label: string }[] = [
    { id: 'itinerary', label: 'Itinerary' },
    { id: 'activity', label: 'Activity Log' },
    { id: 'guests', label: 'Guests Details' },
    { id: 'documents', label: 'Documents' },
    { id: 'finance', label: 'Finance' },
  ]

  return (
    <div className="flex h-full overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#F4F4F5]">
        <div className="flex h-14 shrink-0 items-center justify-end border-b border-[#E5E7EB] bg-white px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full border border-[#E5E7EB] bg-[#F3F4F6] text-[#A1A1A1]">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-[#171717]">Amelia Earhart</div>
              <div className="text-xs text-[#A1A1A1]">a.earhart@cps.com</div>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-end gap-4 border-b border-[#931115] bg-white px-4 pt-3.5">
          <div className="flex items-center gap-1.5 whitespace-nowrap pb-1.5 text-[13px] font-semibold">
            <Link to="/" className="text-[#2563EB] no-underline">
              Itineraries
            </Link>
            <Chevron />
            <span className="text-[#171717]">{itinerary.reference}</span>
            <Chevron />
            <Link to={`/build/${itinerary.id}`} className="text-[#2563EB] no-underline">
              Builder
            </Link>
            <Chevron />
            <Link to={`/summary/${itinerary.id}`} className="text-[#2563EB] no-underline">
              Summary
            </Link>
          </div>
          <div className="flex flex-1 items-center gap-0.5 rounded-t-xl bg-[#E5E7EB] p-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabClick(t.id)}
                className={cn(
                  'h-7 flex-1 whitespace-nowrap rounded-lg border-0 text-sm font-semibold',
                  tab === t.id && t.id !== 'guests'
                    ? 'bg-[#931115] text-white'
                    : 'bg-transparent text-[#171717]',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-white">
          {tab === 'itinerary' ? (
            <>
              <div className="flex shrink-0 items-center gap-5 border-b border-[#E5E7EB] px-4 py-3 pr-6">
                <div className="flex w-[120px] shrink-0 flex-col gap-2">
                  <div className="flex items-center text-xs font-semibold">
                    <span className="text-[#A1A1A1]">ID:</span>
                    <span className="text-[#171717]">{itinerary.reference}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-bold tracking-wide text-[#171717]">
                      {statusMeta.label.toUpperCase()}
                    </span>
                    <span
                      className="size-2 rounded-full"
                      style={{ background: statusMeta.dot }}
                    />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-8 overflow-hidden">
                  <Meta label="Title" value={itinerary.title} />
                  <Meta label="Lead Traveler" value={lead} />
                  <Meta label="Agency" value={agencyLabel} muted={!itinerary.agency} />
                  <Meta label="Safari Planner" value={itinerary.safariPlanner || '—'} />
                  <Meta label="Agent" value={agentLabel} />
                  <Meta label="OPS" value="Not assigned" muted />
                </div>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#E5E7EB] px-4 py-2 pr-6">
                <div className="flex flex-wrap items-center gap-5">
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#171717]">
                    <CalIcon />
                    {formatDay(itinerary.travelDateFrom)}
                    {itinerary.travelDateTo ? ` - ${formatDay(itinerary.travelDateTo)}` : ''}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#171717]">
                    <MoonIcon />
                    {nights} Night{nights === 1 ? '' : 's'}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#171717]">
                    <PaxIcon />
                    {guestsLabel}
                  </span>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#171717]">
                    <GlobeIcon />
                    {destLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAddOpen(true)}
                  className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border-0 bg-[#931115] px-3.5 text-sm font-semibold text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                  Add Service
                </button>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[900px]">
                  <div
                    className="grid gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.3px] text-[#A1A1A1]"
                    style={{ gridTemplateColumns: GRID_COLS }}
                  >
                    <div>Supplier / Service</div>
                    <div className="text-center">Qty</div>
                    <div className="text-center">Nights</div>
                    <div>Dates</div>
                    <div>Allocation</div>
                    <div>Status</div>
                    <div className="text-right">SubTotal</div>
                  </div>

                  {groups.length === 0 ? (
                    <div className="px-4 py-12 text-center text-sm text-[#A1A1A1]">
                      No services yet. Click Add Service to build this quote.
                    </div>
                  ) : (
                    groups.map((g) => (
                      <div key={g.id}>
                        <div
                          draggable
                          onDragStart={() => setDragGroupId(g.id)}
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverGroupId(g.id)
                          }}
                          onDrop={() => onGroupDrop(g.id)}
                          onDragEnd={() => {
                            setDragGroupId(null)
                            setDragOverGroupId(null)
                          }}
                          className={cn(
                            'flex items-center gap-2 border-b border-[#E5E7EB] bg-[#FAFAFA] px-4 py-2.5 text-sm font-bold text-[#171717]',
                            dragOverGroupId === g.id && dragGroupId !== g.id && 'bg-[#F4E2E3]',
                          )}
                        >
                          <DragHandle />
                          <GroupIcon icon={g.icon} />
                          {g.name}
                          {g.loc ? (
                            <span className="text-xs font-medium text-[#A1A1A1]">· {g.loc}</span>
                          ) : null}
                        </div>
                        {g.services.map((sv) => (
                          <ServiceBlock
                            key={sv.id}
                            service={sv}
                            indent={!!sv.indent}
                            isDragOver={
                              dragOverSvc?.groupId === g.id && dragOverSvc.serviceId === sv.id
                            }
                            onToggle={() => toggleService(g.id, sv.id)}
                            onDragStart={() => setDragSvc({ groupId: g.id, serviceId: sv.id })}
                            onDragOver={() => setDragOverSvc({ groupId: g.id, serviceId: sv.id })}
                            onDrop={() => onServiceDrop(g.id, sv.id)}
                            onDragEnd={() => {
                              setDragSvc(null)
                              setDragOverSvc(null)
                            }}
                          />
                        ))}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-10 text-sm text-[#A1A1A1]">
              {tab === 'activity' && 'Activity log coming soon.'}
              {tab === 'documents' && 'Documents coming soon.'}
              {tab === 'finance' && 'Finance coming soon.'}
            </div>
          )}
        </div>

        {tab === 'itinerary' ? (
          <div className="flex shrink-0 items-center justify-end gap-7 border-t border-[#E5E7EB] bg-white px-6 py-3.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#A1A1A1]">MARGIN</span>
              <span className="text-base font-bold text-[#067A55]">{totals.marginPct}%</span>
            </div>
            <button
              type="button"
              onClick={() => setPriceOpen(true)}
              className="inline-flex items-center gap-2 border-0 bg-transparent p-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
                <path d="m6 9 6 6 6-6" />
              </svg>
              <span className="text-sm font-semibold text-[#A1A1A1]">TOTAL</span>
              <span className="text-xl font-bold text-[#171717]">{formatUsd(totals.total)}</span>
            </button>
            <button
              type="button"
              onClick={handlePrepared}
              className="inline-flex h-10 items-center gap-2 rounded-lg border-0 bg-[#931115] px-[18px] text-sm font-semibold text-white"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 7 17l-5-5" />
                <path d="m22 10-7.5 7.5L13 16" />
              </svg>
              Prepared
            </button>
          </div>
        ) : null}
      </main>

      <AddServiceOverlay
        open={addOpen}
        itineraryId={itinerary.id}
        onClose={() => {
          setAddOpen(false)
          setGroups(structuredClone(getQuoteGroups(itinerary.id)))
        }}
        defaultStart={itinerary.travelDateFrom}
        defaultEnd={itinerary.travelDateTo}
      />
      <GuestDrawer open={guestOpen} onClose={() => setGuestOpen(false)} itinerary={itinerary} />
      <PriceModal
        open={priceOpen}
        onClose={() => setPriceOpen(false)}
        groups={groups}
        marginPct={totals.marginPct}
      />
    </div>
  )
}

function Meta({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-[0.3px] text-[#A1A1A1]">{label}</span>
      <span
        className={cn(
          'truncate whitespace-nowrap text-sm font-semibold',
          muted ? 'text-[#A1A1A1]' : 'text-[#171717]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function ServiceBlock({
  service: sv,
  indent,
  isDragOver,
  onToggle,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  service: QuoteService
  indent: boolean
  isDragOver: boolean
  onToggle: () => void
  onDragStart: () => void
  onDragOver: () => void
  onDrop: () => void
  onDragEnd: () => void
}) {
  return (
    <>
      <div
        draggable
        onDragStart={onDragStart}
        onDragOver={(e) => {
          e.preventDefault()
          onDragOver()
        }}
        onDrop={onDrop}
        onDragEnd={onDragEnd}
        onClick={onToggle}
        className={cn(
          'grid cursor-pointer items-center gap-3 border-b border-[#F1F1F3] px-4 py-2.5',
          isDragOver && 'bg-[#F4E2E3]',
        )}
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div className={cn('flex min-w-0 items-center gap-2', indent && 'pl-4')}>
          <DragHandle />
          {sv.hasChevron ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A1A1A1"
              strokeWidth="2"
              className={cn('shrink-0 transition-transform', sv.expanded ? '' : '-rotate-90')}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <span className="min-w-0 truncate text-sm font-semibold text-[#171717]">
            {sv.title}
            {sv.sub ? <span className="font-medium text-[#A1A1A1]"> {sv.sub}</span> : null}
          </span>
          {sv.isNew ? (
            <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-[rgba(0,212,146,0.14)] px-1.5 text-[11px] font-semibold text-[#067A55]">
              New
            </span>
          ) : null}
        </div>
        <div className="text-center text-sm text-[#171717]">{sv.qty || '—'}</div>
        <div className="text-center text-sm text-[#171717]">{sv.nights || '—'}</div>
        <div className="text-[13px] text-[#525252]">{sv.dates || '—'}</div>
        <div className="text-[13px] text-[#525252]">{sv.alloc || '—'}</div>
        <div>
          {sv.statusLabel ? (
            <span className="inline-flex flex-col">
              <span
                className="inline-flex h-[22px] w-fit items-center rounded-md px-2 text-[11.5px] font-bold"
                style={{ background: sv.statusBg, color: sv.statusColor }}
              >
                {sv.statusLabel}
              </span>
              {sv.statusSub ? (
                <span className="mt-0.5 text-[11px] text-[#A1A1A1]">{sv.statusSub}</span>
              ) : null}
            </span>
          ) : null}
        </div>
        <div className="text-right text-sm font-semibold text-[#171717]">{sv.subtotal}</div>
      </div>
      {sv.expanded
        ? (sv.extras || []).map((ex, i) => <ExtraRow key={`${sv.id}-ex-${i}`} extra={ex} />)
        : null}
    </>
  )
}

function ExtraRow({ extra: ex }: { extra: QuoteExtra }) {
  return (
    <div
      className="grid items-center gap-3 border-b border-[#F1F1F3] bg-[#FCFCFC] px-4 py-2"
      style={{ gridTemplateColumns: GRID_COLS }}
    >
      <div className="flex min-w-0 items-center gap-2 pl-6">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C4C4C6" strokeWidth="2" className="shrink-0">
          <polyline points="15 10 20 15 15 20" />
          <path d="M4 4v7a4 4 0 0 0 4 4h12" />
        </svg>
        <span
          className={cn(
            'truncate text-sm',
            ex.isDiscount ? 'font-semibold text-[#931115]' : 'font-medium text-[#171717]',
          )}
        >
          {ex.label}
        </span>
        {ex.isNew ? (
          <span className="inline-flex h-[18px] shrink-0 items-center rounded-full bg-[rgba(0,212,146,0.14)] px-1.5 text-[11px] font-semibold text-[#067A55]">
            New
          </span>
        ) : null}
      </div>
      <div className="text-center text-sm text-[#171717]">{ex.qty || ''}</div>
      <div />
      <div className="text-[13px] text-[#525252]">{ex.dates || ''}</div>
      <div className="text-[13px] text-[#525252]">{ex.alloc || ''}</div>
      <div>
        {ex.statusLabel ? (
          <span className="inline-flex flex-col">
            <span
              className="inline-flex h-[22px] w-fit items-center rounded-md px-2 text-[11.5px] font-bold"
              style={{ background: ex.statusBg, color: ex.statusColor }}
            >
              {ex.statusLabel}
            </span>
            {ex.statusSub ? (
              <span className="mt-0.5 text-[11px] text-[#A1A1A1]">{ex.statusSub}</span>
            ) : null}
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          'text-right text-sm font-semibold',
          ex.isDiscount ? 'text-[#931115]' : 'text-[#171717]',
        )}
      >
        {ex.amount}
        {ex.pct ? <span className="font-medium text-[#A1A1A1]"> {ex.pct}</span> : null}
      </div>
    </div>
  )
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4D4D8" strokeWidth="2">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function CalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function PaxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
      <path d="M18 21a8 8 0 0 0-16 0" />
      <circle cx="10" cy="8" r="5" />
      <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
    </svg>
  )
}

function GlobeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#171717" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  )
}

export default QuotePage
