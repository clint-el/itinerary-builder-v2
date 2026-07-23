import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { EXTRAS_CATALOG, PROMOTIONS } from '@/shared/lib/catalogs'
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
import type { CatalogItem } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import { FLIGHT_SERVICES, asCustomExtras, asExtraIds, extraObjects } from './builderUtils'

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
  const totalCapacity = (Number(draft.capacity) || 1) * (Number(draft.qty) || 1)
  const eligible = totalPax > 0 && totalPax <= totalCapacity
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

  let eligibilityText = 'Set passenger counts below'
  let eligibilityBg = '#F3F4F6'
  let eligibilityBorder = '#E5E7EB'
  let eligibilityColor = '#525252'
  if (totalPax > 0) {
    if (eligible) {
      eligibilityText = `${totalPax} PAX — eligible within ${totalCapacity} seat capacity`
      eligibilityBg = '#D1FAE5'
      eligibilityBorder = '#A7F3D0'
      eligibilityColor = '#059669'
    } else {
      eligibilityText = `${totalPax} PAX exceeds ${totalCapacity} seats — increase quantity`
      eligibilityBg = '#FEE2E2'
      eligibilityBorder = '#FECACA'
      eligibilityColor = '#DC2626'
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            Flight details
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">Pick location, supplier and flight service</p>
        </div>
        <div className="mb-3 flex gap-2">
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
        <p className="mb-3 text-[12px] text-[#737373]">
          {isReturn
            ? 'Return trip — set outbound and return dates'
            : 'One-way — set the departure date'}
        </p>
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
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Depart</Label>
            <DatePickerGridInput
              value={String(draft.departDate || '')}
              onChange={(value) => patch({ departDate: value })}
              className="bg-white"
            />
          </div>
          {isReturn ? (
            <div className="grid gap-1.5">
              <Label>Return</Label>
              <DatePickerGridInput
                value={String(draft.returnDate || '')}
                onChange={(value) => patch({ returnDate: value })}
                referenceValue={String(draft.departDate || '')}
                className="bg-white"
              />
            </div>
          ) : (
            <div />
          )}
          <div className="grid gap-1.5">
            <Label>Capacity / aircraft</Label>
            <Input
              type="number"
              value={Number(draft.capacity) || 1}
              onChange={(e) => patch({ capacity: Number(e.target.value) || 1 })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Quantity</Label>
            <div className="flex h-9 items-center gap-1 rounded-md border px-1">
              <button
                type="button"
                className="px-2"
                onClick={() => patch({ qty: Math.max(1, (Number(draft.qty) || 1) - 1) })}
              >
                −
              </button>
              <span className="flex-1 text-center text-sm font-semibold">{Number(draft.qty) || 1}</span>
              <button
                type="button"
                className="px-2"
                onClick={() => patch({ qty: (Number(draft.qty) || 1) + 1 })}
              >
                +
              </button>
            </div>
            <p className="text-[11px] text-[#A1A1A1]">
              Suggested qty: {Math.max(1, Math.ceil(totalPax / (Number(draft.capacity) || 1)))}
            </p>
          </div>
        </div>
        <div
          className="mt-3 rounded-lg border px-3 py-2 text-[12.5px] font-semibold"
          style={{ background: eligibilityBg, borderColor: eligibilityBorder, color: eligibilityColor }}
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
        <textarea
          readOnly
          rows={4}
          className="w-full resize-none rounded-lg border bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
          value="Baggage allowance 15kg soft bags only. Infant under 2 years sits on lap. Charter seats are allocated on a first-come basis."
        />
      ) : null}

      {rightTab === 'extras' ? (
        <div className="space-y-3">
          {extras.map((ex) => (
            <div
              key={ex.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2"
            >
              <span className="text-[13px] font-semibold">{ex.title}</span>
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
          ))}
          {EXTRAS_CATALOG.filter((c) => !extraIds.includes(c.id)).map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => patch({ extras: [...extraIds, c.id] })}
              className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-[#F9FAFB]"
            >
              <span className="text-[13px] font-semibold">{c.title}</span>
              <span className="text-[12.5px] font-semibold text-[#525252]">{formatUsd(c.price)}</span>
            </button>
          ))}
          <Button
            variant="outline"
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
            <Plus className="size-4" />
            Custom extra
          </Button>
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
                  style={{ borderColor: sel ? '#931115' : '#D4D4D4' }}
                >
                  {sel ? <span className="size-2 rounded-full bg-[#931115]" /> : null}
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
