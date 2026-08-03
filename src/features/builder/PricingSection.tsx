import { useEffect, useRef, useState } from 'react'
import { Info } from 'lucide-react'
import { liveSystemPrice, roomTypeLabel } from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ServiceTab } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'
import type { AuditEntry, PricingRow } from './builderUtils'
import {
  asActivities,
  asRooms,
  asVehicles,
  computeDraftTotals,
  roomPriceBreakdown,
} from './builderUtils'

function AuditTrailTooltip({ auditLog }: { auditLog: AuditEntry[] }) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  function show() {
    clearCloseTimer()
    setOpen(true)
  }

  function hide() {
    clearCloseTimer()
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => clearCloseTimer(), [])

  if (auditLog.length === 0) return null
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex size-3.5 shrink-0 items-center justify-center rounded-full text-[#B45309] hover:bg-[#FEF3C7]"
          aria-label="Price override audit trail"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
        >
          <Info className="size-3" strokeWidth={2.5} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-72 border-[#FCD34D] bg-white p-3 shadow-md"
        onMouseEnter={show}
        onMouseLeave={hide}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#92400E]">
          Price override audit trail
        </div>
        <div className="space-y-1.5">
          {auditLog.map((a, i) => (
            <p key={i} className="text-[12px] leading-snug text-[#92400E]">
              &ldquo;{a.reason}&rdquo; by {a.user} · {a.at}
            </p>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function OverrideAmountField({
  value,
  original,
  onChange,
  auditLog,
}: {
  value: number
  original?: number
  onChange: (n: number) => void
  auditLog: AuditEntry[]
}) {
  const changed = original !== undefined && original !== value
  return (
    <div className="text-right">
      <input
        type="number"
        min={0}
        value={value || ''}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={
          changed
            ? 'ml-auto h-8 w-[84px] rounded-md border border-[#F59E0B] bg-white px-2 text-right text-[14px] font-semibold outline-none ring-1 ring-[#FDE68A]'
            : 'ml-auto h-8 w-[84px] rounded-md border px-2 text-right text-[14px] font-semibold'
        }
      />
      {changed ? (
        <div className="mt-0.5 flex items-center justify-end gap-1">
          <span className="text-[10.5px] text-[#94A3B8] line-through">
            {formatUsd(original)} (Original Rate)
          </span>
          <AuditTrailTooltip auditLog={auditLog} />
        </div>
      ) : null}
    </div>
  )
}

export function PricingSection({
  tab,
  draft,
  patch,
  pricingRows,
  setPricingRows,
  overrideOn,
  onToggleOverride,
  overrideModalOpen,
  setOverrideModalOpen,
  overrideReasonDraft,
  setOverrideReasonDraft,
  onSubmitOverride,
  auditLog,
  guests,
  showAddButton = false,
  onAdd,
}: {
  tab: ServiceTab
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  pricingRows: PricingRow[]
  setPricingRows: (rows: PricingRow[]) => void
  overrideOn: boolean
  onToggleOverride: () => void
  overrideModalOpen: boolean
  setOverrideModalOpen: (v: boolean) => void
  overrideReasonDraft: string
  setOverrideReasonDraft: (v: string) => void
  onSubmitOverride: () => void
  auditLog: AuditEntry[]
  guests?: import('@/shared/lib/types').Guest[]
  showAddButton?: boolean
  onAdd?: () => void
}) {
  const vehicles = asVehicles(draft)
  const activities = asActivities(draft)
  const rooms = asRooms(draft)
  const rates = (draft.rates || {}) as Record<string, number>
  const start = String(draft.start || '')
  const end = String(draft.end || '')

  const { net, rack } = computeDraftTotals(
    tab,
    draft,
    overrideOn ? pricingRows : undefined,
    guests,
  )
  const discount = Number(draft.discount) || 0
  const systemPrice = liveSystemPrice(net, rack, discount, String(draft.promotion || '') || null)

  const liveRows: {
    id?: string
    type: string
    charge: string
    net: number
    rack: number
    onNet?: (n: number) => void
    onRack?: (n: number) => void
  }[] =
    tab === 'transportation'
      ? vehicles.map((v) => ({
          type: v.type,
          charge: 'Per Unit',
          net: v.rate,
          rack: rackOf(v.rate),
          onNet: (n) =>
            patch({
              vehicles: vehicles.map((x) => (x.id === v.id ? { ...x, rate: n } : x)),
            }),
        }))
      : tab === 'flight'
        ? (['adult', 'youth', 'child', 'infant'] as const).map((k) => ({
            type: k[0].toUpperCase() + k.slice(1),
            charge: 'Per Person',
            net: rates[k] || 0,
            rack: rackOf(rates[k] || 0),
            onNet: (n) => patch({ rates: { ...rates, [k]: n } }),
          }))
        : tab === 'activity' || (tab === 'other' && activities.length > 0)
          ? activities.map((a) => ({
              type: a.name,
              charge: 'Per Person',
              net: a.rate,
              rack: rackOf(a.rate),
              onNet: (n) =>
                patch({
                  activities: activities.map((x) => (x.id === a.id ? { ...x, rate: n } : x)),
                }),
            }))
          : tab === 'other'
            ? [
                {
                  type: String(draft.description || 'Line item'),
                  charge: 'Per Unit',
                  net: Number(draft.price) || 0,
                  rack: rackOf(Number(draft.price) || 0),
                  onNet: (n) => patch({ price: n }),
                },
              ]
            : overrideOn
              ? pricingRows.map((r) => ({
                  id: r.id,
                  type: roomTypeLabel(r.type),
                  charge: r.charge,
                  net: r.net,
                  rack: r.rack,
                  onNet: (n) =>
                    setPricingRows(
                      pricingRows.map((x) =>
                        x.id === r.id ? { ...x, net: n, rack: rackOf(n) } : x,
                      ),
                    ),
                  onRack: (n) =>
                    setPricingRows(pricingRows.map((x) => (x.id === r.id ? { ...x, rack: n } : x))),
                }))
              : (() => {
                  const byLabel = new Map<string, { net: number; rack: number; qty: number }>()
                  for (const room of rooms) {
                    const br = roomPriceBreakdown(room, start, end, guests)
                    for (const pr of br.priceRows) {
                      const cur = byLabel.get(pr.label) || { net: 0, rack: 0, qty: 0 }
                      cur.net += pr.net
                      cur.rack += pr.rack
                      cur.qty += pr.qty
                      byLabel.set(pr.label, cur)
                    }
                  }
                  const rows = [...byLabel.entries()].map(([label, v]) => ({
                    type: label,
                    charge: 'PPPN',
                    net: v.net,
                    rack: v.rack,
                  }))
                  return rows.length
                    ? rows
                    : [{ type: 'No rooms priced yet', charge: '—', net: 0, rack: 0 }]
                })()

  const isTransport = tab === 'transportation'
  const gridCols = isTransport ? 'grid-cols-[1.6fr_0.9fr_0.9fr]' : 'grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr]'

  const originalRatesRef = useRef<Record<string, { net: number; rack: number }>>({})
  const wasOverrideOn = useRef(false)
  useEffect(() => {
    if (overrideOn && !wasOverrideOn.current) {
      const snapshot: Record<string, { net: number; rack: number }> = {}
      for (const r of liveRows) snapshot[r.type] = { net: r.net, rack: r.rack }
      originalRatesRef.current = snapshot
    }
    wasOverrideOn.current = overrideOn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrideOn])

  return (
    <section className="rounded-xl border bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">Pricing</h3>
        <button
          type="button"
          onClick={onToggleOverride}
          className="text-[14px] font-semibold text-[#2563EB]"
        >
          {overrideOn ? 'Done' : 'Override Prices'}
        </button>
      </div>

      <div className="mb-3 overflow-hidden rounded-lg border">
        <div
          className={`grid ${gridCols} gap-2 bg-[#4B4B4B] px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-white`}
        >
          <span>{isTransport ? 'Vehicle' : 'Type'}</span>
          {!isTransport ? <span>Charge</span> : null}
          <span className="text-right">{isTransport ? '$ Cost' : '$, COST'}</span>
          <span className="text-right">{isTransport ? '$ Sell' : '$, SELL'}</span>
        </div>
        {isTransport && liveRows.length === 0 ? (
          <div className="px-3 py-2 text-[12px] text-[#A1A1A1]">No vehicles added yet.</div>
        ) : null}
        {liveRows.map((r, i) => {
          const original = originalRatesRef.current[r.type]
          return (
            <div
              key={`${r.type}-${i}`}
              className={`grid ${gridCols} items-center gap-2 border-b px-3 py-2 last:border-0`}
              style={{ background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}
            >
              <span className="truncate text-[13px] font-semibold">{r.type}</span>
              {!isTransport ? <span className="text-[12px] text-[#737373]">{r.charge}</span> : null}
              {overrideOn && r.onNet ? (
                <OverrideAmountField
                  value={r.net}
                  original={original?.net}
                  onChange={r.onNet}
                  auditLog={auditLog}
                />
              ) : (
                <span className="text-right text-[15px] font-bold">{formatUsd(r.net)}</span>
              )}
              {overrideOn && r.onRack ? (
                <OverrideAmountField
                  value={r.rack}
                  original={original?.rack}
                  onChange={r.onRack}
                  auditLog={auditLog}
                />
              ) : (
                <span className="text-right text-[15px] font-bold">{formatUsd(r.rack)}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="overflow-hidden rounded-[10px] border">
        <div className="bg-[#4B4B4B] px-4 py-2.5 text-[12px] font-bold tracking-wide text-white">
          SYSTEM PRICE
        </div>
        {systemPrice.map((sp, i) => (
          <div
            key={sp.label}
            className="flex items-center justify-between border-t border-[#F1F1F3] px-4 py-3"
            style={{ background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}
          >
            <span
              className="text-[#171717]"
              style={{
                fontSize: sp.strong ? 17 : 14,
                fontWeight: sp.strong ? 800 : 600,
              }}
            >
              {sp.label}
            </span>
            <span
              className="text-[#171717]"
              style={{
                fontSize: sp.strong ? 17 : 14,
                fontWeight: sp.strong ? 800 : 600,
              }}
            >
              {sp.value}
            </span>
          </div>
        ))}
      </div>

      {showAddButton && onAdd ? (
        <div className="mt-4 flex justify-end border-t pt-3">
          <Button className="bg-[#931115] hover:bg-[#7a0e12]" onClick={onAdd}>
            Add to itinerary
          </Button>
        </div>
      ) : null}

      <Dialog open={overrideModalOpen} onOpenChange={setOverrideModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reason for price override</DialogTitle>
          </DialogHeader>
          <textarea
            rows={4}
            placeholder="e.g. Agreed rate with supplier for repeat client; matching competitor quote."
            value={overrideReasonDraft}
            onChange={(e) => setOverrideReasonDraft(e.target.value)}
            className="w-full resize-vertical rounded-lg border p-2.5 text-[14px] outline-none"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideModalOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!overrideReasonDraft.trim()}
              className="bg-[#931115] hover:bg-[#7a0e12]"
              onClick={onSubmitOverride}
            >
              Confirm & edit prices
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  )
}
