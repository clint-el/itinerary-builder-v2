import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Clock3, Info, Plus, Search, Trash2, UsersRound } from 'lucide-react'
import { PROMOTIONS, extrasForTab } from '@/shared/lib/catalogs'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogItem, Guest } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import { FLIGHT_SERVICES, asCustomExtras, asExtraIds, extraObjects, flightAutoQty } from './builderUtils'

type FlightTab = 'policy' | 'extras' | 'promotions'
const PAX_BANDS: { key: 'adult' | 'youth' | 'child' | 'infant'; label: string }[] = [
  { key: 'adult', label: 'Adult' },
  { key: 'youth', label: 'Youth' },
  { key: 'child', label: 'Child' },
  { key: 'infant', label: 'Infant' },
]
const FLIGHT_TIMES = [
  '7:15 AM → 8:30 AM',
  '10:30 AM → 11:45 AM',
  '1:00 PM → 2:20 PM',
  '3:45 PM → 5:00 PM',
]

function PanelHeading({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Search
  title: string
  description: string
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-[#E8EEF3] text-[#64748B]">
        <Icon className="size-3.5" />
      </span>
      <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">{title}</h3>
      <span className="text-[11.5px] text-[#A7AFBA]">{description}</span>
    </div>
  )
}

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
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests?: Guest[]
}) {
  const [rightTab, setRightTab] = useState<FlightTab>('extras')
  const isReturn = draft.flightMode === 'return'
  const partyPax = useMemo(() => {
    const next = { adult: 0, youth: 0, child: 0, infant: 0 }
    for (const guest of guests) {
      if (guest.type in next) next[guest.type] += 1
    }
    return next
  }, [guests])
  const totalPax = PAX_BANDS.reduce((s, b) => s + (partyPax[b.key] || 0), 0)
  const capMin = Math.max(1, Number(draft.capMin) || Number(draft.minSeats) || 2)
  const capMax = Math.max(1, Number(draft.capMax) || Number(draft.capacity) || 5)
  const overflowMode = draft.overflowMode === 'squeeze' ? 'squeeze' : 'split'
  const capacityDraft = { ...draft, pax: partyPax, capacity: capMax, capMax, overflowMode }
  const autoQty = flightAutoQty(capacityDraft)
  const totalCapacity = capMax * autoQty
  const isOverCapacity = totalPax > capMax
  const excessPax = Math.max(0, totalPax - capMax)
  const squeeze = overflowMode === 'squeeze'
  const eligible = totalPax > 0 && totalPax <= totalCapacity
  const partySummary = PAX_BANDS
    .filter((band) => (partyPax[band.key] || 0) > 0)
    .map((band) => `${partyPax[band.key]} ${band.label}`)
    .join(' · ')
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)

  useEffect(() => {
    const current = (draft.pax || {}) as Record<string, number>
    const changed =
      PAX_BANDS.some((band) => (current[band.key] || 0) !== partyPax[band.key]) ||
      Number(draft.capacity) !== capMax ||
      Number(draft.capMax) !== capMax ||
      Number(draft.capMin) !== capMin
    if (changed) patch({ pax: partyPax, capacity: capMax, capMin, capMax })
  }, [partyPax, capMax, capMin, draft.pax, draft.capacity, draft.capMax, draft.capMin, patch])

  const eligibilityText =
    totalPax === 0
      ? 'Set passenger counts below'
      : isOverCapacity && squeeze
        ? `${totalPax} PAX seated on 1 flight — ${excessPax} over the ${capMax}-seat maximum, subject to supplier approval`
        : `${totalPax} PAX · ${autoQty} ${autoQty === 1 ? 'flight' : 'flights'} · ${totalCapacity} seats available${
            totalPax < capMin ? ` · below the ${capMin}-seat minimum, inducement fee may apply` : ''
          }`
  const eligibilityBg =
    totalPax === 0 ? '#F3F4F6' : eligible ? '#D1FAE5' : squeeze ? '#FFFBEB' : '#FEE2E2'
  const eligibilityBorder =
    totalPax === 0 ? '#E5E7EB' : eligible ? '#A7F3D0' : squeeze ? '#FDE68A' : '#FECACA'
  const eligibilityColor =
    totalPax === 0 ? '#525252' : eligible ? '#059669' : squeeze ? '#B45309' : '#DC2626'

  const modeBtn = (on: boolean) =>
    cn(
      'h-[30px] rounded-[7px] border px-3.5 text-[12.5px] font-semibold',
      on
        ? 'border-[#931115] bg-[#FBEBEC] text-[#931115]'
        : 'border-[#E5E7EB] bg-white text-[#525252]',
    )

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
        <span className="ml-1 rounded bg-[#F3F4F6] px-1.5 text-[11px] font-semibold">{badge}</span>
      ) : null}
    </button>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <PanelHeading
          icon={Search}
          title="Supplier & flight details"
          description="Pick the location, supplier, aircraft capacity and charter quantity"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>1. Location</Label>
            <LocationDropdown
              value={String(draft.location || draft.flightFrom || '')}
              onChange={(name) =>
                patch({ location: name, flightFrom: name, flightTo: '', supplier: '', service: '' })
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label>2. Supplier</Label>
            <SupplierPicker
              tab="flight"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) =>
                patch({
                  supplier: item.name,
                  ...routePatch(item.service, String(draft.location || draft.flightFrom || '')),
                })
              }
            />
          </div>
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>3. Service</Label>
            <Select
              value={String(draft.service || '') || undefined}
              onValueChange={(value) =>
                patch(routePatch(value, String(draft.location || draft.flightFrom || '')))
              }
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
          <div className="flex items-center gap-2 sm:col-span-2">
            <Label className="mr-1">Trip type</Label>
            <div className="flex gap-1.5">
              <button
                type="button"
                className={modeBtn(!isReturn)}
                onClick={() => patch({ flightMode: 'oneway' })}
              >
                One-way
              </button>
              <button
                type="button"
                className={modeBtn(isReturn)}
                onClick={() => patch({ flightMode: 'return' })}
              >
                Return
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <PanelHeading
          icon={CalendarDays}
          title="Travel dates"
          description={isReturn ? 'Return — set the departure and return dates' : 'One-way — set the departure date'}
        />
        <div className="flex flex-wrap gap-3">
          <div className="grid w-[170px] gap-1.5">
            <Label>Departure date</Label>
            <DatePickerGridInput
              value={String(draft.departDate || '')}
              onChange={(value) => patch({ departDate: value })}
              className="bg-white"
            />
          </div>
          {isReturn ? (
            <div className="grid w-[170px] gap-1.5">
              <Label>Return date</Label>
              <DatePickerGridInput
                value={String(draft.returnDate || '')}
                onChange={(value) => patch({ returnDate: value })}
                referenceValue={String(draft.departDate || '')}
                className="bg-white"
              />
            </div>
          ) : null}
        </div>
        <div className="my-3.5 h-px bg-[#E2E8F0]" />
        <PanelHeading icon={Clock3} title="Flight timing" description="" />
        <div className="mb-1 text-[11.5px] font-semibold text-[#64748B]">
          Outbound <span className="font-normal text-[#94A3B8]">(Departure time → Arrival time)</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FLIGHT_TIMES.map((time) => {
            const selected = draft.departTime === time
            return (
              <button
                key={time}
                type="button"
                onClick={() => patch({ departTime: selected ? '' : time })}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-lg border bg-white px-2.5 text-[12.5px] font-semibold text-[#334155]',
                  selected ? 'border-[#931115] ring-1 ring-[#931115]/15' : 'border-[#E2E8F0]',
                )}
              >
                <span
                  className={cn(
                    'flex size-4 items-center justify-center rounded border',
                    selected ? 'border-[#931115] bg-[#931115] text-white' : 'border-[#CBD5E1] bg-white',
                  )}
                >
                  {selected ? <Check className="size-3" /> : null}
                </span>
                {time}
              </button>
            )
          })}
        </div>
        {isReturn ? (
          <>
            <div className="mb-1 mt-3 text-[11.5px] font-semibold text-[#64748B]">
              Return <span className="font-normal text-[#94A3B8]">(Departure time → Arrival time)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FLIGHT_TIMES.map((time) => {
                const selected = draft.returnTime === time
                return (
                  <button
                    key={time}
                    type="button"
                    onClick={() => patch({ returnTime: selected ? '' : time })}
                    className={cn(
                      'flex h-9 items-center gap-2 rounded-lg border bg-white px-2.5 text-[12.5px] font-semibold text-[#334155]',
                      selected ? 'border-[#931115] ring-1 ring-[#931115]/15' : 'border-[#E2E8F0]',
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-4 items-center justify-center rounded border',
                        selected ? 'border-[#931115] bg-[#931115] text-white' : 'border-[#CBD5E1] bg-white',
                      )}
                    >
                      {selected ? <Check className="size-3" /> : null}
                    </span>
                    {time}
                  </button>
                )
              })}
            </div>
          </>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <PanelHeading icon={UsersRound} title="Charter & capacity" description="Capacity is set by the supplier" />
        <div className="mb-3 flex flex-wrap gap-2.5">
          <span className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-[#F1F5F9] px-3 shadow-[inset_0_0_0_1px_#E2E8F0]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Min seats</span>
            <span className="text-[15px] font-bold text-[#334155]">{capMin}</span>
          </span>
          <span className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-[#F1F5F9] px-3 shadow-[inset_0_0_0_1px_#E2E8F0]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">Max seats</span>
            <span className="text-[15px] font-bold text-[#334155]">{capMax}</span>
          </span>
          <span className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-white px-3 shadow-[inset_0_0_0_1px_#E2E8F0]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">PAX</span>
            <span className="text-[15px] font-bold text-[#334155]">{totalPax}</span>
          </span>
          <span className="inline-flex h-[38px] items-center gap-2 rounded-lg bg-[#EFF6FF] px-3 shadow-[inset_0_0_0_1px_#BFDBFE]">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#60A5FA]">Flights</span>
            <span className="text-[15px] font-bold text-[#1D4ED8]">×{autoQty}</span>
          </span>
        </div>
        <p className="mb-3 text-[11.5px] text-[#94A3B8]">
          PAX from the itinerary party — {partySummary || 'no guests'}
        </p>
        {isOverCapacity ? (
          <div className="mb-2.5 rounded-lg bg-[#FFFBEB] p-[11px_12px] shadow-[inset_0_0_0_1px_#FDE68A]">
            <div className="mb-2.5 flex items-start gap-2.5">
              <AlertTriangle className="mt-px size-4 shrink-0 text-[#B45309]" />
              <div>
                <p className="text-[13px] font-bold text-[#92400E]">
                  {totalPax} PAX exceeds the {capMax}-seat maximum by {excessPax}
                </p>
                <p className="mt-[3px] text-xs text-[#B45309]">Choose how to seat the remaining passengers.</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    mode: 'split' as const,
                    on: !squeeze,
                    label: 'Add another flight',
                    note: `${Math.ceil(totalPax / capMax)} flights · ${excessPax} PAX move to the next departure`,
                  },
                  {
                    mode: 'squeeze' as const,
                    on: squeeze,
                    label: 'Seat all PAX on this flight',
                    note: `Over capacity by ${excessPax} — supplier approval required`,
                  },
                ] as const
              ).map((choice) => (
                <button
                  key={choice.mode}
                  type="button"
                  onClick={() => patch({ overflowMode: choice.mode })}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left"
                  style={{
                    background: choice.on ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                    boxShadow: `inset 0 0 0 ${choice.on ? '1.5px #931115' : '1px #FDE68A'}`,
                  }}
                >
                  <span
                    className="mt-px flex size-[17px] shrink-0 items-center justify-center rounded"
                    style={{
                      background: choice.on ? '#931115' : '#FFFFFF',
                      boxShadow: `inset 0 0 0 ${choice.on ? '1px #931115' : '1.5px #CBD5E1'}`,
                    }}
                  >
                    {choice.on ? <Check className="size-[11px] text-white" strokeWidth={3.5} /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold text-[#171717]">{choice.label}</span>
                    <span className="mt-0.5 block text-[11.5px] text-[#94A3B8]">{choice.note}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div
          className="flex items-start gap-2.5 rounded-lg px-3 py-2.5"
          style={{
            background: eligibilityBg,
            boxShadow: `inset 0 0 0 1px ${eligibilityBorder}`,
          }}
        >
          <Info className="mt-px size-4 shrink-0" style={{ color: eligibilityColor }} />
          <span className="text-[13px] font-bold" style={{ color: eligibilityColor }}>
            {eligibilityText}
          </span>
        </div>
      </section>

      <div className="flex gap-1 border-b">
        {tabBtn('policy', 'Policy')}
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Special Offer(s)')}
      </div>

      {rightTab === 'policy' ? (
        <div>
          <div className="mb-2 text-[14px] font-semibold text-[#171717]">Policy Information</div>
          <div className="flex flex-col gap-1.5 rounded-lg bg-[#EFF6FF] p-3 shadow-[inset_0_0_0_1px_#BFDBFE]">
            <p className="flex gap-2 text-[12.5px] leading-relaxed text-[#171717]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#2563EB]" />
              <span>
                <b>Inducement fees</b> apply below the operator&apos;s minimum load factor.
              </span>
            </p>
            <p className="flex gap-2 text-[12.5px] leading-relaxed text-[#171717]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#2563EB]" />
              <span>
                <b>Seat requirements:</b> infants under 2 may travel on an adult&apos;s lap; all
                other PAX need a full seat.
              </span>
            </p>
            <p className="flex gap-2 text-[12.5px] leading-relaxed text-[#171717]">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#2563EB]" />
              <span>
                <b>Baggage:</b> soft bags only — 15kg checked + 5kg hand baggage per PAX.
              </span>
            </p>
          </div>
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
                    { id: `custom-f${n}`, title: 'Custom extra', price: 0, custom: true },
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
          {extrasForTab('flight')
            .filter((c) => !extraIds.includes(c.id))
            .map((c) => (
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
    </div>
  )
}
