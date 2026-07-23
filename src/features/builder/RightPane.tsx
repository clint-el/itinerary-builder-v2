import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown, Search, Trash2 } from 'lucide-react'
import { CATALOG, TAB_META } from '@/shared/lib/catalogs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { AddedService, ServiceTab } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'

export function RightPane({
  width,
  onResizeStart,
  services,
  setServices,
  persist,
  onEdit,
  onPickSearch,
}: {
  width: number
  onResizeStart: (e: React.MouseEvent) => void
  services: AddedService[]
  setServices: (next: AddedService[]) => void
  persist: (next: AddedService[]) => void
  onEdit: (svc: AddedService) => void
  onPickSearch: (tab: ServiceTab, item: { location: string; name: string; service: string }) => void
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
                    onClick={() => {
                      onPickSearch(r.tab, r)
                      setSearch('')
                    }}
                    className="flex w-full items-center gap-2 border-b px-2.5 py-2 text-left last:border-0 hover:bg-[#F9FAFB]"
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-md text-xs font-bold"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {meta.initial}
                    </span>
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

        <div className="border-b px-4 py-2.5">
          <div className="text-sm font-bold">Added services</div>
          <div className="text-xs text-muted-foreground">{services.length} item(s)</div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {services.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-[#A1A1A1]">
              No services yet. Configure a service and add it to the itinerary.
            </div>
          ) : (
            services.map((svc) => (
              <div
                key={svc.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', svc.id)
                  dragIdRef.current = svc.id
                  setDragId(svc.id)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
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
                className="cursor-grab rounded-xl border bg-[#F9FAFB] active:cursor-grabbing"
              >
                <div className="flex items-start gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => {
                      const next = services.map((s) =>
                        s.id === svc.id ? { ...s, expanded: !s.expanded } : s,
                      )
                      setServices(next)
                      persist(next)
                    }}
                    className="mt-0.5"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        !svc.expanded && '-rotate-90',
                      )}
                    />
                  </button>
                  <span
                    className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{ background: svc.bg, color: svc.fg }}
                  >
                    {svc.initial}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{svc.title}</div>
                    <div className="truncate text-xs text-muted-foreground">{svc.subtitle}</div>
                    <div className="mt-1 text-xs font-medium text-neutral-600">{svc.meta}</div>
                    {svc.expanded && svc.details?.length ? (
                      <dl className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {svc.details.map((d) => (
                          <div key={d.label} className="flex gap-1">
                            <dt className="font-semibold text-[#525252]">{d.label}:</dt>
                            <dd>{d.value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">{svc.priceLabel}</div>
                        <div
                          className="text-[11.5px] font-semibold"
                          style={{ color: svc.marginColor }}
                        >
                          {formatUsd(svc.margin)} · {svc.marginPct}%
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => onEdit(svc)}>
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            const next = services.filter((s) => s.id !== svc.id)
                            setServices(next)
                            persist(next)
                          }}
                        >
                          <Trash2 className="size-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-muted-foreground">Grand total</span>
            <span className="font-bold">
              {formatUsd(services.reduce((sum, s) => sum + (s.price || 0), 0))}
            </span>
          </div>
        </div>
      </aside>

      <Dialog open={reorderOpen} onOpenChange={setReorderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Services reordered</DialogTitle>
            <DialogDescription>
              Service order was updated. Date cascading across services is not applied in this demo —
              adjust stay dates manually if the new sequence requires it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="bg-[#931115] hover:bg-[#7a0e12]" onClick={() => setReorderOpen(false)}>
              Got it
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
