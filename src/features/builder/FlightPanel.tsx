import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { CATALOG, PROMOTIONS, extrasForTab } from '@/shared/lib/catalogs'
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
import type { CatalogItem, DemoRole, FlightInstance, Guest } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
import { SupplierPicker } from './SupplierPicker'
import {
  FLIGHT_SERVICES,
  addableFlightOptions,
  asCustomExtras,
  asExtraIds,
  asFlights,
  extraObjects,
  findFlightServiceOption,
  findGuest,
  flightDepartMeta,
  formatFlightOptionDays,
  formatFlightOptionLabel,
  formatFlightOptionWindow,
  guestChipStyle,
  isDepartDateOnFlightOptionDay,
  isDepartTimeInFlightOptionWindow,
  usedGuestIds,
  autoAssignByCapacity,
} from './builderUtils'
import { resolveServiceOption } from './serviceOptions'
import { CustomExtraModal, GuestChip } from './BuilderModals'

type FlightTab = 'policy' | 'extras' | 'promotions' | 'notes'
const PAX_BANDS: { key: 'adult' | 'youth' | 'child' | 'infant'; label: string }[] = [
  { key: 'adult', label: 'Adult' },
  { key: 'youth', label: 'Youth' },
  { key: 'child', label: 'Child' },
  { key: 'infant', label: 'Infant' },
]

function routePatch(service: string, location: string) {
  const normalized = service.replace(/\s+OW$/i, '')
  const parts = normalized.split(/\s+(?:TO|to)\s+/)
  if (parts.length === 2) {
    return { service, flightFrom: parts[0].trim(), flightTo: parts[1].trim() }
  }
  return { service, flightFrom: location, flightTo: service }
}

