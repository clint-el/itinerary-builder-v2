import { useState } from 'react'
import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { extrasForTab } from '@/shared/lib/catalogs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import { UnassignedGuestsPool } from './UnassignedGuestsPool'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
import { SupplierPicker } from './SupplierPicker'
import {
  EmptyStateCard,
  FieldGroup,
  LineNotesTab,
  LineTabBar,
  SectionHeader,
  SpecialOffersList,
  SupplierServiceCard,
  addItemButtonClassName,
  brandOutlineActionClassName,
} from './panelParts'
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
type TransTab = 'guests' | 'policy' | 'extras' | 'promotions' | 'notes'

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
  const [transTab, setTransTab] = useState<TransTab>('guests')
  const [ceOpen, setCeOpen] = useState(false)
  const vehicles = asVehicles(draft)
  const used = usedGuestIds(vehicles)
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const serviceId = String(draft.serviceId || '')
  const service = String(draft.service || '').trim()
  const location = String(draft.location || '')
  const supplier = String(draft.supplier || '')
  const vehicleOptions = vehicleOptionsForService(serviceId)

  function setVehicles(next: Vehicle[]) {
    patch({ vehicles: next })
  }

  function updateVehicle(id: string, changes: Partial<Vehicle>) {
    setVehicles(vehicles.map((x) => (x.id === id ? { ...x, ...changes } : x)))
  }

  const unassigned = guests.filter((g) => !used.includes(g.id))

  function autoAssign() {
    setVehicles(autoAssignByCapacity(vehicles, guests, (v) => v.cap))
  }

  function moveGuestToVehicle(gid: number, vehicleId: string) {
    setVehicles(
      vehicles.map((x) => ({
        ...x,
        guestIds:
          x.id === vehicleId
            ? x.guestIds.includes(gid)
              ? x.guestIds
              : [...x.guestIds, gid]
            : x.guestIds.filter((id) => id !== gid),
      })),
    )
  }

  function unassignGuest(gid: number) {
    setVehicles(vehicles.map((x) => ({ ...x, guestIds: x.guestIds.filter((id) => id !== gid) })))
  }

  function addVehicle() {
    setVehicles([
      ...vehicles,
      {
        id: `v${Date.now()}`,
        type: '',
        cap: 0,
        rate: 0,
        guestIds: [],
        dateFrom: String(draft.transDate || draft.hireStart || ''),
        dateTo: String(draft.transDate || draft.hireEnd || draft.hireStart || ''),
      },
    ])
  }

  function duplicateVehicle(index: number) {
    const source = vehicles[index]
    if (!source) return
    const next = vehicles.slice()
    next.splice(index + 1, 0, { ...source, id: `v${Date.now()}`, guestIds: [] })
    setVehicles(next)
  }

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
            tab="transportation"
            value={supplier}
            disabled={!location}
            onPick={(item: CatalogItem) =>
              patch({ supplier: item.name, service: item.service, serviceId: item.id })
            }
          />
        }
        service={
          <Select
            value={service || undefined}
            disabled={!supplier}
            onValueChange={(value) => patch({ service: value })}
          >
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              {TRANS_SERVICES.map((s) => (
                <SelectItem key={s.title} value={s.title}>
                  <span className="flex w-full items-center justify-between gap-3">
                    <span>{s.title}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatUsd(s.price)} · {s.unit}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="flex flex-col gap-3">
        <LineTabBar
          value={transTab}
          onChange={setTransTab}
          tabs={[
            { key: 'guests', label: 'Guests' },
            { key: 'extras', label: 'Extras' },
            { key: 'promotions', label: 'Special Offer(s)' },
            { key: 'policy', label: 'Policy' },
            { key: 'notes', label: 'Notes' },
          ]}
        />

        {transTab === 'guests' ? (
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Vehicles & guests"
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={autoAssign}
                  disabled={vehicles.length === 0 || unassigned.length === 0}
                  className={cn('h-7 text-xs font-semibold', brandOutlineActionClassName)}
                >
                  <RefreshCw className="size-3.5" />
                  Auto-assign
                </Button>
              }
            />

            <UnassignedGuestsPool
              guests={guests}
              unassignedIds={unassigned.map((g) => g.id)}
              onUnassignDrop={unassignGuest}
              dragHint={
                vehicles.length > 0
                  ? 'Drag a guest onto a vehicle.'
                  : 'Add a vehicle to start assigning guests.'
              }
            />

            {vehicles.length === 0 ? (
              <EmptyStateCard>No vehicles yet — add one to start assigning guests.</EmptyStateCard>
            ) : null}

            {vehicles.map((v, i) => {
              const over = v.cap > 0 && v.guestIds.length > v.cap
              const option = vehicleOptions.find((t) => t.type === v.type)
              const datesInvalid = Boolean(v.dateFrom && v.dateTo && v.dateTo < v.dateFrom)
              return (
                <Card
                  key={v.id}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const gid = Number(e.dataTransfer.getData('text/plain'))
                    if (gid) moveGuestToVehicle(gid, v.id)
                  }}
                >
                  <CardContent className="flex flex-col gap-4 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-foreground">Vehicle {i + 1}</h4>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => duplicateVehicle(i)}
                          className={cn(
                            'h-[26px] gap-1 px-2.5 text-[11.5px] font-semibold',
                            brandOutlineActionClassName,
                          )}
                        >
                          <Copy className="size-3" />
                          Duplicate
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label="Remove vehicle"
                          onClick={() => setVehicles(vehicles.filter((x) => x.id !== v.id))}
                          className={cn('size-[26px]', brandOutlineActionClassName)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <FieldGroup
                      label="Vehicle type"
                      required
                      hint={
                        !service
                          ? 'Pick a service first'
                          : option
                            ? `Capacity: up to ${option.cap}`
                            : undefined
                      }
                      labelAddon={
                        option ? (
                          <OptionInclusions option={resolveServiceOption(serviceId, v.type)} />
                        ) : null
                      }
                    >
                      <Select
                        value={v.type || undefined}
                        disabled={!service || vehicleOptions.length === 0}
                        onValueChange={(value) => {
                          const found = vehicleOptions.find((t) => t.type === value)
                          updateVehicle(v.id, {
                            type: value,
                            cap: found ? found.cap : v.cap,
                            rate: found ? found.rate : v.rate,
                          })
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Select vehicle type" />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleOptions.map((t) => (
                            <SelectItem key={t.id} value={t.type}>
                              {t.type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FieldGroup>

                    <div className="grid grid-cols-2 gap-2">
                      <FieldGroup label="From" required>
                        <DatePickerGridInput
                          aria-label="From"
                          value={v.dateFrom || ''}
                          onChange={(value) =>
                            updateVehicle(v.id, {
                              dateFrom: value,
                              ...(v.dateTo && v.dateTo < value ? { dateTo: '' } : {}),
                            })
                          }
                        />
                      </FieldGroup>
                      <FieldGroup label="To">
                        <DatePickerGridInput
                          aria-label="To"
                          value={v.dateTo || ''}
                          referenceValue={v.dateFrom || undefined}
                          hasError={datesInvalid}
                          onChange={(value) => updateVehicle(v.id, { dateTo: value })}
                        />
                      </FieldGroup>
                    </div>

                    <div className="min-h-10">
                      {v.guestIds.length === 0 ? (
                        <span className="text-xs text-muted-foreground">
                          {guests.length === 0
                            ? 'No travellers on this itinerary yet.'
                            : 'Empty — pick a guest below or drag one here.'}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {v.guestIds.map((gid) => {
                            const g = findGuest(gid, guests)
                            if (!g) return null
                            const cs = guestChipStyle(g)
                            return (
                              <GuestChip
                                key={gid}
                                name={g.name}
                                meta={cs.meta}
                                lead={cs.lead}
                                resLabel={cs.resLabel}
                                draggable
                                onDragStart={(e) =>
                                  e.dataTransfer.setData('text/plain', String(gid))
                                }
                                onRemove={() => unassignGuest(gid)}
                              />
                            )
                          })}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Select
                          value={undefined}
                          disabled={unassigned.length === 0}
                          onValueChange={(value) => {
                            const gid = Number(value)
                            if (gid) moveGuestToVehicle(gid, v.id)
                          }}
                        >
                          <SelectTrigger
                            aria-label="Add guest to this vehicle"
                            className="h-8 w-auto min-w-[11rem] bg-background text-xs"
                          >
                            <SelectValue placeholder="+ Add guest to this vehicle" />
                          </SelectTrigger>
                          <SelectContent>
                            {unassigned.map((g) => (
                              <SelectItem key={g.id} value={String(g.id)}>
                                {g.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {unassigned.length > 0 ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs font-semibold text-primary"
                            onClick={() =>
                              updateVehicle(v.id, {
                                guestIds: [...v.guestIds, ...unassigned.map((g) => g.id)],
                              })
                            }
                          >
                            Add all remaining
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {over ? (
                      <p className="w-fit rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                        Assigned guests exceed the service capacity. You can still add.
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}

            <Button
              type="button"
              variant="outline"
              className={addItemButtonClassName}
              disabled={!service}
              onClick={addVehicle}
            >
              <Plus className="size-4" />
              Add vehicle
            </Button>
          </div>
        ) : null}

        {transTab === 'policy' ? (
          <CancellationPolicyControl
            tab="transportation"
            draft={draft}
            patch={patch}
            demoRole={demoRole}
            isDraftItinerary={isDraftItinerary}
          />
        ) : null}

        {transTab === 'extras' ? (
          <ExtrasTab
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
          <SpecialOffersList
            selectedId={(draft.promotion as string | null) ?? null}
            onSelect={(id) => patch({ promotion: id })}
          />
        ) : null}

        {transTab === 'notes' ? (
          <LineNotesTab
            serviceNotes="Rates include fuel and driver-guide. Vehicle capacity excludes driver."
            notes={String(draft.notes || '')}
            onNotesChange={(value) => patch({ notes: value })}
          />
        ) : null}
      </div>

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
