import { Copy, Plus, RefreshCw, Trash2 } from 'lucide-react'
import {
  BASIS,
  PROMOTIONS,
  extrasForTab,
  roomTypeCapacity,
  roomTypeId,
  roomTypeOptions,
} from '@/shared/lib/catalogs'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { payableEntityForCatalogItem } from '@/shared/lib/payableEntities'
import type { DemoRole, Guest, Hold, Room } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import {
  CustomExtraModal,
  GuestChip,
  HoldModal,
  HoldsList,
} from './BuilderModals'
import { CancellationPolicyControl } from './CancellationPolicyControl'
import { ExtrasTab } from './ExtrasTab'
import { LocationDropdown } from './LocationDropdown'
import { OptionInclusions } from './OptionInclusions'
import { SupplierPicker } from './SupplierPicker'
import { UnassignedGuestsPool } from './UnassignedGuestsPool'
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
import { resolveServiceOption, basisOptionsForService } from './serviceOptions'
import {
  asCustomExtras,
  asExtraIds,
  asRooms,
  extraObjects,
  findGuest,
  guestChipStyle,
  roomPriceBreakdown,
  usedGuestIds,
  autoAssignByCapacity,
} from './builderUtils'
import type { CatalogItem } from '@/shared/lib/types'
import { useState } from 'react'

type AccTab = 'policy' | 'guests' | 'extras' | 'promotions' | 'supplier' | 'notes'

const ASSIGNMENT_RULES = ['Up to 3 adults per room.', 'Up to 2 children may share with adults.']

/** Full-width divider under a row inside the padded room-card grid. */
const roomRowDividerClassName =
  "relative after:absolute after:-inset-x-2.5 after:bottom-0 after:border-b after:border-border after:content-['']"

