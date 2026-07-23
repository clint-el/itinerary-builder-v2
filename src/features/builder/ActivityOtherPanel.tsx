import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { ACTIVITY_TYPES } from '@/shared/lib/catalogs'
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
import type { ActivityItem, CatalogItem, Guest, ServiceTab } from '@/shared/lib/types'
import { cn, formatDateRange, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { ActivityTypeModal, GuestChip } from './BuilderModals'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import { asActivities, findGuest, guestChipStyle, usedGuestIds } from './builderUtils'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function ActivityOtherPanel({
  tab,
  draft,
  patch,
  guests,
}: {
  tab: Extract<ServiceTab, 'activity' | 'other'>
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
}) {
  const [actOpen, setActOpen] = useState(false)
  const activities = asActivities(draft)
  const used = usedGuestIds(activities)
  const days = (Array.isArray(draft.days) ? draft.days : []) as string[]

  function setActivities(next: ActivityItem[]) {
    patch({ activities: next })
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            {tab === 'activity' ? 'Activity details' : 'Other line item'}
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">
            {tab === 'activity'
              ? 'Pick the location, supplier and the activity service'
              : 'Pick the location and supplier for this line item'}
          </p>
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
              tab={tab}
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) => patch({ supplier: item.name, service: item.service })}
            />
          </div>
          {tab === 'activity' ? (
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
                {ACTIVITY_TYPES.map((t) => (
                  <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid gap-1.5 sm:col-span-2">
              <Label>Description</Label>
              <Input
                value={String(draft.description || '')}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </div>
          )}
          <div className="grid gap-1.5">
            <Label>Start</Label>
            <DatePickerGridInput
              value={String(draft.startDate || '')}
              onChange={(value) => patch({ startDate: value })}
              className="bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>End</Label>
            <DatePickerGridInput
              value={String(draft.endDate || '')}
              onChange={(value) => patch({ endDate: value })}
              referenceValue={String(draft.startDate || '')}
              className="bg-white"
            />
          </div>
          {tab === 'other' ? (
            <>
              <div className="grid gap-1.5">
                <Label>Qty</Label>
                <Input
                  type="number"
                  value={Number(draft.qty) || 1}
                  onChange={(e) => patch({ qty: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Unit price</Label>
                <Input
                  type="number"
                  value={Number(draft.price) || 0}
                  onChange={(e) => patch({ price: Number(e.target.value) || 0 })}
                />
              </div>
            </>
          ) : null}
        </div>

        {tab === 'activity' ? (
          <div className="mt-3">
            <Label className="mb-2 block">Days of week</Label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS.map((day) => {
                const on = days.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() =>
                      patch({
                        days: on ? days.filter((x) => x !== day) : [...days, day],
                      })
                    }
                    className={cn(
                      'h-7 w-[38px] rounded-md border text-[11.5px] font-semibold',
                      on
                        ? 'border-[#DB2777] bg-[#FCE7F3] text-[#DB2777]'
                        : 'border-[#E5E7EB] bg-white text-[#525252]',
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            Activities
          </h3>
          <Button size="sm" variant="outline" onClick={() => setActOpen(true)}>
            <Plus className="size-3.5" />
            Add activity
          </Button>
        </div>
        <div className="space-y-3">
          {activities.map((a, i) => {
            const avail = guests.filter((g) => !used.includes(g.id))
            const net = a.rate * a.guestIds.length
            return (
              <div key={a.id} className="rounded-xl border bg-[#F9FAFB] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded border bg-white text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <Input
                    className="h-7 flex-1 text-[12.5px] font-semibold"
                    value={a.name}
                    onChange={(e) =>
                      setActivities(
                        activities.map((x) => (x.id === a.id ? { ...x, name: e.target.value } : x)),
                      )
                    }
                  />
                  <Input
                    type="number"
                    className="h-7 w-24 text-xs"
                    value={a.rate}
                    onChange={(e) =>
                      setActivities(
                        activities.map((x) =>
                          x.id === a.id ? { ...x, rate: Number(e.target.value) || 0 } : x,
                        ),
                      )
                    }
                  />
                  <span className="text-[12px] font-semibold text-[#525252]">
                    {a.guestIds.length} PAX
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivities(activities.filter((x) => x.id !== a.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div
                  className="mb-2 text-[12px]"
                  style={{ color: a.start || draft.startDate ? '#171717' : '#A1A1A1' }}
                >
                  {formatDateRange(
                    a.start || String(draft.startDate || ''),
                    a.end || String(draft.endDate || ''),
                  )}
                </div>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {a.guestIds.map((gid) => {
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
                          setActivities(
                            activities.map((x) =>
                              x.id === a.id
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
                    setActivities(
                      activities.map((x) =>
                        x.id === a.id ? { ...x, guestIds: [...x.guestIds, gid] } : x,
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
                <div className="mt-2 flex justify-between text-[12px] font-semibold">
                  <span>Total</span>
                  <span>
                    {formatUsd(net)} / {formatUsd(rackOf(net))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <ActivityTypeModal
        open={actOpen}
        onClose={() => setActOpen(false)}
        types={ACTIVITY_TYPES}
        defaultStart={String(draft.startDate || '')}
        defaultEnd={String(draft.endDate || '')}
        onSubmit={(payload) =>
          setActivities([
            ...activities,
            {
              id: `a${Date.now()}`,
              name: payload.name,
              rate: payload.rate,
              start: payload.start,
              end: payload.end,
              guestIds: [],
            },
          ])
        }
      />
    </div>
  )
}
