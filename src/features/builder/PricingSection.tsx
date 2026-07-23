import { liveSystemPrice } from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ServiceTab } from '@/shared/lib/types'
import { formatUsd } from '@/shared/lib/utils'
import type { AuditEntry, PricingRow } from './builderUtils'
import { asActivities, asRooms, asVehicles, computeDraftTotals, roomPriceBreakdown } from './builderUtils'

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
  onAdd,
  guests,
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
  onAdd: () => void
  guests?: import('@/shared/lib/types').Guest[]
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
  const systemPrice = liveSystemPrice(net, rack, discount)
  const clientPrice = systemPrice.find((x) => x.label === 'Client price')?.value ?? formatUsd(0)

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
        : tab === 'activity'
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
                  type: r.type,
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
                  // Aggregate live ACC_RATE breakdown across rooms for display.
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

      {auditLog.length > 0 ? (
        <div className="mb-3 rounded-lg border bg-[#F8FAFC] p-3">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#64748B]">
            Price override audit trail
          </div>
          {auditLog.map((a, i) => (
            <div key={i} className="mb-1.5 last:mb-0">
              <div className="text-[13px] font-semibold text-[#171717]">{a.reason}</div>
              <div className="text-[11.5px] text-[#737373]">
                by {a.user} · {a.at}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-3 overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr] gap-2 border-b bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#737373]">
          <span>Type</span>
          <span>Charge</span>
          <span className="text-right">Net</span>
          <span className="text-right">Rack</span>
        </div>
        {liveRows.map((r, i) => (
          <div
            key={`${r.type}-${i}`}
            className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr] items-center gap-2 border-b px-3 py-2 last:border-0"
            style={{ background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}
          >
            <span className="truncate text-[13px] font-semibold">{r.type}</span>
            <span className="text-[12px] text-[#737373]">{r.charge}</span>
            <div className="text-right">
              {overrideOn && r.onNet ? (
                <input
                  type="number"
                  min={0}
                  value={r.net}
                  onChange={(e) => r.onNet?.(Number(e.target.value) || 0)}
                  className="ml-auto h-8 w-[84px] rounded-md border px-2 text-right text-[14px] font-semibold"
                />
              ) : (
                <span className="text-[15px] font-bold">{formatUsd(r.net)}</span>
              )}
            </div>
            <div className="text-right">
              {overrideOn && r.onRack ? (
                <input
                  type="number"
                  min={0}
                  value={r.rack}
                  onChange={(e) => r.onRack?.(Number(e.target.value) || 0)}
                  className="ml-auto h-8 w-[84px] rounded-md border px-2 text-right text-[14px] font-semibold"
                />
              ) : (
                <span className="text-[15px] font-bold">{formatUsd(r.rack)}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-3 grid gap-1.5">
        <Label>Discount ($)</Label>
        <Input
          type="number"
          value={discount}
          onChange={(e) => patch({ discount: Number(e.target.value) || 0 })}
        />
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border">
        {systemPrice.map((sp, i) => (
          <div
            key={sp.label}
            className="flex items-center justify-between border-b px-3 py-2 last:border-0"
            style={{ background: i % 2 === 1 ? '#F9FAFB' : '#FFFFFF' }}
          >
            <span className="text-[13px] text-[#525252]">{sp.label}</span>
            <span
              style={{
                fontSize: sp.strong ? 17 : 15,
                fontWeight: sp.strong ? 800 : 600,
              }}
            >
              {sp.value}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#737373]">
            Client price
          </div>
          <div className="text-lg font-bold">{clientPrice}</div>
        </div>
        <Button className="bg-[#931115] hover:bg-[#7a0e12]" onClick={onAdd}>
          Add to itinerary
        </Button>
      </div>

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
