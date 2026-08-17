import { useState } from 'react'
import { Plus, RefreshCw, Trash2 } from 'lucide-react'
import { PROMOTIONS, extrasForTab } from '@/shared/lib/catalogs'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogItem, DemoRole, Guest, Vehicle } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { CustomExtraModal, GuestChip } from './BuilderModals'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
import { SupplierPicker } from './SupplierPicker'
import {
  TRANS_SERVICES,
  asCustomExtras,
  asExtraIds,
  asVehicles,
  extraObjects,
  findGuest,
  guestChipStyle,
  usedGuestIds,
  autoAssignByCapacity,
} from './builderUtils'
import { resolveServiceOption, vehicleOptionsForService } from './serviceOptions'

// Extras and Special Offer(s) content below is invented for this prototype —
// Transport's real ticket (PCP-1462) said "No Extras" / "Special Offers only
// if the API exposes them," but Clint deliberately reversed that for this
// build. Flagged in the session report for BA/product sign-off; the data
// shape mirrors the other three panels exactly (extrasForTab + PROMOTIONS),
// nothing new invented at the architecture level, only at the content level.
type TransTab = 'policy' | 'extras' | 'promotions' | 'notes'

export function TransportationPanel({
  draft,
  patch,
  guests,
  demoRole,
  isDraftItinerary,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
  demoRole: DemoRole
  isDraftItinerary: boolean
}) {
  const [transTab, setTransTab] = useState<TransTab>('policy')
  const [ceOpen, setCeOpen] = useState(false)
  const vehicles = asVehicles(draft)
  const used = usedGuestIds(vehicles)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const serviceId = String(draft.serviceId || '')
  const vehicleOptions = vehicleOptionsForService(serviceId)

  function setVehicles(next: Vehicle[]) {
    patch({ vehicles: next })
  }

  function autoAssign() {
    setVehicles(autoAssignByCapacity(vehicles, guests, (v) => v.cap))
  }

  const tabBtn = (key: TransTab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setTransTab(key)}
      className={cn(
        'h-[38px] border-b-2 px-3 text-[13px] font-semibold',
        transTab === key ? 'border-[#931115] text-[#931115]' : 'border-transparent text-[#525252]',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'ml-1 rounded px-1.5 text-[11px] font-semibold',
            transTab === key ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#F3F4F6] text-[#525252]',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <div>
      <section className="mb-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">
            Supplier & service
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">Pick location, supplier and service</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <LocationDropdown
              value={String(draft.location || '')}
              onChange={(name) =>
                patch({ location: name, supplier: '', service: '', serviceId: '' })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <SupplierPicker
              tab="transportation"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) =>
                patch({ supplier: item.name, service: item.service, serviceId: item.id })
              }
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
        </div>
      </section>

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
            <Select
              key={`add-vehicle-${String(draft.service || '')}-${vehicles.length}`}
              value={undefined}
              disabled={!String(draft.service || '').trim()}
              onValueChange={(type) => {
                const found = vehicleOptions.find((t) => t.type === type)
                if (!found) return
                setVehicles([
                  ...vehicles,
                  {
                    id: `v${Date.now()}`,
                    type: found.type,
                    cap: found.cap,
                    rate: found.rate,
                    guestIds: [],
                    dateFrom: String(draft.transDate || draft.hireStart || ''),
                    dateTo: String(draft.transDate || draft.hireEnd || draft.hireStart || ''),
                  },
                ])
              }}
            >
              <SelectTrigger className="h-7 w-auto gap-1 border-[#931115] bg-white px-2.5 text-xs font-semibold text-[#931115] shadow-none disabled:opacity-40">
                <Plus className="size-3.5" />
                <SelectValue
                  placeholder={
                    String(draft.service || '').trim() ? 'Add vehicle' : 'Select a service first'
                  }
                />
              </SelectTrigger>
              <SelectContent align="end">
                {vehicleOptions.map((t) => (
                  <SelectItem key={t.id} value={t.type}>
                    {t.type} ({t.cap})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                      const found = vehicleOptions.find((t) => t.type === value)
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
                      {vehicleOptions.map((t) => (
                        <SelectItem key={t.id} value={t.type}>
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
                  <OptionInclusions option={resolveServiceOption(serviceId, v.type)} />
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
                <div className="space-y-2.5 p-[9px]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-[#737373]">
                        Date From<span className="text-[#931115]">*</span>
                      </Label>
                      <DatePickerGridInput
                        value={v.dateFrom || ''}
                        onChange={(value) =>
                          setVehicles(
                            vehicles.map((x) => {
                              if (x.id !== v.id) return x
                              const next = { ...x, dateFrom: value }
                              // Keep Date To from drifting before From when From is set later.
                              if (value && x.dateTo && x.dateTo < value) next.dateTo = value
                              return next
                            }),
                          )
                        }
                        className="h-8 bg-white"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-[#737373]">
                        Date To<span className="text-[#931115]">*</span>
                      </Label>
                      <DatePickerGridInput
                        value={v.dateTo || ''}
                        onChange={(value) =>
                          setVehicles(
                            vehicles.map((x) => {
                              if (x.id !== v.id) return x
                              const next = { ...x, dateTo: value }
                              if (value && x.dateFrom && value < x.dateFrom) next.dateFrom = value
                              return next
                            }),
                          )
                        }
                        className="h-8 bg-white"
                      />
                    </div>
                  </div>
                  {(!v.dateFrom || !v.dateTo) && (
                    <p className="text-[11px] font-medium text-[#B45309]">
                      Date From and Date To are required for each vehicle.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
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
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-4 flex gap-1 border-b">
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Special Offer(s)', PROMOTIONS.length)}
        {tabBtn('policy', 'Policy')}
        {tabBtn('notes', 'Notes')}
      </div>

      {transTab === 'policy' ? (
        <div className="pt-3">
          <CancellationPolicyControl
            tab="transportation"
            draft={draft}
            patch={patch}
            demoRole={demoRole}
            isDraftItinerary={isDraftItinerary}
          />
        </div>
      ) : null}

      {transTab === 'extras' ? (
        <ExtrasTab
          className="pt-3"
          selected={extras}
          catalog={extrasForTab('transportation')}
          extraIds={extraIds}
          onAdd={(id) => patch({ extras: [...extraIds, id] })}
          onRemove={(ex) => {
            if (ex.custom) {
              patch({ customExtras: customExtras.filter((x) => x.id !== ex.id) })
            } else {
              patch({ extras: extraIds.filter((id) => id !== ex.id) })
            }
          }}
          onCustom={() => setCeOpen(true)}
        />
      ) : null}

      {transTab === 'promotions' ? (
        <div className="space-y-2 pt-3">
          {PROMOTIONS.map((p) => {
            const sel = draft.promotion === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => patch({ promotion: sel ? null : p.id })}
                className="flex w-full items-start gap-3 rounded-xl border p-3 text-left"
                style={{
                  borderColor: sel ? '#931115' : '#E5E7EB',
                  background: sel ? '#FEF2F2' : '#FFFFFF',
                }}
              >
                <span
                  className="mt-1 flex size-4 items-center justify-center rounded-full border"
                  style={{ borderColor: sel ? '#2B7FFF' : '#D4D4D4' }}
                >
                  {sel ? <span className="size-2 rounded-full bg-[#2B7FFF]" /> : null}
                </span>
                <span>
                  <span className="block text-[13.5px] font-semibold">{p.title}</span>
                  <span className="text-[12px] text-[#737373]">{p.desc}</span>
                  {p.active ? (
                    <span className="mt-1 inline-block text-[11px] font-bold text-[#059669]">
                      Active
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {transTab === 'notes' ? (
        <section className="space-y-4 pt-3">
          <div>
            <h3 className="mb-2 text-[14px] font-semibold text-[#171717]">Service Notes</h3>
            <textarea
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-2.5 py-2 text-[13px] text-[#525252] outline-none"
              value="Rates include fuel and driver-guide. Vehicle capacity excludes driver."
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline gap-2">
              <h3 className="text-[14px] font-semibold text-[#171717]">Internal notes</h3>
              <span className="text-[12px] font-medium text-[#94A3B8]">Not shown to the client</span>
            </div>
            <textarea
              rows={3}
              value={String(draft.notes || '')}
              onChange={(e) => patch({ notes: e.target.value })}
              className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-2.5 py-2 text-[13px] text-[#171717] outline-none placeholder:text-[#A1A1AA]"
              placeholder="Anything the ops team should know about this service…"
            />
          </div>
        </section>
      ) : null}

      <CustomExtraModal
        open={ceOpen}
        onClose={() => setCeOpen(false)}
        onSubmit={(extra) => {
          const n = Number(draft.customExtraSeq) || 1
          patch({
            customExtras: [
              ...customExtras,
              {
                id: `custom-t${n}`,
                title: extra.title,
                serviceType: extra.serviceType,
                chargeType: extra.chargeType,
                timeUnit: extra.timeUnit,
                qty: extra.qty,
                price: extra.price,
                dateFrom: extra.dateFrom,
                dateTo: extra.dateTo,
                custom: true,
              },
            ],
            customExtraSeq: n + 1,
          })
        }}
      />
    </div>
  )
}
