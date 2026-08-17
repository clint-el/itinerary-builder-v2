import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  PROMOTIONS,
  extrasForActivityService,
  extrasForTab,
} from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityItem, CatalogItem, DemoRole, Guest, ServiceTab } from '@/shared/lib/types'
import { cn, formatDateRange, formatUsd } from '@/shared/lib/utils'
import { ActivityTypeModal, CustomExtraModal, GuestChip } from './BuilderModals'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
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
import {
  activityOptionsForService,
  otherOptionsForService,
  resolveServiceOption,
} from './serviceOptions'

type ActivitySideTab = 'policy' | 'extras' | 'promotions' | 'notes'

export function ActivityOtherPanel({
  tab,
  draft,
  patch,
  guests,
  demoRole,
  isDraftItinerary,
}: {
  tab: Extract<ServiceTab, 'activity' | 'other'>
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
  demoRole: DemoRole
  isDraftItinerary: boolean
}) {
  const [actOpen, setActOpen] = useState(false)
  const [ceOpen, setCeOpen] = useState(false)
  const [sideTab, setSideTab] = useState<ActivitySideTab>('extras')
  const activities = asActivities(draft)
  const used = usedGuestIds(activities)
  const itemLabel = tab === 'other' ? 'item' : 'activity'
  const isActivity = tab === 'activity'
  const serviceId = String(draft.serviceId || '')
  const typeCatalog = isActivity
    ? activityOptionsForService(serviceId)
    : otherOptionsForService(serviceId)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const catalogExtras = isActivity
    ? extrasForActivityService('', activities.map((a) => a.name))
    : extrasForTab('other')

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
              ? 'Pick the location and supplier for this activity'
              : 'Pick the location and supplier for this line item'}
          </p>
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
              tab={tab}
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) =>
                patch({ supplier: item.name, service: item.service, serviceId: item.id })
              }
            />
          </div>
        </div>
      </section>

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
            const typeOption = resolveServiceOption(serviceId, a.name)
            return (
              <div key={a.id} className="rounded-xl border bg-[#F9FAFB] p-3">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded border bg-white text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <Select
                    value={a.name || undefined}
                    onValueChange={(value) => {
                      const found = typeCatalog.find((t) => t.name === value)
                      setActivities(
                        activities.map((x) =>
                          x.id === a.id
                            ? { ...x, name: value, rate: found ? found.rate : x.rate }
                            : x,
                        ),
                      )
                    }}
                  >
                    <SelectTrigger className="h-7 min-w-[180px] flex-1 bg-white text-[12.5px] font-semibold">
                      <SelectValue placeholder={isActivity ? 'Activity type' : 'Other type'} />
                    </SelectTrigger>
                    <SelectContent>
                      {typeCatalog.map((t) => (
                        <SelectItem key={t.id} value={t.name}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="rounded-md bg-white px-2 py-1 text-[11px] font-semibold text-[#525252] shadow-sm">
                    {formatDateRange(
                      a.start || String(draft.startDate || ''),
                      a.end || String(draft.endDate || ''),
                    )}
                  </span>
                  <span className="text-[12px] font-semibold text-[#525252]">
                    {a.guestIds.length} PAX
                  </span>
                  <OptionInclusions option={typeOption} />
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

      <div className="flex gap-1 border-b">
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Special Offer(s)', PROMOTIONS.length)}
        {tabBtn('policy', 'Policy')}
        {tabBtn('notes', 'Notes')}
      </div>

      {sideTab === 'policy' ? (
        <CancellationPolicyControl
          tab={tab}
          draft={draft}
          patch={patch}
          demoRole={demoRole}
          isDraftItinerary={isDraftItinerary}
        />
      ) : null}

      {sideTab === 'extras' ? (
        <ExtrasTab
          selected={extras}
          catalog={catalogExtras}
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
          availableHint={
            isActivity
              ? activities.length
                ? 'Linked to selected activities'
                : 'Add an activity to filter linked extras'
              : undefined
          }
          emptyAvailableMessage={
            isActivity
              ? activities.length
                ? 'No more extras for these activities.'
                : 'Add an activity item to see linked extras (e.g. Lunch on Game Drive).'
              : 'No more extras available.'
          }
        />
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

      {sideTab === 'notes' ? (
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[14px] font-bold text-[#171717]">Service Notes</p>
            <textarea
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
              value={
                isActivity
                  ? 'Park fees and guide tips are typically excluded unless noted on the activity item. Shared vehicle seatings are subject to availability.'
                  : 'Miscellaneous line — confirm inclusions with the supplier before quoting.'
              }
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

      <ActivityTypeModal
        open={actOpen}
        onClose={() => setActOpen(false)}
        types={typeCatalog}
        defaultStart={String(draft.startDate || '')}
        defaultEnd={String(draft.endDate || '')}
        title={isActivity ? 'Add activity' : 'Add Other'}
        typeLabel={isActivity ? 'Activity type' : 'Other type'}
        submitLabel={isActivity ? 'Add activity' : 'Add Other'}
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

      <CustomExtraModal
        open={ceOpen}
        onClose={() => setCeOpen(false)}
        onSubmit={(extra) => {
          const n = Number(draft.customExtraSeq) || 1
          patch({
            customExtras: [
              ...customExtras,
              {
                id: `custom-${isActivity ? 'a' : 'o'}${n}`,
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
