import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check,
  ChevronRight,
  Copy,
  Eye,
  Filter,
  MoreHorizontal,
  Plus,
  Search,
  SplitSquareVertical,
  X,
} from 'lucide-react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { CreateItineraryDialog } from '@/features/inquiries/CreateItineraryDialog'
import { FiltersDrawer } from '@/features/inquiries/FiltersDrawer'
import { SplitItineraryDialog } from '@/features/inquiries/SplitItineraryDialog'
import { StatusDashboard } from '@/features/inquiries/StatusDashboard'
import { PAYMENT_META, SEED_COLLAPSED_REFS, STATUS_META } from '@/shared/lib/catalogs'
import {
  _itinVM,
  buildItineraryRows,
  emptyFilters,
  filterItineraries,
  inquiryRefLabel,
  isTerminalStatus,
  marginChip,
  marginPct,
  openPath,
  parentReference,
  sortItineraries,
  travelProximity,
} from '@/shared/lib/helpers'
import type { ListFilters, SortKey, SplitForm } from '@/shared/lib/types'
import { cn, formatDay, formatUsd } from '@/shared/lib/utils'
import { PaymentChip } from '@/shared/ui/PaymentChip'
import { StatusChip } from '@/shared/ui/StatusChip'

type ListTab = 'table' | 'dashboard'

const GRID =
  'grid min-w-[1410px] grid-cols-[minmax(240px,27fr)_minmax(130px,9fr)_minmax(200px,13fr)_minmax(170px,9fr)_minmax(120px,8fr)_minmax(130px,8fr)_minmax(110px,7fr)_minmax(90px,6fr)_minmax(130px,8fr)_minmax(90px,5fr)]'

function countActiveFilters(f: ListFilters): number {
  return [
    f.status,
    f.payment,
    f.agency,
    f.destination,
    f.dateFrom,
    f.dateTo,
    f.createdFrom,
    f.createdTo,
  ].filter(Boolean).length
}

