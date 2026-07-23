import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { VEHICLE_TYPES } from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogItem, Guest, Vehicle } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { GuestChip } from './BuilderModals'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import { TRANS_SERVICES, asVehicles, findGuest, guestChipStyle, usedGuestIds } from './builderUtils'

export function TransportationPanel({
  draft,
  patch,
  guests,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
}) {
  const vehicles = asVehicles(draft)
  const used = usedGuestIds(vehicles)
  const isHire = draft.transMode === 'hire'
  const modeBtn = (on: boolean) =>
    cn(
      'h-[30px] rounded-[7px] border px-3.5 text-[12.5px] font-semibold',
      on
        ? 'border-[#931115] bg-[#FBEBEC] text-[#931115]'
        : 'border-[#E5E7EB] bg-white text-[#525252]',
    )

  function setVehicles(next: Vehicle[]) {
    patch({ vehicles: next })
  }

  function autoAssign() {
    const pool = guests.map((g) => g.id)
    const next = vehicles.map((v) => ({ ...v, guestIds: [] as number[] }))
    next.forEach((v) => {
      while (pool.length && v.guestIds.length < v.cap) {
        v.guestIds.push(pool.shift()!)
      }
    })
    setVehicles(next)
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            Supplier & route
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">Pick location, supplier and transfer details</p>
        </div>
        <div className="mb-3 flex gap-2">
          <button type="button" className={modeBtn(!isHire)} onClick={() => patch({ transMode: 'transfer' })}>
            Transfer
          </button>
          <button type="button" className={modeBtn(isHire)} onClick={() => patch({ transMode: 'hire' })}>
            Car hire
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <LocationDropdown
              value={String(draft.location || '')}
              onChange={(name) => patch({ location: name, supplier: '', service: '' })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <SupplierPicker
              tab="transportation"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) => patch({ supplier: item.name, service: item.service })}
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Service</Label>
            <Select
              value={String(draft.service || '') || undefined}
              onValueChange={(value) => patch({ service: value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
              {TRANS_SERVICES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          {isHire ? (
            <>
              <div className="grid gap-1.5">
                <Label>Hire start</Label>
                <DatePickerGridInput
                  value={String(draft.hireStart || '')}
                  onChange={(value) => patch({ hireStart: value })}
                  className="bg-white"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Hire end</Label>
                <DatePickerGridInput
                  value={String(draft.hireEnd || '')}
                  onChange={(value) => patch({ hireEnd: value })}
                  referenceValue={String(draft.hireStart || '')}
                  className="bg-white"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Transfer date</Label>
              <DatePickerGridInput
                value={String(draft.transDate || '')}
                onChange={(value) => patch({ transDate: value })}
                className="bg-white"
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Pickup</Label>
            <LocationDropdown
              value={String(draft.pickup || '')}
              onChange={(v) => patch({ pickup: v })}
              placeholder="Select pickup"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Drop-off</Label>
            <LocationDropdown
              value={String(draft.dropoff || '')}
              onChange={(v) => patch({ dropoff: v })}
              placeholder="Select drop-off"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Time from</Label>
            <Input
              type="time"
              value={String(draft.timeFrom || '')}
              onChange={(e) => patch({ timeFrom: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Time to</Label>
            <Input
              type="time"
              value={String(draft.timeTo || '')}
              onChange={(e) => patch({ timeTo: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            Vehicles & PAX
          </h3>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={autoAssign}>
              <RefreshCw className="size-3.5" />
              Auto-assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setVehicles([
                  ...vehicles,
                  { id: `v${Date.now()}`, type: 'Land Cruiser', cap: 6, rate: 220, guestIds: [] },
                ])
              }
            >
              <Plus className="size-3.5" />
              Add vehicle
            </Button>
          </div>
        </div>
        <div className="space-y-3">
          {vehicles.map((v, i) => {
            const avail = guests.filter((g) => !used.includes(g.id))
            const over = v.guestIds.length > v.cap
            return (
              <div key={v.id} className="rounded-xl border bg-[#F9FAFB] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded border bg-white text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <Select
                    value={v.type}
                    onValueChange={(value) => {
                      const found = VEHICLE_TYPES.find((t) => t.type === value)
                      setVehicles(
                        vehicles.map((x) =>
                          x.id === v.id
                            ? { ...x, type: value, cap: found ? found.cap : x.cap }
                            : x,
                        ),
                      )
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto bg-white text-[12.5px] font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    {VEHICLE_TYPES.map((t) => (
                      <SelectItem key={t.type} value={t.type}>
                        {t.type} ({t.cap})
                      </SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: over ? '#DC2626' : '#16A34A' }}
                  >
                    {v.guestIds.length} / {v.cap} PAX
                  </span>
                  <Input
                    type="number"
                    className="h-7 w-24 text-xs"
                    value={v.rate}
                    onChange={(e) =>
                      setVehicles(
                        vehicles.map((x) =>
                          x.id === v.id ? { ...x, rate: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                  />
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setVehicles(vehicles.filter((x) => x.id !== v.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {v.guestIds.map((gid) => {
                    const g = findGuest(gid, guests)
                    if (!g) return null
                    const cs = guestChipStyle(g)
                    return (
                      <GuestChip
                        key={gid}
                        name={g.name}
                        resLabel={cs.resLabel}
                        resBg={cs.resBg}
                        resFg={cs.resFg}
                        bg={cs.bg}
                        bd={cs.bd}
                        onRemove={() =>
                          setVehicles(
                            vehicles.map((x) =>
                              x.id === v.id
                                ? { ...x, guestIds: x.guestIds.filter((id) => id !== gid) }
                                : x,
                            ),
                          )
                        }
                      />
                    )
                  })}
                </div>
                <Select
                  value={undefined}
                  onValueChange={(value) => {
                    const gid = Number(value)
                    if (!gid) return
                    setVehicles(
                      vehicles.map((x) =>
                        x.id === v.id ? { ...x, guestIds: [...x.guestIds, gid] } : x,
                      ),
                    )
                  }}
                >
                  <SelectTrigger className="h-8 bg-white text-[12.5px]">
                    <SelectValue placeholder="+ Add guest" />
                  </SelectTrigger>
                  <SelectContent>
                  {avail.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
                <div className="mt-2 flex justify-between text-[12px] text-[#525252]">
                  <span>{v.type}</span>
                  <span>
                    {formatUsd(v.rate)} / {formatUsd(rackOf(v.rate))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <textarea
          readOnly
          rows={3}
          className="mt-3 w-full resize-none rounded-lg border bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
          value="Rates include fuel and driver-guide. Vehicle capacity excludes driver."
        />
      </section>
    </div>
  )
}
