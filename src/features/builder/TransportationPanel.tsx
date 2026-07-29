import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { EXTRAS_CATALOG, VEHICLE_TYPES } from '@/shared/lib/catalogs'
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
import {
  TRANS_SERVICES,
  asCustomExtras,
  asExtraIds,
  asHireRoutes,
  asVehicles,
  extraObjects,
  findGuest,
  guestChipStyle,
  usedGuestIds,
} from './builderUtils'

type TransTab = 'guests' | 'extras'
const PAX_BANDS: { key: 'adult' | 'child' | 'infant'; label: string }[] = [
  { key: 'adult', label: 'Adults' },
  { key: 'child', label: 'Children' },
  { key: 'infant', label: 'Infants' },
]

export function TransportationPanel({
  draft,
  patch,
  guests,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
}) {
  const [rightTab, setRightTab] = useState<TransTab>('guests')
  const vehicles = asVehicles(draft)
  const used = usedGuestIds(vehicles)
  const isHire = draft.transMode === 'hire'
  const hireRoutes = asHireRoutes(draft)
  const transPax = (draft.transPax || { adult: 0, child: 0, infant: 0 }) as Record<string, number>
  const totalTransPax = (transPax.adult || 0) + (transPax.child || 0) + (transPax.infant || 0)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)

  const modeBtn = (on: boolean) =>
    cn(
      'h-[30px] rounded-[7px] border px-3.5 text-[12.5px] font-semibold',
      on
        ? 'border-[#931115] bg-[#FBEBEC] text-[#931115]'
        : 'border-[#E5E7EB] bg-white text-[#525252]',
    )

  const tabBtn = (key: TransTab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setRightTab(key)}
      className={cn(
        'h-[38px] border-b-2 px-3 text-[13px] font-semibold',
        rightTab === key ? 'border-[#931115] text-[#931115]' : 'border-transparent text-[#525252]',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="ml-1 rounded bg-[#F3F4F6] px-1.5 text-[11px] font-semibold">{badge}</span>
      ) : null}
    </button>
  )

  function setVehicles(next: Vehicle[]) {
    patch({ vehicles: next })
  }

  function autoAssign() {
    const cap = totalTransPax > 0 ? totalTransPax : guests.length
    const pool = guests.map((g) => g.id).slice(0, cap)
    const next = vehicles.map((v) => ({ ...v, guestIds: [] as number[] }))
    next.forEach((v) => {
      while (pool.length && v.guestIds.length < v.cap) {
        v.guestIds.push(pool.shift()!)
      }
    })
    setVehicles(next)
  }

  const target = totalTransPax > 0 ? totalTransPax : guests.length
  const anyOverCap = vehicles.some((v) => v.guestIds.length > v.cap)
  const vehiclesMsg = anyOverCap
    ? { text: 'A vehicle is over capacity', color: '#DC2626' }
    : used.length < target
      ? { text: `${target - used.length} to place`, color: '#B45309' }
      : { text: 'All guests assigned', color: '#16A34A' }

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

      <div className="flex gap-1 border-b">
        {tabBtn('guests', 'Guests')}
        {tabBtn('extras', 'Extras', extras.length)}
      </div>

      {rightTab === 'guests' ? (
        <div className="space-y-4">
          <section className="rounded-xl border bg-white p-4">
            <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#475569]">
              Guests
            </h3>
            <div className="flex overflow-hidden rounded-lg border">
              {PAX_BANDS.map((b, i) => (
                <div
                  key={b.key}
                  className={cn(
                    'flex flex-1 items-center justify-between gap-2 px-3 py-2',
                    i > 0 ? 'border-l' : '',
                  )}
                >
                  <span className="text-[12.5px] text-[#525252]">{b.label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          transPax: { ...transPax, [b.key]: Math.max(0, (transPax[b.key] || 0) - 1) },
                        })
                      }
                      className="flex size-[22px] items-center justify-center rounded-md border bg-[#F9FAFB] text-[#525252]"
                    >
                      −
                    </button>
                    <span className="min-w-3.5 text-center text-[13px] font-semibold">
                      {transPax[b.key] || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        patch({ transPax: { ...transPax, [b.key]: (transPax[b.key] || 0) + 1 } })
                      }
                      className="flex size-[22px] items-center justify-center rounded-md border bg-[#F9FAFB] text-[#525252]"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
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
            {totalTransPax === 0 ? (
              <p className="mb-3 text-[12px] text-[#A1A1A1]">
                Add adults/children above, then Auto-assign to fill vehicles by capacity.
              </p>
            ) : null}
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
            {vehicles.length > 0 ? (
              <p className="mt-3 text-[12px] font-semibold" style={{ color: vehiclesMsg.color }}>
                {vehiclesMsg.text}
              </p>
            ) : null}
            <textarea
              readOnly
              rows={3}
              className="mt-3 w-full resize-none rounded-lg border bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
              value="Rates include fuel and driver-guide. Vehicle capacity excludes driver."
            />
          </section>
        </div>
      ) : null}

      {rightTab === 'extras' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold">Extras</span>
            <button
              type="button"
              className="text-[12px] font-medium text-[#0369A1]"
              onClick={() => {
                const n = Number(draft.customExtraSeq) || 1
                patch({
                  customExtras: [
                    ...customExtras,
                    { id: `custom-t${n}`, title: 'Custom extra', price: 0, custom: true },
                  ],
                  customExtraSeq: n + 1,
                })
              }}
            >
              Add Custom Extra
            </button>
          </div>
          {extras.map((ex) => (
            <div key={ex.id} className="overflow-hidden rounded-lg border">
              {ex.mandatory ? (
                <div className="bg-[#E5E7EB] py-0.5 text-center text-[10px] font-bold text-[#525252]">
                  Mandatory
                </div>
              ) : null}
              <div className="flex items-center justify-between px-2.5 py-2">
                <span className="text-[13px] font-bold">{ex.title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{formatUsd(ex.price)}</span>
                  {!ex.mandatory ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (ex.custom) {
                          patch({ customExtras: customExtras.filter((x) => x.id !== ex.id) })
                        } else {
                          patch({ extras: extraIds.filter((id) => id !== ex.id) })
                        }
                      }}
                    >
                      <Trash2 className="size-3.5 text-[#931115]" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#A1A1A1]">
            Catalog
          </p>
          {EXTRAS_CATALOG.filter((c) => !extraIds.includes(c.id)).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patch({ extras: [...extraIds, c.id] })}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-[#F9FAFB]"
            >
              <span className="text-[13px] font-semibold">{c.title}</span>
              <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#525252]">
                {formatUsd(c.price)}
                <Plus className="size-3.5 text-[#931115]" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