export function InquiriesPage() {
  const { itineraries, splitItinerary, acceptOption } = useStore()
  const navigate = useNavigate()

  const [tab, setTab] = useState<ListTab>('table')
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ListFilters>(() => emptyFilters())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('reference')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [collapsedRefs, setCollapsedRefs] = useState<Record<string, boolean>>(() => ({
    ...SEED_COLLAPSED_REFS,
  }))
  const [createOpen, setCreateOpen] = useState(false)
  const [createSeedTitle, setCreateSeedTitle] = useState('')
  const [splitFor, setSplitFor] = useState<string | null>(null)

  const agencies = useMemo(
    () => [...new Set(itineraries.map((it) => it.agency).filter(Boolean))].sort(),
    [itineraries],
  )
  const destinations = useMemo(
    () => [...new Set(itineraries.map((it) => it.destination).filter(Boolean))].sort(),
    [itineraries],
  )

  const [draftForCount, setDraftForCount] = useState<ListFilters>(() => emptyFilters())
  const liveCount = useMemo(
    () => filterItineraries(itineraries, query, filtersOpen ? draftForCount : filters).length,
    [itineraries, query, filtersOpen, draftForCount, filters],
  )

  const filtered = useMemo(
    () => filterItineraries(itineraries, query, filters),
    [itineraries, query, filters],
  )
  const itineraryVMs = useMemo(() => {
    const childMap = new Map<string, typeof itineraries>()
    for (const it of itineraries) {
      const parent = parentReference(it.reference)
      if (!parent) continue
      childMap.set(parent, [...(childMap.get(parent) || []), it])
    }
    return new Map(itineraries.map((it) => [it.reference, _itinVM(it, childMap)]))
  }, [itineraries])
  const holdUrgencyByReference = useMemo(
    () => new Map([...itineraryVMs].map(([ref, vm]) => [ref, vm.hold.daysLeft])),
    [itineraryVMs],
  )
  const sorted = useMemo(
    () => sortItineraries(filtered, sortKey, sortDir, holdUrgencyByReference),
    [filtered, sortKey, sortDir, holdUrgencyByReference],
  )
  const rows = useMemo(() => buildItineraryRows(sorted, collapsedRefs), [sorted, collapsedRefs])

  const activeFilterCount = countActiveFilters(filters)
  const hasActiveFilters = activeFilterCount > 0

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string; clear: () => void }[] = []
    if (filters.status) {
      chips.push({
        key: 'status',
        label: `Status: ${STATUS_META[filters.status].label}`,
        clear: () => setFilters((f) => ({ ...f, status: null })),
      })
    }
    if (filters.payment) {
      chips.push({
        key: 'payment',
        label: `Payment: ${PAYMENT_META[filters.payment].label}`,
        clear: () => setFilters((f) => ({ ...f, payment: null })),
      })
    }
    if (filters.agency) {
      chips.push({
        key: 'agency',
        label: `Agency: ${filters.agency}`,
        clear: () => setFilters((f) => ({ ...f, agency: null })),
      })
    }
    if (filters.destination) {
      chips.push({
        key: 'destination',
        label: `Destination: ${filters.destination}`,
        clear: () => setFilters((f) => ({ ...f, destination: null })),
      })
    }
    if (filters.dateFrom) {
      chips.push({
        key: 'dateFrom',
        label: `Travel from: ${filters.dateFrom}`,
        clear: () => setFilters((f) => ({ ...f, dateFrom: '' })),
      })
    }
    if (filters.dateTo) {
      chips.push({
        key: 'dateTo',
        label: `Travel to: ${filters.dateTo}`,
        clear: () => setFilters((f) => ({ ...f, dateTo: '' })),
      })
    }
    if (filters.createdFrom) {
      chips.push({
        key: 'createdFrom',
        label: `Created from: ${filters.createdFrom}`,
        clear: () => setFilters((f) => ({ ...f, createdFrom: '' })),
      })
    }
    if (filters.createdTo) {
      chips.push({
        key: 'createdTo',
        label: `Created to: ${filters.createdTo}`,
        clear: () => setFilters((f) => ({ ...f, createdTo: '' })),
      })
    }
    return chips
  }, [filters])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function toggleCollapse(reference: string) {
    setCollapsedRefs((prev) => ({ ...prev, [reference]: !prev[reference] }))
  }

  function openFilters() {
    setDraftForCount(filters)
    setFiltersOpen(true)
  }

  function handleApplyFilters(next: ListFilters) {
    setFilters(next)
    setDraftForCount(next)
    setFiltersOpen(false)
  }

  function clearAllFilters() {
    const empty = emptyFilters()
    setFilters(empty)
    setDraftForCount(empty)
  }

  function handleSplitConfirm(parentRef: string, form: SplitForm) {
    const created = splitItinerary(parentRef, form)
    setSplitFor(null)
    if (created) navigate(`/build/${created.id}`)
  }

  function handleCopy(id: string) {
    const src = itineraries.find((it) => it.id === id)
    setCreateSeedTitle(src?.title ? `${src.title} (copy)` : '')
    setCreateOpen(true)
  }

  const SortHead = ({
    label,
    k,
    align = 'left',
  }: {
    label: string
    k?: SortKey
    align?: 'left' | 'right' | 'center'
  }) => (
    <div
      role={k ? 'button' : undefined}
      tabIndex={k ? 0 : undefined}
      onClick={k ? () => toggleSort(k) : undefined}
      onKeyDown={
        k
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') toggleSort(k)
            }
          : undefined
      }
      className={cn(
        'flex h-10 items-center gap-1 border-r border-[#E5E7EB] px-2 text-[13px] font-medium text-[#525252]',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center border-r-0',
        k && 'cursor-pointer',
        label === 'Itinerary Ref' && 'pl-4',
      )}
    >
      {label}
      {k ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" strokeWidth="2">
          <path d="m21 16-4 4-4-4" />
          <path d="M17 20V4" />
          <path d="m3 8 4-4 4 4" />
          <path d="M7 4v16" />
        </svg>
      ) : null}
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-start justify-between gap-6 px-7 pt-[22px]">
        <div>
          <h1 className="m-0 text-[22px] font-bold tracking-tight text-[#171717]">Inquiries</h1>
          <p className="mt-1 text-sm font-medium text-[#A1A1A1]">View and manage all itineraries here.</p>
        </div>
        <Button
          className="h-[38px] bg-[#931115] text-white hover:bg-[#7a0e11]"
          onClick={() => setCreateOpen(true)}
        >
          <Plus />
          Create
        </Button>
      </div>

      <div className="mt-3.5 flex shrink-0 items-center gap-6 border-b border-[#E5E7EB] px-7">
        <button
          type="button"
          onClick={() => setTab('table')}
          className={cn(
            '-mb-px h-10 border-0 border-b-2 bg-transparent px-0.5 text-[15px] font-bold',
            tab === 'table'
              ? 'border-[#931115] text-[#171717]'
              : 'border-transparent text-[#A1A1A1]',
          )}
        >
          Inquiry table
        </button>
        <button
          type="button"
          onClick={() => setTab('dashboard')}
          className={cn(
            '-mb-px h-10 border-0 border-b-2 bg-transparent px-0.5 text-[15px] font-bold',
            tab === 'dashboard'
              ? 'border-[#931115] text-[#171717]'
              : 'border-transparent text-[#A1A1A1]',
          )}
        >
          Status dashboard
        </button>
      </div>

      {tab === 'dashboard' ? (
        <StatusDashboard itineraries={itineraries} />
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-3 px-7 pt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#A1A1A1]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by Reference, Agency / Agent name or Lead Traveler name"
                className="h-[38px] bg-white pl-9"
              />
            </div>
            <Button type="button" variant="outline" className="relative h-[38px]" onClick={openFilters}>
              <Filter className="size-4" />
              Filters
              {hasActiveFilters ? (
                <span className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#8B1515] px-1.5 text-[11px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          </div>

          <FiltersDrawer
            open={filtersOpen}
            filters={filters}
            agencies={agencies}
            destinations={destinations}
            liveCount={liveCount}
            onClose={() => setFiltersOpen(false)}
            onDraftChange={setDraftForCount}
            onApply={handleApplyFilters}
          />

          {itineraries.length === 0 ? (
            <div className="flex flex-1 p-5 px-7 pb-7">
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
                <div className="mb-4 flex size-[52px] items-center justify-center rounded-xl bg-[#DFF2FE]">
                  <img src="/assets/search-icon.svg" alt="" className="size-[26px]" />
                </div>
                <div className="text-base font-bold text-[#171717]">No Itineraries yet</div>
                <div className="mt-1.5 max-w-[340px] text-sm font-medium text-[#A1A1A1]">
                  All itineraries will appear here once they are created.
                </div>
                <Button
                  className="mt-5 h-[38px] bg-[#931115] text-white hover:bg-[#7a0e11]"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus />
                  Create Itinerary
                </Button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-1 p-5 px-7 pb-7">
              <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-[#E5E7EB] bg-white p-10 text-center">
                <div className="mb-4 flex size-[52px] items-center justify-center rounded-xl bg-[#F3F4F6]">
                  <Search className="size-6 text-[#A1A1A1]" />
                </div>
                <div className="text-base font-bold text-[#171717]">No matching itineraries</div>
                <div className="mt-1.5 max-w-[340px] text-sm font-medium text-[#A1A1A1]">
                  Try adjusting or clearing your filters.
                </div>
                <Button type="button" variant="outline" className="mt-5 h-[38px]" onClick={clearAllFilters}>
                  Clear all filters
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-7 py-4 pb-7">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 py-2.5">
                  <span className="shrink-0">
                    <span className="text-sm font-bold text-[#171717]">{filtered.length}</span>
                    <span className="text-sm font-medium text-[#525252]"> records</span>
                  </span>
                  {activeChips.map((chip) => (
                    <div
                      key={chip.key}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2 py-1"
                    >
                      <span className="text-[13px] font-semibold text-[#171717]">{chip.label}</span>
                      <button
                        type="button"
                        onClick={chip.clear}
                        className="flex border-0 bg-transparent p-0 text-[#A1A1A1]"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="border-0 bg-transparent p-0 text-[13px] font-medium text-[#0369A1]"
                    >
                      Clear all
                    </button>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-auto border-t border-[#E5E7EB]">
                  <div className={cn(GRID, 'sticky top-0 z-[1] h-10 bg-[#F9FAFB]')}>
                    <SortHead label="Itinerary Ref" k="reference" />
                    <SortHead label="Inquiry" />
                    <SortHead label="Itinerary Title" k="title" />
                    <SortHead label="Travel Dates" k="travel" />
                    <SortHead label="Hold Status" k="hold" />
                    <SortHead label="Status" k="status" />
                    <SortHead label="Total" k="total" align="right" />
                    <SortHead label="Margin" k="margin" align="right" />
                    <SortHead label="Payment" k="payment" />
                    <SortHead label="Actions" align="center" />
                  </div>

                  {rows.map((row) => {
                    const it = row.itinerary
                    const hold = itineraryVMs.get(it.reference)?.hold
                    const mp = marginPct(it)
                    const mc = mp != null ? marginChip(mp) : null
                    const prox = travelProximity(
                      it.travelDateFrom,
                      it.travelDateTo,
                      isTerminalStatus(it.status),
                    )
                    const isConfirmed =
                      it.status === 'CONFIRMED' ||
                      it.status === 'TRAVEL_IN_PROGRESS' ||
                      it.status === 'COMPLETED'
                    const depthPad = 16 + row.depth * 18

                    return (
                      <div
                        key={it.id}
                        className={cn(
                          GRID,
                          'relative h-[52px] border-b border-[#F1F1F3] hover:bg-[#FAFAFA]',
                          row.isSuperseded && 'opacity-[0.62]',
                        )}
                      >
                        {isConfirmed ? (
                          <span className="absolute left-0 top-0 h-full w-[3px] rounded-r-[3px] bg-[#22C55E]" />
                        ) : null}

                        <div
                          className="flex items-center gap-1.5 overflow-hidden border-r border-[#F1F1F3] pr-2"
                          style={{ paddingLeft: depthPad }}
                        >
                          {row.depth > 0 ? (
                            <span className="mr-0.5 h-px w-3 shrink-0 bg-[#D4D4D8]" />
                          ) : null}
                          {row.canSplit ? (
                            <button
                              type="button"
                              title="Split into itinerary"
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#737373] hover:bg-[#F3F4F6] hover:text-[#171717]"
                              onClick={() => setSplitFor(it.reference)}
                            >
                              <SplitSquareVertical className="size-3.5" />
                            </button>
                          ) : (
                            <span className="size-7 shrink-0" />
                          )}
                          {row.hasChildren ? (
                            <button
                              type="button"
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-[#525252] hover:bg-[#F3F4F6]"
                              onClick={() => toggleCollapse(it.reference)}
                            >
                              <ChevronRight
                                className={cn(
                                  'size-3.5 transition-transform',
                                  !row.collapsed && 'rotate-90',
                                )}
                              />
                            </button>
                          ) : (
                            <span className="size-7 shrink-0" />
                          )}
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex min-w-0 items-center gap-1.5">
                              <button
                                type="button"
                                className="min-w-0 truncate text-[13px] font-bold text-[#1D4ED8] underline"
                                onClick={() => navigate(openPath(it))}
                              >
                                {it.reference}
                              </button>
                              {row.isSubquote ? (
                                <span className="inline-flex h-4 shrink-0 items-center rounded border border-[#FDE68A] bg-[#FEF3C7] px-1.5 text-[9px] font-bold uppercase tracking-[0.3px] text-[#92400E]">
                                  Sub-quote
                                </span>
                              ) : null}
                              {row.isMaster ? (
                                <span className="inline-flex h-4 shrink-0 items-center gap-0.5 rounded border border-[#86EFAC] bg-[#DCFCE7] px-1.5 text-[9px] font-bold uppercase tracking-[0.3px] text-[#166534]">
                                  <Check className="size-2.5" strokeWidth={3} />
                                  Master
                                </span>
                              ) : null}
                              {row.isSuperseded ? (
                                <span className="inline-flex h-4 shrink-0 items-center rounded border border-[#E2E8F0] bg-[#F1F5F9] px-1.5 text-[9px] font-bold uppercase tracking-[0.3px] text-[#94A3B8]">
                                  Superseded
                                </span>
                              ) : null}
                            </div>
                            {row.depth === 0 ? (
                              <span className="inline-block max-w-full truncate rounded border border-[#E5E7EB] bg-[#F3F4F6] px-1.5 text-[9.5px] font-bold leading-4 text-[#525252]">
                                Inquiry by {it.agency}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center overflow-hidden border-r border-[#F1F1F3] px-2 font-mono text-xs text-[#737373]">
                          {inquiryRefLabel(it.reference)}
                        </div>

                        <div
                          className="flex min-w-0 items-center overflow-hidden border-r border-[#F1F1F3] px-2 text-sm"
                          style={{ color: it.title ? '#171717' : '#A1A1A1' }}
                          title={it.title || 'Untitled Itinerary'}
                        >
                          <span className="truncate">{it.title || 'Untitled Itinerary'}</span>
                        </div>

                        <div className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap border-r border-[#F1F1F3] px-2 text-xs text-[#171717]">
                          <span className="truncate">
                            {formatDay(it.travelDateFrom)}
                            {it.travelDateTo ? ` – ${formatDay(it.travelDateTo)}` : ''}
                          </span>
                          {prox.show ? (
                            <span
                              className="inline-flex h-[18px] shrink-0 items-center rounded px-1.5 text-[10px] font-bold"
                              style={{ background: prox.bg, color: prox.fg }}
                            >
                              {prox.label}
                            </span>
                          ) : null}
                        </div>

                        <div className="flex items-center overflow-hidden border-r border-[#F1F1F3] px-1.5">
                          {hold?.hasHold ? (
                            <span className="inline-flex items-center gap-1" title={hold.tooltip}>
                              <span
                                className="inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-bold"
                                style={{ background: hold.bg, color: hold.fg }}
                              >
                                {hold.label}
                              </span>
                              {hold.count > 1 ? (
                                <span className="shrink-0 text-[11px] font-bold text-[#737373]">
                                  ×{hold.count}
                                </span>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-xs text-[#D4D4D8]">—</span>
                          )}
                        </div>

                        <div className="flex items-center overflow-hidden border-r border-[#F1F1F3] px-2">
                          <StatusChip status={it.status} />
                        </div>

                        <div className="flex items-center justify-end border-r border-[#F1F1F3] px-2 text-[13px] font-medium text-[#171717]">
                          {formatUsd(it.totalUsd)}
                        </div>

                        <div className="flex items-center justify-end border-r border-[#F1F1F3] px-2">
                          {mp != null && mc ? (
                            <span
                              className="inline-flex h-[22px] items-center rounded-md px-2 text-[11.5px] font-bold"
                              style={{ background: mc.bg, color: mc.fg }}
                            >
                              {mp}%
                            </span>
                          ) : (
                            <span className="text-xs text-[#D4D4D8]">—</span>
                          )}
                        </div>

                        <div className="flex items-center overflow-hidden border-r border-[#F1F1F3] px-2">
                          <PaymentChip status={it.paymentStatus} />
                        </div>

                        <div className="relative flex items-center justify-center px-2">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-[#A1A1A1]">
                                <MoreHorizontal className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[180px]">
                              <DropdownMenuItem onClick={() => navigate(openPath(it))}>
                                <Eye className="size-3.5" />
                                View Detail
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleCopy(it.id)}>
                                <Copy className="size-3.5" />
                                Copy Itinerary
                              </DropdownMenuItem>
                              {row.canAccept ? (
                                <DropdownMenuItem
                                  className="text-[#166534] focus:text-[#166534]"
                                  onClick={() => acceptOption(it.reference)}
                                >
                                  <Check className="size-3.5" />
                                  Accept &amp; make master
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <CreateItineraryDialog
        open={createOpen}
        seedTitle={createSeedTitle}
        onOpenChange={(open) => {
          setCreateOpen(open)
          if (!open) setCreateSeedTitle('')
        }}
      />
      <SplitItineraryDialog
        open={!!splitFor}
        parentRef={splitFor}
        onOpenChange={(open) => {
          if (!open) setSplitFor(null)
        }}
        onConfirm={handleSplitConfirm}
      />
    </div>
  )
}
