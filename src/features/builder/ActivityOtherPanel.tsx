import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  ACTIVITY_TYPES,
  PROMOTIONS,
  extrasForActivityService,
} from '@/shared/lib/catalogs'
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
import { ActivityTypeModal, CustomExtraModal, GuestChip } from './BuilderModals'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import {
  asActivities,
  asCustomExtras,
  asExtraIds,
  extraObjects,
  findGuest,
  guestChipStyle,
  usedGuestIds,
} from './builderUtils'

type ActivitySideTab = 'extras' | 'promotions'

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
  const [ceOpen, setCeOpen] = useState(false)
  const [sideTab, setSideTab] = useState<ActivitySideTab>('extras')
  const activities = asActivities(draft)
  const used = usedGuestIds(activities)
  const itemLabel = tab === 'other' ? 'item' : 'activity'
  const isActivity = tab === 'activity'
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const catalogExtras = isActivity
    ? extrasForActivityService(
        String(draft.service || ''),
        activities.map((a) => a.name),
      )
    : []

  function setActivities(next: ActivityItem[]) {
    patch({ activities: next })
  }

  function addAllGuests(activityId: string) {
    const avail = guests.filter((g) => !used.includes(g.id)).map((g) => g.id)
    if (!avail.length) return
    setActivities(
      activities.map((x) =>
        x.id === activityId ? { ...x, guestIds: [...x.guestIds, ...avail] } : x,
      ),
    )
  }

  const tabBtn = (key: ActivitySideTab, label: string, badge?: number) => (
    <button
      type="button"
      onClick={() => setSideTab(key)}
      className={cn(
        'h-[38px] border-b-2 px-3 text-[13px] font-semibold',
        sideTab === key ? 'border-[#931115] text-[#931115]' : 'border-transparent text-[#525252]',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'ml-1 rounded px-1.5 text-[11px] font-semibold',
            sideTab === key ? 'bg-[#FCE7F3] text-[#DB2777]' : 'bg-[#F3F4F6] text-[#525252]',
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
                    <SelectItem key={t.name} value={t.name}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </div>
      </section>

      {tab === 'other' ? (
        <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
          <div className="mb-3">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">Dates</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
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
          </div>
        </section>
      ) : null}

      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            {tab === 'other' ? 'Items & PAX' : 'Activities & PAX'}
          </h3>
          <Button size="sm" variant="outline" onClick={() => setActOpen(true)}>
            <Plus className="size-3.5" />
            Add {itemLabel}
          </Button>
        </div>
        <div className="space-y-3">
          {activities.map((a, i) => {
            const avail = guests.filter((g) => !used.includes(g.id))
            const net = a.rate * a.guestIds.length
            const someToAdd = avail.length > 0
            const allAdded = guests.length > 0 && a.guestIds.length === guests.length
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
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#525252] shadow-sm">
                    {formatDateRange(
                      a.start || String(draft.startDate || ''),
                      a.end || String(draft.endDate || ''),
                    )}
                  </span>
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
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {someToAdd ? (
                    <button
                      type="button"
                      onClick={() => addAllGuests(a.id)}
                      className="h-7 rounded-lg border border-[#931115] bg-white px-2.5 text-[12px] font-semibold text-[#931115]"
                    >
                      Add all guests
                    </button>
                  ) : null}
                  {allAdded ? (
                    <span className="inline-flex h-7 items-center rounded-lg bg-[#ECFDF5] px-2.5 text-[12px] font-semibold text-[#059669]">
                      All guests added
                    </span>
                  ) : null}
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

      {isActivity ? (
        <>
          <div className="flex gap-1 border-b">
            {tabBtn('extras', 'Extras', extras.length)}
            {tabBtn('promotions', 'Special Offer(s)', PROMOTIONS.length)}
          </div>

          {sideTab === 'extras' ? (
            <div className="space-y-3">
              {extras.length === 0 ? (
                <p className="text-[12.5px] text-[#A1A1A1]">No extras selected.</p>
              ) : (
                extras.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-lg border bg-white px-3 py-2"
                  >
                    <div>
                      <div className="text-[13px] font-semibold">{ex.title}</div>
                      {ex.mandatory ? (
                        <div className="text-[11px] text-[#A1A1A1]">Mandatory</div>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold">
                        {formatUsd(ex.price * (ex.qty || 1))}
                      </span>
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
                          className="text-[#931115]"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <div>
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                  Catalog
                  {draft.service || activities.length
                    ? ' · linked to selected service'
                    : ' · select a service to filter'}
                </p>
                <div className="space-y-1.5">
                  {catalogExtras.filter((c) => !extraIds.includes(c.id)).length === 0 ? (
                    <p className="text-[12.5px] text-[#A1A1A1]">
                      {draft.service || activities.length
                        ? 'No more catalog extras for this service.'
                        : 'Select a Service or add an activity item to see linked extras (e.g. Lunch on Game Drive).'}
                    </p>
                  ) : (
                    catalogExtras
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
                      ))
                  )}
                </div>
              </div>
              <Button variant="outline" onClick={() => setCeOpen(true)}>
                <Plus className="size-4" />
                Custom extra
              </Button>
            </div>
          ) : null}

          {sideTab === 'promotions' ? (
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
                      borderColor: sel ? '#DB2777' : '#E5E7EB',
                      background: sel ? '#FDF2F8' : '#FFFFFF',
                    }}
                  >
                    <span
                      className="mt-1 flex size-4 items-center justify-center rounded-full border"
                      style={{ borderColor: sel ? '#DB2777' : '#D4D4D4' }}
                    >
                      {sel ? <span className="size-2 rounded-full bg-[#DB2777]" /> : null}
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
        </>
      ) : null}

      <section>
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

      {isActivity ? (
        <CustomExtraModal
          open={ceOpen}
          onClose={() => setCeOpen(false)}
          onSubmit={(extra) => {
            const n = Number(draft.customExtraSeq) || 1
            patch({
              customExtras: [
                ...customExtras,
                {
                  id: `custom-a${n}`,
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
      ) : null}
    </div>
  )
}
