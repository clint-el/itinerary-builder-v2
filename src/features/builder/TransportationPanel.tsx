import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { VEHICLE_TYPES } from '@/shared/lib/catalogs'
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
import {
  TRANS_SERVICES,
  asHireRoutes,
  asVehicles,
  findGuest,
  guestChipStyle,
  usedGuestIds,
} from './builderUtils'

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
  const hireRoutes = asHireRoutes(draft)

  const modeBtn = (on: boolean) =>
    cn(
      'h-[38px] rounded-lg border px-5 text-[14.5px] font-semibold',
      on
        ? 'border-[#931115] bg-[#FBEBEC] text-[#931115]'
        : 'border-[#E5E7EB] bg-white text-[#171717]',
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
    <div>
      <section className="mb-5 rounded-xl border border-[#E5E7EB] bg-white px-5 pb-5 pt-[18px] shadow-sm">
        <div className="mb-3">
          <h3 className="text-[12.5px] font-bold uppercase tracking-[0.06em] text-[#334155]">
            Supplier & route
          </h3>
          <p className="mt-1 text-[13.5px] font-medium text-[#64748B]">
            Pick location, supplier and transfer details
          </p>
        </div>
        <div className="mb-[18px] mt-4 flex gap-2.5">
          <button type="button" className={modeBtn(!isHire)} onClick={() => patch({ transMode: 'transfer' })}>
            Transfer
          </button>
          <button type="button" className={modeBtn(isHire)} onClick={() => patch({ transMode: 'hire' })}>
            Vehicle Disposal
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
                <SelectItem key={s.title} value={s.title}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{s.title}</span>
                    <span className="text-[11px] text-[#A1A1A1]">
                      {formatUsd(s.price)} · {s.unit}
                    </span>
                  </span>
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          {isHire ? (
            <>
              <div className="grid gap-1.5">
                <Label>Start</Label>
                <DatePickerGridInput
                  value={String(draft.hireStart || '')}
                  onChange={(value) => patch({ hireStart: value })}
                  className="bg-white"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>End</Label>
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
          {!isHire ? (
            <>
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
            </>
          ) : null}
        </div>
      </section>

      {isHire ? (
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
                Routes
              </h3>
              <p className="text-[11.5px] text-[#94A3B8]">
                Key in each leg — date, route and times
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                patch({
                  hireRoutes: [
                    ...hireRoutes,
                    {
                      id: `r${Date.now()}`,
                      date: '',
                      pickup: '',
                      dropoff: '',
                      timeFrom: '',
                      timeTo: '',
                    },
                  ],
                })
              }
            >
              <Plus className="size-3.5" />
              Add route
            </Button>
          </div>

          {hireRoutes.length === 0 ? (
            <p className="text-[12.5px] text-[#A1A1A1]">No routes yet — add the first leg.</p>
          ) : (
            <div className="space-y-3">
              {hireRoutes.map((r, i) => (
                <div key={r.id} className="rounded-xl border bg-[#F9FAFB] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-5 items-center justify-center rounded border bg-white text-[11px] font-bold">
                      {i + 1}
                    </span>
                    <span className="text-[12px] font-semibold text-[#525252]">Leg {i + 1}</span>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() =>
                        patch({ hireRoutes: hireRoutes.filter((x) => x.id !== r.id) })
                      }
                      className="flex size-[26px] items-center justify-center rounded-md border bg-white text-[#931115]"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label>Date</Label>
                      <DatePickerGridInput
                        value={r.date}
                        onChange={(value) =>
                          patch({
                            hireRoutes: hireRoutes.map((x) =>
                              x.id === r.id ? { ...x, date: value } : x,
                            ),
                          })
                        }
                        className="bg-white"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Pickup</Label>
                      <LocationDropdown
                        value={r.pickup}
                        onChange={(v) =>
                          patch({
                            hireRoutes: hireRoutes.map((x) =>
                              x.id === r.id ? { ...x, pickup: v } : x,
                            ),
                          })
                        }
                        placeholder="Select pickup"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Drop-off</Label>
                      <LocationDropdown
                        value={r.dropoff}
                        onChange={(v) =>
                          patch({
                            hireRoutes: hireRoutes.map((x) =>
                              x.id === r.id ? { ...x, dropoff: v } : x,
                            ),
                          })
                        }
                        placeholder="Select drop-off"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Time from</Label>
                      <Input
                        type="time"
                        value={r.timeFrom}
                        onChange={(e) =>
                          patch({
                            hireRoutes: hireRoutes.map((x) =>
                              x.id === r.id ? { ...x, timeFrom: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label>Time to</Label>
                      <Input
                        type="time"
                        value={r.timeTo}
                        onChange={(e) =>
                          patch({
                            hireRoutes: hireRoutes.map((x) =>
                              x.id === r.id ? { ...x, timeTo: e.target.value } : x,
                            ),
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-dashed pt-3">
            <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
              Service lines
            </h3>
            <p className="text-[11.5px] text-[#94A3B8]">
              Consecutive days on the same route bill as one line
            </p>
            <p className="mt-2 text-[12.5px] text-[#525252]">
              Routes are tracked per leg and shown on the itinerary day-by-day.
            </p>
          </div>
        </section>
      ) : null}

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13.5px] font-bold text-[#171717]">Vehicles &amp; PAX</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={autoAssign}
              className="h-7 border-[#931115] text-xs font-semibold text-[#931115]"
            >
              <RefreshCw className="size-3.5" />
              Auto-assign
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-[#931115] text-xs font-semibold text-[#931115]"
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

        <div className="space-y-2.5">
          {vehicles.map((v, i) => {
            const avail = guests.filter((g) => !used.includes(g.id))
            const over = v.guestIds.length > v.cap
            return (
              <div key={v.id} className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                <div className="flex flex-wrap items-center gap-2 bg-[#F9FAFB] px-[9px] py-[7px]">
                  <span className="flex size-5 items-center justify-center rounded-[5px] border border-[#E5E7EB] bg-white text-[11px] font-bold text-[#525252]">
                    {i + 1}
                  </span>
                  <Select
                    value={v.type}
                    onValueChange={(value) => {
                      const found = VEHICLE_TYPES.find((t) => t.type === value)
                      setVehicles(
                        vehicles.map((x) =>
                          x.id === v.id
                            ? {
                                ...x,
                                type: value,
                                cap: found ? found.cap : x.cap,
                                rate: found ? found.rate : x.rate,
                              }
                            : x,
                        ),
                      )
                    }}
                  >
                    <SelectTrigger className="h-7 w-auto bg-white px-2 text-[12.5px] font-semibold">
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
                    className="whitespace-nowrap text-xs font-semibold"
                    style={{ color: over ? '#DC2626' : '#16A34A' }}
                  >
                    {v.guestIds.length} / {v.cap} PAX
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    title="Remove vehicle"
                    onClick={() => setVehicles(vehicles.filter((x) => x.id !== v.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 p-[9px]">
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
                    <SelectTrigger className="h-7 w-auto border-dashed border-[#C9CCD3] bg-white px-2 text-xs font-semibold text-[#525252]">
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
                </div>
              </div>
            )
          })}
        </div>

        <div className="mb-3 mt-3">
          <h3 className="mb-2 text-[14px] font-semibold text-[#171717]">Service Notes</h3>
          <textarea
            readOnly
            rows={3}
            className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-2.5 py-2 text-[13px] text-[#525252] outline-none"
            value="Rates include fuel and driver-guide. Vehicle capacity excludes driver."
          />
        </div>
      </section>
    </div>
  )
}
