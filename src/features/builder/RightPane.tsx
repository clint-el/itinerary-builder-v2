import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Pencil, Search, X } from 'lucide-react'
import { CATALOG, TAB_META } from '@/shared/lib/catalogs'
import {
  canRemoveLine,
  isEngaged,
  isLineUpdated,
  lineStatusOf,
  roleAllowsLineAction,
} from '@/shared/lib/lifecycleRules'
import { serviceListBadge } from '@/features/builder/serviceBadgeModel'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AddedService, DemoRole, ServiceTab } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'

export function RightPane({
  width,
  onResizeStart,
  services,
  setServices,
  persist,
  onEdit,
  onPickSearch,
  demoRole,
  onCancelLine,
  onRemoveLine,
  readOnly,
  structureLocked = false,
}: {
  width: number
  onResizeStart: (e: React.MouseEvent) => void
  services: AddedService[]
  setServices: (next: AddedService[]) => void
  persist: (next: AddedService[]) => void
  onEdit: (svc: AddedService) => void
  onPickSearch: (tab: ServiceTab, item: { location: string; name: string; service: string }) => void
  demoRole: DemoRole
  onCancelLine: (svc: AddedService) => void
  onRemoveLine: (svc: AddedService) => void
  readOnly?: boolean
  structureLocked?: boolean
}) {
  const [search, setSearch] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [reorderOpen, setReorderOpen] = useState(false)
  const dragIdRef = useRef<string | null>(null)

  const q = search.trim().toLowerCase()
  const results: { tab: ServiceTab; name: string; location: string; service: string }[] = []
  if (q) {
    ;(Object.keys(CATALOG) as ServiceTab[]).forEach((tab) => {
      CATALOG[tab].forEach((item) => {
        if (item.name.toLowerCase().includes(q)) {
          results.push({
            tab,
            name: item.name,
            location: item.location,
            service: item.service,
          })
        }
      })
    })
  }

  return (
    <>
      <div
        role="separator"
        aria-orientation="vertical"
        title="Drag to resize"
        onMouseDown={onResizeStart}
        className="w-[7px] shrink-0 cursor-col-resize self-stretch bg-transparent hover:bg-[#E5E7EB]"
      />
      <aside
        className="flex shrink-0 flex-col overflow-hidden border-l border-[#E5E7EB] bg-white"
        style={{ width }}
      >
        <div className="border-b px-4 py-3">
          <Labelish>Find a supplier or service</Labelish>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#A1A1A1]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search suppliers…"
              className="h-[34px] w-full rounded-md border border-[#E5E7EB] bg-[#F9FAFB] py-0 pl-8 pr-2.5 text-[13px] outline-none"
            />
          </div>
          {results.length > 0 ? (
            <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border">
              {results.slice(0, 6).map((r) => {
                const meta = TAB_META[r.tab]
                return (
                  <button
                    key={`${r.tab}-${r.name}`}
                    type="button"
                    disabled={structureLocked || readOnly}
                    onClick={() => {
                      if (structureLocked || readOnly) return
                      onPickSearch(r.tab, r)
                      setSearch('')
                    }}
                    className="flex w-full items-center gap-2 border-b px-2.5 py-2 text-left last:border-0 hover:bg-[#F9FAFB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold">{r.name}</span>
                      <span className="text-[11px] text-[#A1A1A1]">{meta.label}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 px-4">
          <div className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.3px] text-[#A1A1A1]">
            Added services ({services.length})
          </div>

          {services.length === 0 ? (
            <div className="px-2 py-6 text-center text-[12.5px] text-[#A1A1A1]">
              No services added yet. Configure one on the left and click “Add to itinerary”.
            </div>
          ) : (
            <>
              {services.map((svc) => {
                const netLabel = svc.netLabel || formatUsd(svc.net || 0)
                const rackLabel = svc.rackLabel || formatUsd(svc.rack || 0)
                return (
                  <div
                    key={svc.id}
                    draggable={!structureLocked && !readOnly}
                    onDragStart={(e) => {
                      if (structureLocked || readOnly) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.setData('text/plain', svc.id)
                      dragIdRef.current = svc.id
                      setDragId(svc.id)
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      if (structureLocked || readOnly) return
                      const fromId = dragIdRef.current || dragId
                      if (!fromId || fromId === svc.id) return
                      const list = services.slice()
                      const fromIdx = list.findIndex((x) => x.id === fromId)
                      const toIdx = list.findIndex((x) => x.id === svc.id)
                      if (fromIdx === -1 || toIdx === -1) return
                      const [moved] = list.splice(fromIdx, 1)
                      list.splice(toIdx, 0, moved)
                      setServices(list)
                      persist(list)
                      dragIdRef.current = null
                      setDragId(null)
                      setReorderOpen(true)
                    }}
                    className={
                      structureLocked || readOnly
                        ? 'rounded-lg border border-[#E5E7EB] bg-white p-2.5'
                        : 'cursor-grab rounded-lg border border-[#E5E7EB] bg-white p-2.5 active:cursor-grabbing'
                    }
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <div className="truncate text-[13px] font-bold text-[#171717]">
                            {svc.title}
                          </div>
                          {isLineUpdated(svc) ? (
                            <span className="shrink-0 rounded bg-[#FEF3C7] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-[#B45309]">
                              Updated
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-px truncate text-[11.5px] text-[#A1A1A1]">
                          {svc.subtitle}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {lineStatusOf(svc) === 'Cancelled' ? (
                            <span className="rounded bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-semibold text-[#B91C1C]">
                              Cancelled
                            </span>
                          ) : null}
                          {(() => {
                            const badge = serviceListBadge(svc)
                            return badge ? (
                              <span
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                  badge.className,
                                )}
                              >
                                {badge.label}
                              </span>
                            ) : null
                          })()}
                        </div>
                      </div>
                      {!readOnly ? (
                        <button
                          type="button"
                          title="Edit this service"
                          aria-label={`Edit ${svc.title}`}
                          onClick={() => onEdit(svc)}
                          className="flex size-5 shrink-0 items-center justify-center text-[#2563EB]"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        title="Toggle details"
                        aria-label={svc.expanded ? `Collapse ${svc.title}` : `Expand ${svc.title}`}
                        aria-expanded={svc.expanded}
                        onClick={() => {
                          const next = services.map((s) =>
                            s.id === svc.id ? { ...s, expanded: !s.expanded } : s,
                          )
                          setServices(next)
                          persist(next)
                        }}
                        className="flex size-5 shrink-0 items-center justify-center text-[#A1A1A1]"
                      >
                        <ChevronDown
                          className={cn(
                            'size-3.5 transition-transform',
                            !svc.expanded && '-rotate-90',
                          )}
                        />
                      </button>
                      {roleAllowsLineAction(demoRole, 'remove') &&
                      !structureLocked &&
                      canRemoveLine(svc).ok ? (
                        <button
                          type="button"
                          title="Remove service"
                          aria-label={`Remove ${svc.title}`}
                          onClick={() => onRemoveLine(svc)}
                          className="flex size-5 shrink-0 items-center justify-center text-[#A1A1A1]"
                        >
                          <X className="size-3.5" />
                        </button>
                      ) : null}
                    </div>

                    {roleAllowsLineAction(demoRole, 'cancel') && isEngaged(svc) ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => onCancelLine(svc)}
                          className="h-6 rounded-md border border-[#FECACA] bg-[#FEF2F2] px-2 text-[10.5px] font-semibold text-[#B91C1C]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11.5px] text-[#525252]">{svc.meta}</span>
                      <span className="text-[13px] font-bold text-[#171717]">{svc.priceLabel}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[11px] text-[#A1A1A1]">Cost / Sell</span>
                      <span className="text-[11.5px] font-semibold text-[#171717]">
                        {netLabel} / {rackLabel}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between">
                      <span className="text-[11px] text-[#A1A1A1]">Margin</span>
                      <span
                        className="text-[11.5px] font-semibold"
                        style={{ color: svc.marginColor }}
                      >
                        {formatUsd(svc.margin)} · {svc.marginPct}%
                      </span>
                    </div>

                    {svc.expanded && svc.details?.length ? (
                      <div className="mt-2.5 space-y-1 border-t border-[#F1F1F3] pt-2.5">
                        {svc.details.map((d) => (
                          <div
                            key={d.label}
                            className="flex items-center justify-between text-[11.5px]"
                          >
                            <span className="text-[#A1A1A1]">{d.label}</span>
                            <span className="font-semibold text-[#171717]">{d.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}

              <div className="mt-3 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
                <span className="text-[13px] font-semibold text-[#171717]">Itinerary total</span>
                <span className="text-[15px] font-bold text-[#171717]">
                  {formatUsd(services.reduce((sum, s) => sum + (s.price || 0), 0))}
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update date ranges?</DialogTitle>
            <DialogDescription>
              You changed the order of services. Services are normally arranged chronologically —
              would you like to update the date ranges to match the new order?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReorderOpen(false)}>
              Not now
            </Button>
            <Button className="bg-[#931115] hover:bg-[#7a0e12]" onClick={() => setReorderOpen(false)}>
              Update dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Labelish({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[12.5px] font-semibold text-[#525252]">{children}</label>
  )
}