export function FlightPanel({
  draft,
  patch,
  guests = [],
  demoRole,
  isDraftItinerary,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests?: Guest[]
  demoRole: DemoRole
  isDraftItinerary: boolean
}) {
  const [rightTab, setRightTab] = useState<FlightTab>('extras')
  const [ceOpen, setCeOpen] = useState(false)
  const partyPax = useMemo(() => {
    const next = { adult: 0, youth: 0, child: 0, infant: 0 }
    for (const guest of guests) {
      if (guest.type in next) next[guest.type] += 1
    }
    return next
  }, [guests])
  const capMax = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 5)
  const capMin = Math.max(1, Number(draft.capMin) || Number(draft.minSeats) || 2)
  const flights = asFlights(draft)
  const used = usedGuestIds(flights)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const service = String(draft.service || '')
  const serviceId = String(draft.serviceId || '')
  const flightOptions = addableFlightOptions(service)

  function setFlights(next: FlightInstance[]) {
    patch({ flights: next, flightOptionId: '', ...flightDepartMeta(next) })
  }

  function autoAssign() {
    setFlights(autoAssignByCapacity(flights, guests, (f) => f.cap))
  }

  function addFlightFromOption(optionId: string) {
    const option = findFlightServiceOption(service, optionId)
    if (!option) return
    setFlights([
      ...flights,
      {
        id: `f${Date.now()}`,
        cap: capMax,
        guestIds: [],
        optionId: option.id,
        optionName: option.name,
        departDate: String(draft.departDate || ''),
        departTime: '',
      },
    ])
  }

  useEffect(() => {
    const current = (draft.pax || {}) as Record<string, number>
    const changed =
      PAX_BANDS.some((band) => (current[band.key] || 0) !== partyPax[band.key]) ||
      Number(draft.capacity) !== capMax ||
      Number(draft.capMax) !== capMax ||
      Number(draft.capMin) !== capMin
    if (changed) patch({ pax: partyPax, capacity: capMax, capMin, capMax })
  }, [partyPax, capMax, capMin, draft.pax, draft.capacity, draft.capMax, draft.capMin, patch])

  const tabBtn = (key: FlightTab, label: string, badge?: number) => (
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
        <span
          className={cn(
            'ml-1 rounded px-1.5 text-[11px] font-semibold',
            rightTab === key ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#F3F4F6] text-[#525252]',
          )}
        >
          {badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
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
              value={String(draft.location || draft.flightFrom || '')}
              onChange={(name) =>
                patch({
                  location: name,
                  flightFrom: name,
                  flightTo: '',
                  supplier: '',
                  service: '',
                  serviceId: '',
                  flightOptionId: '',
                  flights: [],
                })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <SupplierPicker
              tab="flight"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) =>
                patch({
                  supplier: item.name,
                  serviceId: item.id,
                  flightOptionId: '',
                  flights: [],
                  ...routePatch(item.service, String(draft.location || draft.flightFrom || '')),
                })
              }
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Service</Label>
            <Select
              value={String(draft.service || '') || undefined}
              onValueChange={(value) => {
                const match = CATALOG.flight.find(
                  (c) =>
                    c.service === value ||
                    (value === 'Scheduled Economy' && c.service === 'Scheduled Economy (Y Class)') ||
                    (value === 'Private Charter' &&
                      (c.service === 'Charter Flight' || c.service === 'Charter flight')),
                )
                patch({
                  ...routePatch(value, String(draft.location || draft.flightFrom || '')),
                  serviceId: match?.id ?? '',
                  flightOptionId: '',
                  flights: [],
                })
              }}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select a service" />
              </SelectTrigger>
              <SelectContent>
                {FLIGHT_SERVICES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <div className="mb-2.5 flex items-center justify-between">
          <h3 className="text-[13.5px] font-bold text-[#171717]">Flights &amp; PAX</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={autoAssign}
              disabled={flights.length === 0}
              className="h-7 border-[#931115] text-xs font-semibold text-[#931115]"
            >
              <RefreshCw className="size-3.5" />
              Auto-assign
            </Button>
            <Select
              key={`add-flight-${service}-${flights.length}`}
              value={undefined}
              disabled={flightOptions.length === 0}
              onValueChange={addFlightFromOption}
            >
              <SelectTrigger className="h-7 w-auto gap-1 border-[#931115] bg-white px-2.5 text-xs font-semibold text-[#931115] shadow-none disabled:opacity-40">
                <Plus className="size-3.5" />
                <SelectValue placeholder={service ? 'Add flight' : 'Select a service first'} />
              </SelectTrigger>
              <SelectContent align="end" className="max-w-[min(100vw-2rem,28rem)]">
                {flightOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {formatFlightOptionLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2.5">
          {flights.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFB] px-3.5 py-6 text-center text-[12.5px] text-[#A1A1A1]">
              {service
                ? 'Use Add flight to pick a departure option for this service.'
                : 'Select a service, then add flight options below.'}
            </p>
          ) : null}
          {flights.map((f, i) => {
            const avail = guests.filter((g) => !used.includes(g.id))
            const over = f.guestIds.length > f.cap
            const flightOption = findFlightServiceOption(service, String(f.optionId || ''))
            const resolvedInclusions = resolveServiceOption(serviceId, String(f.optionId || ''))
            const timeOut =
              flightOption != null &&
              Boolean(f.departTime) &&
              !isDepartTimeInFlightOptionWindow(f.departTime || '', flightOption)
            const dateOff =
              flightOption != null &&
              Boolean(f.departDate) &&
              flightOption.days.length > 0 &&
              !isDepartDateOnFlightOptionDay(f.departDate || '', flightOption)
            return (
              <div key={f.id} className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                <div className="flex flex-wrap items-center gap-2 bg-[#F9FAFB] px-[9px] py-[7px]">
                  <span className="flex size-5 items-center justify-center rounded-[5px] border border-[#E5E7EB] bg-white text-[11px] font-bold text-[#525252]">
                    {i + 1}
                  </span>
                  {flightOptions.length > 0 ? (
                    <Select
                      value={f.optionId || undefined}
                      onValueChange={(value) => {
                        const opt = findFlightServiceOption(service, value)
                        if (!opt) return
                        setFlights(
                          flights.map((x) =>
                            x.id === f.id
                              ? { ...x, optionId: opt.id, optionName: opt.name }
                              : x,
                          ),
                        )
                      }}
                    >
                      <SelectTrigger className="h-7 max-w-[220px] bg-white px-2 text-[12.5px] font-semibold">
                        <SelectValue placeholder="Flight option" />
                      </SelectTrigger>
                      <SelectContent>
                        {flightOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="text-[12.5px] font-semibold text-[#171717]">
                      {f.optionName || 'Flight'}
                    </span>
                  )}
                  <span
                    className="whitespace-nowrap text-xs font-semibold"
                    style={{ color: over ? '#DC2626' : '#16A34A' }}
                  >
                    {f.guestIds.length} / {f.cap} PAX
                  </span>
                  <OptionInclusions option={resolvedInclusions} />
                  <div className="flex-1" />
                  <button
                    type="button"
                    title="Remove flight"
                    onClick={() => setFlights(flights.filter((x) => x.id !== f.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="space-y-2.5 p-[9px]">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-[#737373]">Departure date</Label>
                      <DatePickerGridInput
                        value={f.departDate || ''}
                        onChange={(value) =>
                          setFlights(
                            flights.map((x) => (x.id === f.id ? { ...x, departDate: value } : x)),
                          )
                        }
                        className="h-8 bg-white"
                      />
                      {dateOff && flightOption ? (
                        <div className="flex items-start gap-1.5 rounded-md bg-[#FFFBEB] px-2 py-1.5 shadow-[inset_0_0_0_1px_#FDE68A]">
                          <AlertTriangle className="mt-px size-3 shrink-0 text-[#B45309]" />
                          <p className="text-[11px] font-medium text-[#92400E]">
                            {flightOption.name} does not operate on this date (
                            {formatFlightOptionDays(flightOption.days)}).
                          </p>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid gap-1">
                      <Label className="text-[11px] text-[#737373]">Departure time</Label>
                      <Input
                        type="time"
                        value={f.departTime || ''}
                        onChange={(e) =>
                          setFlights(
                            flights.map((x) =>
                              x.id === f.id ? { ...x, departTime: e.target.value } : x,
                            ),
                          )
                        }
                        className="h-8 bg-white"
                      />
                      {timeOut && flightOption ? (
                        <div className="flex items-start gap-1.5 rounded-md bg-[#FFFBEB] px-2 py-1.5 shadow-[inset_0_0_0_1px_#FDE68A]">
                          <AlertTriangle className="mt-px size-3 shrink-0 text-[#B45309]" />
                          <p className="text-[11px] font-medium text-[#92400E]">
                            Outside {flightOption.name}&apos;s window (
                            {formatFlightOptionWindow(flightOption)}).
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {f.guestIds.map((gid) => {
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
                            setFlights(
                              flights.map((x) =>
                                x.id === f.id
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
                        setFlights(
                          flights.map((x) =>
                            x.id === f.id ? { ...x, guestIds: [...x.guestIds, gid] } : x,
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

      <div className="flex gap-1 border-b">
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Special Offer(s)', PROMOTIONS.length)}
        {tabBtn('policy', 'Policy')}
        {tabBtn('notes', 'Notes')}
      </div>

      {rightTab === 'policy' ? (
        <CancellationPolicyControl
          tab="flight"
          draft={draft}
          patch={patch}
          demoRole={demoRole}
          isDraftItinerary={isDraftItinerary}
        />
      ) : null}

      {rightTab === 'extras' ? (
        <ExtrasTab
          selected={extras}
          catalog={extrasForTab('flight')}
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

      {rightTab === 'promotions' ? (
        <div className="space-y-2">
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
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      {rightTab === 'notes' ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[14px] font-bold text-[#171717]">Service Notes</p>
            <textarea
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
              value="Baggage allowance and route timings are subject to operator confirmation. Soft product rules may apply on shared charters."
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
        </div>
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
                id: `custom-f${n}`,
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
