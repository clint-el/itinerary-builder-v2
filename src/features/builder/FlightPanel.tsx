import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { EXTRAS_CATALOG, PROMOTIONS } from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CatalogItem } from '@/shared/lib/types'
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

export function FlightPanel({
  draft,
  patch,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
}) {
  const [rightTab, setRightTab] = useState<FlightTab>('policy')
  const isReturn = draft.flightMode === 'return'
  const pax = (draft.pax || { adult: 0, youth: 0, child: 0, infant: 0 }) as Record<string, number>
  const rates = (draft.rates || {}) as Record<string, number>
  const totalPax = PAX_BANDS.reduce((s, b) => s + (pax[b.key] || 0), 0)
  const capacity = Math.max(1, Number(draft.capacity) || 1)
  const autoQty = flightAutoQty(draft)
  const totalCapacity = capacity * autoQty
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

  const qtyNote =
    totalPax === 0
      ? 'Add passengers to auto-calculate charters'
      : `${totalPax} PAX ÷ ${capacity} seats = ${autoQty} ${autoQty === 1 ? 'charter' : 'charters'}`

  let eligibilityText =
    totalPax === 0
      ? 'Set passenger counts below'
      : `${totalPax} PAX auto-assigned across ${autoQty} ${autoQty === 1 ? 'charter' : 'charters'} · ${totalCapacity} seats total`
  let eligibilityBg = totalPax === 0 ? '#F3F4F6' : '#D1FAE5'
  let eligibilityBorder = totalPax === 0 ? '#E5E7EB' : '#A7F3D0'
  let eligibilityColor = totalPax === 0 ? '#525252' : '#059669'

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">
            Supplier & flight details
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">Pick location, supplier and flight service</p>
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
              tab="flight"
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
                <SelectValue placeholder="Select…" />
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
          <div className="grid gap-1.5 sm:col-span-2">
            <Label>Trip type</Label>
            <div className="flex gap-2">
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
        <div className="mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">
            Travel dates
          </h3>
        </div>
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
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">
            Charter & capacity
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">
            Charters auto-calculated from passenger count
          </p>
        </div>
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Capacity / aircraft</Label>
            <Input
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => patch({ capacity: Math.max(1, Number(e.target.value) || 1) })}
              className="bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>
              Charters required <span className="font-medium text-[#A1A1A1]">(auto)</span>
            </Label>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-8 min-w-9 items-center justify-center rounded-lg bg-[#EFF6FF] px-2.5 text-[15px] font-bold text-[#1D4ED8] shadow-[inset_0_0_0_1px_#BFDBFE]">
                ×{autoQty}
              </span>
              <span className="text-[11.5px] text-[#94A3B8]">{qtyNote}</span>
            </div>
          </div>
        </div>
        <div
          className="rounded-lg px-3 py-2.5 text-[13px] font-bold"
          style={{
            background: eligibilityBg,
            boxShadow: `inset 0 0 0 1px ${eligibilityBorder}`,
            color: eligibilityColor,
          }}
        >
          {eligibilityText}
        </div>
      </section>

      <section className="rounded-xl border bg-white p-4">
        <h3 className="mb-3 text-[13px] font-bold uppercase tracking-wide text-[#475569]">
          Passengers & rates
        </h3>
        <div className="space-y-2">
          {PAX_BANDS.map((b) => (
            <div key={b.key} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
              <span className="w-16 text-[13px] font-semibold">{b.label}</span>
              <Input
                type="number"
                className="h-8 w-20"
                value={pax[b.key] || 0}
                onChange={(e) =>
                  patch({ pax: { ...pax, [b.key]: Number(e.target.value) || 0 } })
                }
              />
              <Input
                type="number"
                className="h-8 w-24"
                value={rates[b.key] || 0}
                onChange={(e) =>
                  patch({ rates: { ...rates, [b.key]: Number(e.target.value) || 0 } })
                }
              />
              <span className="text-[12px] text-[#737373]">
                rack {formatUsd(rackOf(rates[b.key] || 0))}
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex gap-1 border-b">
        {tabBtn('policy', 'Policy')}
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Promotions')}
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
