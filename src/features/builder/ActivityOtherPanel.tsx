import { useState } from 'react'
import { Plus, RefreshCw, Trash2, Users } from 'lucide-react'
import { CATALOG, extrasForActivityService, extrasForTab } from '@/shared/lib/catalogs'
import { rackOf } from '@/shared/lib/helpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ActivityItem, CatalogItem, DemoRole, Guest, ServiceTab } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import { ActivityTypeModal, CustomExtraModal } from './BuilderModals'
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
  autoAssignByCapacity,
} from './builderUtils'
import {
  EmptyStateCard,
  FieldGroup,
  GuestBadge,
  ItemIndex,
  LineNotesTab,
  LineTabBar,
  PaxCount,
  SectionHeader,
  SpecialOffersList,
  SupplierServiceCard,
  brandOutlineActionClassName,
} from './panelParts'
import {
  activityOptionsForService,
  otherOptionsForService,
  resolveServiceOption,
} from './serviceOptions'

type ActivitySideTab = 'guests' | 'policy' | 'extras' | 'promotions' | 'notes'

const COPY = {
  activity: {
    typeLabel: 'Activity type',
    typePlaceholder: 'Select an activity type',
    sectionTitle: 'Activities & PAX',
    addLabel: 'Add activity',
    emptyWithType: 'Use Add activity to set dates for this type.',
    emptyWithService: 'Select an activity type, then add dated items below.',
    emptyNoService: 'Select a service, then choose an activity type.',
    serviceNotes:
      'Park fees and guide tips are typically excluded unless noted on the activity item.',
  },
  other: {
    typeLabel: 'Other type',
    typePlaceholder: 'Select a type',
    sectionTitle: 'Other items & PAX',
    addLabel: 'Add other',
    emptyWithType: 'Use Add other to set dates for this type.',
    emptyWithService: 'Select a type, then add dated items below.',
    emptyNoService: 'Select a service, then choose a type.',
    serviceNotes:
      'Park and conservation fees are typically collected locally. Confirm the latest published tariff before travel.',
  },
} as const

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
  const [sideTab, setSideTab] = useState<ActivitySideTab>('guests')
  const copy = COPY[tab]
  const activities = asActivities(draft)
  const used = usedGuestIds(activities)
  const isActivity = tab === 'activity'
  const location = String(draft.location || '')
  const supplier = String(draft.supplier || '')
  const serviceId = String(draft.serviceId || '')
  /** Activity / other type name; the catalog service itself is keyed by `serviceId`. */
  const service = String(draft.service || '')
  const supplierServices = CATALOG[tab].filter((c) => c.name === supplier)
  const typeCatalog = isActivity
    ? activityOptionsForService(serviceId)
    : otherOptionsForService(serviceId)
  const selectedType = typeCatalog.find((t) => t.name === service || t.id === service)
  const serviceOption = resolveServiceOption(serviceId, service)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const catalogExtras = isActivity
    ? extrasForActivityService(service, activities.map((a) => a.name))
    : extrasForTab('other')

  function setActivities(next: ActivityItem[]) {
    patch({ activities: next })
  }

  function updateActivity(id: string, changes: Partial<ActivityItem>) {
    setActivities(activities.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }

  function setServiceType(typeName: string) {
    const found = typeCatalog.find((t) => t.name === typeName)
    patch({
      service: typeName,
      activities: activities.map((a) => ({
        ...a,
        name: typeName,
        rate: found ? found.rate : a.rate,
      })),
    })
  }

  const unassigned = guests.filter((g) => !used.includes(g.id))

  function autoAssign() {
    if (!activities.length) return
    const perSlot = Math.max(1, Math.ceil(guests.length / activities.length))
    setActivities(autoAssignByCapacity(activities, guests, () => perSlot))
  }

  function moveGuestToActivity(gid: number, activityId: string) {
    setActivities(
      activities.map((x) => ({
        ...x,
        guestIds:
          x.id === activityId
            ? x.guestIds.includes(gid)
              ? x.guestIds
              : [...x.guestIds, gid]
            : x.guestIds.filter((id) => id !== gid),
      })),
    )
  }

  function unassignGuest(gid: number) {
    setActivities(activities.map((x) => ({ ...x, guestIds: x.guestIds.filter((id) => id !== gid) })))
  }

  function addAllGuests(activityId: string) {
    if (!unassigned.length) return
    updateActivity(activityId, {
      guestIds: [
        ...(activities.find((x) => x.id === activityId)?.guestIds ?? []),
        ...unassigned.map((g) => g.id),
      ],
    })
  }

  const tabs: { key: ActivitySideTab; label: string }[] = isActivity
    ? [
        { key: 'guests', label: 'Guests' },
        { key: 'extras', label: 'Extras' },
        { key: 'promotions', label: 'Special Offer(s)' },
        { key: 'policy', label: 'Policy' },
        { key: 'notes', label: 'Notes' },
      ]
    : [
        { key: 'guests', label: 'Guests' },
        { key: 'policy', label: 'Policy' },
        { key: 'notes', label: 'Notes' },
      ]

  return (
    <div className="flex flex-col gap-5">
      <SupplierServiceCard
        hasLocation={Boolean(location)}
        hasSupplier={Boolean(supplier)}
        location={
          <LocationDropdown
            value={location}
            onChange={(name) =>
              patch({ location: name, supplier: '', service: '', serviceId: '' })
            }
          />
        }
        supplier={
          <SupplierPicker
            tab={tab}
            value={supplier}
            disabled={!location}
            onPick={(item: CatalogItem) =>
              patch({ supplier: item.name, service: '', serviceId: item.id })
            }
          />
        }
        service={
          <Select
            value={serviceId || undefined}
            disabled={!supplier}
            onValueChange={(value) => patch({ serviceId: value, service: '' })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {supplierServices.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.service}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      >
        {serviceId ? (
          <FieldGroup
            label={copy.typeLabel}
            required
            labelAddon={<OptionInclusions option={serviceOption} />}
          >
            <Select
              value={service || undefined}
              disabled={typeCatalog.length === 0}
              onValueChange={setServiceType}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder={copy.typePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {typeCatalog.map((t) => (
                  <SelectItem key={t.id} value={t.name}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
        ) : null}
      </SupplierServiceCard>

      <div className="flex flex-col gap-3">
        <LineTabBar value={sideTab} onChange={setSideTab} tabs={tabs} />

        {sideTab === 'guests' ? (
          <div className="flex flex-col gap-3">
            <SectionHeader
              title={copy.sectionTitle}
              actions={
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={autoAssign}
                    disabled={activities.length === 0 || unassigned.length === 0}
                    className={cn('h-7 text-xs font-semibold', brandOutlineActionClassName)}
                  >
                    <RefreshCw className="size-3.5" />
                    Auto-assign
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!selectedType}
                    onClick={() => setActOpen(true)}
                  >
                    <Plus className="size-4" />
                    {selectedType ? copy.addLabel : 'Select a type first'}
                  </Button>
                </>
              }
            />

            {activities.length === 0 ? (
              <EmptyStateCard compact>
                {selectedType
                  ? copy.emptyWithType
                  : serviceId
                    ? copy.emptyWithService
                    : copy.emptyNoService}
              </EmptyStateCard>
            ) : null}

            {activities.map((a, i) => {
              const net = a.rate * a.guestIds.length
              const allAdded = guests.length > 0 && unassigned.length === 0
              const endInvalid = Boolean(a.start && a.end && a.end < a.start)
              return (
                <Card
                  key={a.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const gid = Number(e.dataTransfer.getData('text/plain'))
                    if (gid) moveGuestToActivity(gid, a.id)
                  }}
                >
                  <CardContent className="flex flex-col gap-3 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <ItemIndex n={i + 1} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                        {a.name || service}
                      </span>
                      <PaxCount assigned={a.guestIds.length} cap={null} />
                      <OptionInclusions option={serviceOption} />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove ${copy.addLabel.replace('Add ', '')}`}
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setActivities(activities.filter((x) => x.id !== a.id))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {isActivity ? (
                        <FieldGroup label="Date" required>
                          <DatePickerGridInput
                            aria-label="Date"
                            value={a.start || ''}
                            onChange={(value) => updateActivity(a.id, { start: value, end: value })}
                          />
                        </FieldGroup>
                      ) : (
                        <>
                          <FieldGroup label="Start date" required>
                            <DatePickerGridInput
                              aria-label="Start date"
                              value={a.start || ''}
                              onChange={(value) =>
                                updateActivity(a.id, {
                                  start: value,
                                  ...(a.end && a.end < value ? { end: '' } : {}),
                                })
                              }
                            />
                          </FieldGroup>
                          <FieldGroup label="End date">
                            <DatePickerGridInput
                              aria-label="End date"
                              value={a.end || ''}
                              referenceValue={a.start || undefined}
                              hasError={endInvalid}
                              onChange={(value) => updateActivity(a.id, { end: value })}
                            />
                          </FieldGroup>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {a.guestIds.map((gid) => {
                        const g = findGuest(gid, guests)
                        if (!g) return null
                        return (
                          <GuestBadge
                            key={gid}
                            label={g.name}
                            lead={guestChipStyle(g).lead}
                            onRemove={() => unassignGuest(gid)}
                          />
                        )
                      })}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {allAdded ? (
                        <Badge variant="secondary">All guests added</Badge>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={unassigned.length === 0}
                          onClick={() => addAllGuests(a.id)}
                        >
                          <Users className="size-4" />
                          Add all guests
                        </Button>
                      )}
                      <Select
                        value={undefined}
                        disabled={unassigned.length === 0}
                        onValueChange={(value) => {
                          const gid = Number(value)
                          if (gid) moveGuestToActivity(gid, a.id)
                        }}
                      >
                        <SelectTrigger
                          aria-label="Add guest"
                          className="h-8 w-auto min-w-[8rem] bg-background text-xs"
                        >
                          <SelectValue placeholder="+ Add guest" />
                        </SelectTrigger>
                        <SelectContent>
                          {unassigned.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex justify-between border-t pt-2 text-xs font-semibold text-foreground">
                      <span>Total</span>
                      <span>
                        {formatUsd(net)} / {formatUsd(rackOf(net))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : null}

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
              activities.length
                ? 'Linked to selected activities'
                : 'Add an activity to filter linked extras'
            }
            emptyAvailableMessage={
              !selectedType
                ? 'Select an activity type to see its eligible extras.'
                : activities.length
                  ? 'No more extras available'
                  : 'Add an activity item to see extras linked to this type.'
            }
          />
        ) : null}

        {sideTab === 'promotions' ? (
          <SpecialOffersList
            selectedId={(draft.promotion as string | null) ?? null}
            onSelect={(id) => patch({ promotion: id })}
          />
        ) : null}

        {sideTab === 'notes' ? (
          <LineNotesTab
            serviceNotes={copy.serviceNotes}
            notes={String(draft.notes || '')}
            onNotesChange={(value) => patch({ notes: value })}
          />
        ) : null}
      </div>

      <ActivityTypeModal
        open={actOpen}
        onClose={() => setActOpen(false)}
        types={typeCatalog}
        lockedType={selectedType}
        singleDate={isActivity}
        defaultStart={String(draft.startDate || '')}
        defaultEnd={String(draft.endDate || '')}
        title={isActivity ? 'Add activity' : 'Add other'}
        typeLabel={copy.typeLabel}
        submitLabel={isActivity ? 'Add activity' : 'Add other'}
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
