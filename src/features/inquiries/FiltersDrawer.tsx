import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PAYMENT_META, STATUS_META } from '@/shared/lib/catalogs'
import { emptyFilters } from '@/shared/lib/helpers'
import type { ItineraryStatus, ListFilters, PaymentStatus } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'

interface Props {
  open: boolean
  filters: ListFilters
  agencies: string[]
  destinations: string[]
  liveCount: number
  onClose: () => void
  onDraftChange?: (filters: ListFilters) => void
  onApply: (filters: ListFilters) => void
}

export function FiltersDrawer({
  open,
  filters,
  agencies,
  destinations,
  liveCount,
  onClose,
  onDraftChange,
  onApply,
}: Props) {
  const [draft, setDraft] = useState<ListFilters>(filters)

  useEffect(() => {
    if (open) {
      setDraft(filters)
      onDraftChange?.(filters)
    }
  }, [open, filters, onDraftChange])

  function patch<K extends keyof ListFilters>(key: K, value: ListFilters[K]) {
    setDraft((d) => {
      const next = { ...d, [key]: value }
      onDraftChange?.(next)
      return next
    })
  }

  return (
    <>
      {open ? (
        <button
          type="button"
          aria-label="Close filters"
          className="fixed inset-0 z-[29] cursor-default bg-transparent"
          onClick={onClose}
        />
      ) : null}
      <div
        className={cn(
          'fixed bottom-0 right-0 top-14 z-30 flex w-[420px] max-w-[90vw] flex-col border-l border-[#E5E7EB] bg-white shadow-[-8px_0_24px_rgba(0,0,0,0.12)] transition-transform duration-250',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-5 py-2.5">
          <span className="text-sm font-bold text-[#171717]">Filters</span>
          <button
            type="button"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-md text-[#525252]"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          <section className="flex flex-col gap-2">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.4px] text-[#A1A1A1]">Itinerary</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Status</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('status', null)}
                  >
                    Clear
                  </button>
                </div>
                <Select
                  value={draft.status ?? '__all__'}
                  onValueChange={(value) =>
                    patch('status', value === '__all__' ? null : value as ItineraryStatus)
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {(Object.keys(STATUS_META) as ItineraryStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {STATUS_META[key].label}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Payment Status</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('payment', null)}
                  >
                    Clear
                  </button>
                </div>
                <Select
                  value={draft.payment ?? '__all__'}
                  onValueChange={(value) =>
                    patch('payment', value === '__all__' ? null : value as PaymentStatus)
                  }
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {(Object.keys(PAYMENT_META) as PaymentStatus[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {PAYMENT_META[key].label}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <div className="border-t border-[#E5E7EB]" />

          <section className="flex flex-col gap-2">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.4px] text-[#A1A1A1]">Parties</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Agency</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('agency', null)}
                  >
                    Clear
                  </button>
                </div>
                <Select
                  value={draft.agency ?? '__all__'}
                  onValueChange={(value) => patch('agency', value === '__all__' ? null : value)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {agencies.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Destination</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('destination', null)}
                  >
                    Clear
                  </button>
                </div>
                <Select
                  value={draft.destination ?? '__all__'}
                  onValueChange={(value) => patch('destination', value === '__all__' ? null : value)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                  <SelectItem value="__all__">All</SelectItem>
                  {destinations.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <div className="border-t border-[#E5E7EB]" />

          <section className="flex flex-col gap-2">
            <p className="m-0 text-[11px] font-bold uppercase tracking-[0.4px] text-[#A1A1A1]">Dates</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Travel Date From</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('dateFrom', '')}
                  >
                    Clear
                  </button>
                </div>
                <DatePickerGridInput
                  value={draft.dateFrom}
                  onChange={(value) => patch('dateFrom', value)}
                  className="bg-white"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Travel Date To</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('dateTo', '')}
                  >
                    Clear
                  </button>
                </div>
                <DatePickerGridInput
                  value={draft.dateTo}
                  onChange={(value) => patch('dateTo', value)}
                  referenceValue={draft.dateFrom}
                  className="bg-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Created On From</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('createdFrom', '')}
                  >
                    Clear
                  </button>
                </div>
                <DatePickerGridInput
                  value={draft.createdFrom}
                  onChange={(value) => patch('createdFrom', value)}
                  className="bg-white"
                />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label className="text-xs font-semibold text-[#171717]">Created On To</Label>
                  <button
                    type="button"
                    className="border-0 bg-transparent p-0 text-xs font-medium text-[#0369A1]"
                    onClick={() => patch('createdTo', '')}
                  >
                    Clear
                  </button>
                </div>
                <DatePickerGridInput
                  value={draft.createdTo}
                  onChange={(value) => patch('createdTo', value)}
                  referenceValue={draft.createdFrom}
                  className="bg-white"
                />
              </div>
            </div>
          </section>
        </div>

        <div className="shrink-0 border-t border-[#E5E7EB] bg-[#F9FAFB] px-5 py-3">
          <p className="mb-2.5 text-[13px] font-medium text-[#171717]">→ {liveCount} matching itineraries</p>
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                const empty = emptyFilters()
                setDraft(empty)
                onDraftChange?.(empty)
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              className="bg-[#931115] text-white hover:bg-[#7a0e11]"
              onClick={() => onApply(draft)}
            >
              Apply Filters
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