export function AccommodationPanel({
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
  const [accTab, setAccTab] = useState<AccTab>('guests')
  const [holdOpen, setHoldOpen] = useState(false)
  const [ceOpen, setCeOpen] = useState(false)

  const rooms = asRooms(draft)
  const used = usedGuestIds(rooms)
  const unassigned = guests.filter((g) => !used.includes(g.id))
  const extras = extraObjects(draft)
  const extraIds = asExtraIds(draft)
  const customExtras = asCustomExtras(draft)
  const holds = (Array.isArray(draft.holds) ? draft.holds : []) as Hold[]
  const basis = String(draft.basis || 'bb') as keyof typeof BASIS
  const serviceId = String(draft.serviceId || '')
  const basisOptions = basisOptionsForService(serviceId)
  const basisOption = resolveServiceOption(serviceId, basis)
  const start = String(draft.start || '')
  const end = String(draft.end || '')
  const location = String(draft.location || '')
  const supplier = String(draft.supplier || '')

  function setRooms(next: Room[]) {
    const starts = next.map((r) => String(r.start || '').trim()).filter(Boolean).sort()
    const ends = next.map((r) => String(r.end || '').trim()).filter(Boolean).sort()
    patch({
      rooms: next,
      ...(starts[0] ? { start: starts[0] } : {}),
      ...(ends.length ? { end: ends[ends.length - 1] } : {}),
    })
  }

  function moveGuestToRoom(gid: number, targetRoomId: string) {
    setRooms(
      rooms.map((x) => ({
        ...x,
        guestIds:
          x.id === targetRoomId
            ? x.guestIds.includes(gid)
              ? x.guestIds
              : [...x.guestIds, gid]
            : x.guestIds.filter((id) => id !== gid),
      })),
    )
  }

  function unassignGuest(gid: number) {
    setRooms(rooms.map((x) => ({ ...x, guestIds: x.guestIds.filter((id) => id !== gid) })))
  }

  function addGuestToRoom(roomId: string, gid: number) {
    if (!gid) return
    moveGuestToRoom(gid, roomId)
  }

  function addAllRemainingToRoom(roomId: string) {
    if (!unassigned.length) return
    const ids = unassigned.map((g) => g.id)
    setRooms(
      rooms.map((x) =>
        x.id === roomId
          ? { ...x, guestIds: [...x.guestIds, ...ids.filter((id) => !x.guestIds.includes(id))] }
          : x,
      ),
    )
  }

  function duplicateRoom(index: number) {
    const source = rooms[index]
    if (!source) return
    const copy: Room = {
      ...source,
      id: `r${Date.now()}`,
      qty: 1,
      guestIds: [],
    }
    const next = rooms.slice()
    next.splice(index + 1, 0, copy)
    setRooms(next)
  }

  function autoAssignRooms() {
    setRooms(autoAssignByCapacity(rooms, guests, (x) => roomTypeCapacity(x.type)))
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
            clearSupplierOnPick
          />
        }
        supplier={
          <SupplierPicker
            tab="accommodation"
            value={supplier}
            disabled={!location}
            onPick={(item: CatalogItem) => {
              const entity = payableEntityForCatalogItem(item)
              patch({
                supplier: item.name,
                service: item.service,
                serviceId: item.id,
                payableEntityId: entity.id,
                payableEntityName: entity.legalName,
              })
            }}
          />
        }
      />

      <Card className="bg-muted/40 shadow-sm">
        <CardContent className="p-4">
          <FieldGroup
            label="Basis"
            required
            labelAddon={<OptionInclusions option={basisOption} />}
          >
            <Select
              value={basis}
              disabled={!supplier}
              onValueChange={(v) => {
                patch({ basis: v, rooms: rooms.map((x) => ({ ...x, basis: v })) })
              }}
            >
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Select basis" />
              </SelectTrigger>
              <SelectContent>
                {basisOptions.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldGroup>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        <LineTabBar
          value={accTab}
          onChange={setAccTab}
          tabs={[
            { key: 'guests', label: 'Guests' },
            { key: 'extras', label: 'Extras', count: extras.length },
            { key: 'promotions', label: 'Special Offer(s)', count: PROMOTIONS.length },
            { key: 'supplier', label: 'Holds' },
            { key: 'policy', label: 'Policy' },
            { key: 'notes', label: 'Notes' },
          ]}
        />

        {accTab === 'policy' ? (
          <CancellationPolicyControl
            tab="accommodation"
            draft={draft}
            patch={patch}
            demoRole={demoRole}
            isDraftItinerary={isDraftItinerary}
          />
        ) : null}

        {accTab === 'guests' ? (
          <div className="flex flex-col gap-3">
            <SectionHeader
              title="Rooms & guests"
              actions={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={autoAssignRooms}
                  disabled={rooms.length === 0 || unassigned.length === 0}
                  className={cn('h-7 text-xs font-semibold', brandOutlineActionClassName)}
                >
                  <RefreshCw className="size-3.5" />
                  Auto-assign
                </Button>
              }
            />

            <Card className="border-sky-200 bg-sky-50 shadow-none">
              <CardContent className="p-2.5">
                <p className="text-xs font-semibold text-sky-800">Guest Classification</p>
                <p className="text-[11px] leading-relaxed text-sky-800">
                  Adult: 18+ · Youth: 12–17 · Child: 3–11 · Infant: 0–2 years
                </p>
              </CardContent>
            </Card>

            <UnassignedGuestsPool
              guests={guests}
              unassignedIds={unassigned.map((g) => g.id)}
              onUnassignDrop={unassignGuest}
              emptyHint={
                rooms.length === 0
                  ? 'Add a room to start assigning guests.'
                  : 'Drag a guest here to unassign.'
              }
              dragHint={
                rooms.length === 0
                  ? 'Add a room to start assigning guests.'
                  : 'Drag a guest onto a room card.'
              }
            />

            {rooms.length === 0 ? (
              <EmptyStateCard compact>No rooms yet — add one to start assigning guests.</EmptyStateCard>
            ) : null}

            {rooms.map((room, i) => {
              const cap = roomTypeCapacity(room.type)
              const over = room.guestIds.length > cap
              const br = roomPriceBreakdown(room, start, end, guests)
              const roomUnassigned = unassigned
              return (
                <Card
                  key={room.id}
                  className="overflow-hidden rounded-[6px] shadow-none"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault()
                    const gid = Number(e.dataTransfer.getData('text/plain'))
                    if (gid) moveGuestToRoom(gid, room.id)
                  }}
                >
                  <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] gap-x-2 px-2.5">
                    <div
                      className={cn(
                        'col-span-5 grid grid-cols-subgrid items-center bg-muted/40 py-1.5',
                        roomRowDividerClassName,
                      )}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border bg-background text-[11px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <Select
                        value={roomTypeId(room.type)}
                        onValueChange={(value) =>
                          setRooms(rooms.map((x) => (x.id === room.id ? { ...x, type: value } : x)))
                        }
                      >
                        <SelectTrigger
                          aria-label="Room type"
                          className="h-7 min-w-0 rounded-[6px] bg-background text-xs font-semibold"
                        >
                          <SelectValue placeholder="Select room type" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomTypeOptions(room.type).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="col-span-3 flex items-center gap-1.5">
                        <span
                          className={cn(
                            'mr-auto whitespace-nowrap text-xs font-semibold',
                            over ? 'text-destructive' : 'text-green-600',
                          )}
                        >
                          {room.guestIds.length} / {cap} guests
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          title="Add another room of this type"
                          onClick={() => duplicateRoom(i)}
                          className="ml-auto h-[26px] gap-1 px-2.5 text-[11.5px] font-semibold text-[#931115] hover:text-[#931115]"
                        >
                          <Copy className="size-3" />
                          Duplicate
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          aria-label="Remove room"
                          onClick={() => setRooms(rooms.filter((x) => x.id !== room.id))}
                          className="size-[26px] text-[#931115] hover:text-[#931115]"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div
                      className={cn(
                        'col-span-5 grid grid-cols-subgrid items-center py-1.5',
                        roomRowDividerClassName,
                      )}
                    >
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Stay
                      </span>
                      <DatePickerGridInput
                        className="h-7 min-w-0 rounded-[6px] bg-background text-xs"
                        value={br.rStart}
                        onChange={(value) =>
                          setRooms(rooms.map((x) => (x.id === room.id ? { ...x, start: value } : x)))
                        }
                      />
                      <span className="text-[11px] font-semibold text-muted-foreground">→</span>
                      <DatePickerGridInput
                        className="h-7 min-w-0 rounded-[6px] bg-background text-xs"
                        value={br.rEnd}
                        onChange={(value) =>
                          setRooms(rooms.map((x) => (x.id === room.id ? { ...x, end: value } : x)))
                        }
                        referenceValue={br.rStart}
                      />
                      <span className="whitespace-nowrap text-[11px] font-semibold text-foreground">
                        {br.rNights} {br.rNights === 1 ? 'night' : 'nights'}
                      </span>
                    </div>
                  </div>

                  <div className="min-h-10 p-2.5">
                    {room.guestIds.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Empty — pick a guest below or drag one here.
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {room.guestIds.map((gid) => {
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
                              onDragStart={(e) => e.dataTransfer.setData('text/plain', String(gid))}
                              onRemove={() =>
                                setRooms(
                                  rooms.map((x) =>
                                    x.id === room.id
                                      ? { ...x, guestIds: x.guestIds.filter((id) => id !== gid) }
                                      : x,
                                  ),
                                )
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Select
                        value={undefined}
                        onValueChange={(value) => addGuestToRoom(room.id, Number(value))}
                        disabled={roomUnassigned.length === 0}
                      >
                        <SelectTrigger
                          aria-label="Add guest to this room"
                          className="h-8 w-auto min-w-[11rem] rounded-[6px] bg-background text-xs"
                        >
                          <SelectValue placeholder="+ Add guest to this room" />
                        </SelectTrigger>
                        <SelectContent>
                          {roomUnassigned.map((g) => (
                            <SelectItem key={g.id} value={String(g.id)}>
                              {g.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {roomUnassigned.length > 0 ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => addAllRemainingToRoom(room.id)}
                          className="h-7 text-xs font-semibold text-primary"
                        >
                          Add all remaining
                        </Button>
                      ) : null}
                    </div>

                    {over ? (
                      <p className="mt-2 w-fit rounded-md bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                        Assigned guests exceed the service capacity. You can still add.
                      </p>
                    ) : null}

                    <div className="mt-3 border-t border-border/60 pt-3">
                      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        Assignment Rules
                      </p>
                      <ul className="space-y-0.5 text-xs leading-relaxed text-muted-foreground">
                        {ASSIGNMENT_RULES.map((rule) => (
                          <li key={rule}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {br.priceRows.length > 0 ? (
                    <div className="border-t text-xs">
                      {br.priceRows.map((pr) => (
                        <div
                          key={pr.label}
                          className="grid grid-cols-[40px_1fr_80px_70px_70px] items-center px-2.5 py-1.5 text-foreground"
                        >
                          <span className="font-semibold">{pr.qty}</span>
                          <span>{pr.label}</span>
                          <span className="text-muted-foreground">Night</span>
                          <span className="text-right font-semibold">{formatUsd(pr.net)}</span>
                          <span className="text-right font-semibold">{formatUsd(pr.rack)}</span>
                        </div>
                      ))}
                      <div className="grid grid-cols-[1fr_auto] border-t bg-muted/40 px-2.5 py-1.5 font-bold text-foreground">
                        <span>Room total (Cost / Sell)</span>
                        <span>
                          {formatUsd(br.netTotal)} / {formatUsd(br.rackTotal)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </Card>
              )
            })}

            <Button
              type="button"
              variant="outline"
              className={addItemButtonClassName}
              disabled={!supplier}
              onClick={() =>
                setRooms([
                  ...rooms,
                  {
                    id: `r${Date.now()}`,
                    type: 'hemingways-double-suite',
                    basis: String(draft.basis || 'bb'),
                    rate: 150,
                    qty: 1,
                    guestIds: [],
                    start,
                    end,
                  },
                ])
              }
            >
              <Plus className="size-4" aria-hidden />
              Add room
            </Button>
          </div>
        ) : null}

        {accTab === 'extras' ? (
          <ExtrasTab
            selected={extras}
            catalog={extrasForTab('accommodation')}
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

        {accTab === 'promotions' ? (
          <SpecialOffersList
            selectedId={(draft.promotion as string | null) ?? null}
            onSelect={(id) => patch({ promotion: id })}
          />
        ) : null}

        {accTab === 'supplier' ? (
          <HoldsList
            holds={holds}
            onAdd={() => setHoldOpen(true)}
            onConfirm={(id) =>
              patch({
                holds: holds.map((h) => (h.id === id ? { ...h, status: 'Held' as const } : h)),
              })
            }
            onRelease={(id) =>
              patch({
                holds: holds.map((h) => (h.id === id ? { ...h, status: 'Released' as const } : h)),
              })
            }
          />
        ) : null}

        {accTab === 'notes' ? (
          <LineNotesTab
            serviceNotes="Must include Conservancy Fee as an extra. Families (5 pax or more) with children aged 5-12 years receive FOC exclusive use of vehicle."
            notes={String(draft.notes || '')}
            onNotesChange={(value) => patch({ notes: value })}
            placeholder="Anything the ops team should know about this stay…"
          />
        ) : null}
      </div>

      <HoldModal
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        defaultPrice={rooms.reduce(
          (s, r) => s + roomPriceBreakdown(r, start, end, guests).netTotal,
          0,
        )}
        onSubmit={(hold) =>
          patch({
            holds: [...holds, { ...hold, id: `h${Date.now()}` }],
          })
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
                id: `custom${n}`,
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
