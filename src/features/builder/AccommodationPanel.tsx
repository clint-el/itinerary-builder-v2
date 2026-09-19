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
import { Label } from '@/components/ui/label'
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

  const tabBtn = (key: AccTab, label: string, badge?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setAccTab(key)}
      className={cn(
        'h-9.5 border-b-2 px-3 text-[12.5px] font-semibold',
        accTab === key
          ? 'border-[#931115] text-[#931115]'
          : 'border-transparent text-[#525252]',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span
          className={cn(
            'ml-1 rounded px-1.5 text-[11px] font-semibold',
            accTab === key ? 'bg-[#DBEAFE] text-[#2563EB]' : 'bg-[#F3F4F6] text-[#525252]',
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
            Supplier & service
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">Pick location, supplier and service</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <LocationDropdown
              value={String(draft.location || '')}
              onChange={(name) =>
                patch({ location: name, supplier: '', service: '', serviceId: '' })
              }
              clearSupplierOnPick
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <SupplierPicker
              tab="accommodation"
              value={String(draft.supplier || '')}
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
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-0 grid gap-1.5">
          <div className="flex items-center gap-2">
            <Label>Basis</Label>
            <OptionInclusions option={basisOption} />
          </div>
          <Select
            value={basis}
            onValueChange={(v) => {
              patch({ basis: v, rooms: rooms.map((x) => ({ ...x, basis: v })) })
            }}
          >
            <SelectTrigger className="bg-white">
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
        </div>
      </section>

      <div className="flex gap-1 border-b">
        {tabBtn('guests', 'Guests')}
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Special Offer(s)', PROMOTIONS.length)}
        {tabBtn('supplier', 'Holds')}
        {tabBtn('policy', 'Policy')}
        {tabBtn('notes', 'Notes')}
      </div>

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
        <div className="space-y-3">
          <div className="mb-2.5 flex items-center justify-between gap-2.5">
            <span className="text-[13.5px] font-bold text-[#171717]">Rooms &amp; guests</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={autoAssignRooms}
              className="h-7 border-[#931115] text-xs font-semibold text-[#931115]"
            >
              <RefreshCw className="size-3.5" />
              Auto-assign
            </Button>
          </div>

          <div className="rounded-lg bg-[#E0F2FE] p-2.5">
            <p className="mb-1 text-[12px] font-semibold text-[#0369A1]">Guest Classification</p>
            <p className="text-[11px] leading-relaxed text-[#0369A1]">
              Adult: 18+ · Youth: 12–17 · Child: 3–11 · Infant: 0–2 years
            </p>
          </div>

          <div
            className="rounded-lg border p-3"
            style={{ background: unassigned.length ? '#FFFBEB' : '#F9FAFB' }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              const gid = Number(e.dataTransfer.getData('text/plain'))
              if (gid) unassignGuest(gid)
            }}
          >
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Unassigned guests {unassigned.length ? `(${unassigned.length})` : ''}
            </p>
            {unassigned.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {unassigned.map((g) => {
                  const cs = guestChipStyle(g)
                  return (
                    <GuestChip
                      key={g.id}
                      name={g.name}
                      meta={cs.meta}
                      lead={cs.lead}
                      resLabel={cs.resLabel}
                      resBg={cs.resBg}
                      resFg={cs.resFg}
                      bg={cs.bg}
                      bd={cs.bd}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(g.id))}
                    />
                  )
                })}
              </div>
            ) : (
              <div className="min-h-10 text-[12px] text-[#A1A1A1]">Drag a guest here to unassign.</div>
            )}
          </div>

          {rooms.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-center text-[12.5px] text-[#A1A1A1]">
              No rooms yet — add one to start assigning guests.
            </div>
          ) : null}

          {rooms.map((room, i) => {
            const cap = roomTypeCapacity(room.type)
            const over = room.guestIds.length > cap
            const br = roomPriceBreakdown(room, start, end, guests)
            return (
              <div
                key={room.id}
                className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const gid = Number(e.dataTransfer.getData('text/plain'))
                  if (gid) moveGuestToRoom(gid, room.id)
                }}
              >
                <div className="flex flex-wrap items-center gap-2 border-b border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1.5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] border border-[#E5E7EB] bg-white text-[11px] font-bold text-[#525252]">
                    {i + 1}
                  </span>
                  <Select
                    value={roomTypeId(room.type)}
                    onValueChange={(value) =>
                      setRooms(rooms.map((x) => (x.id === room.id ? { ...x, type: value } : x)))
                    }
                  >
                    <SelectTrigger className="h-7 min-w-0 flex-1 bg-white text-[12.5px] font-semibold">
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
                  <span
                    className="whitespace-nowrap text-[12px] font-semibold"
                    style={{ color: over ? '#DC2626' : '#16A34A' }}
                  >
                    {room.guestIds.length} / {cap} guests
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    title="Add another room of this type"
                    onClick={() => duplicateRoom(i)}
                    className="flex h-[26px] shrink-0 items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-2.5 text-[11.5px] font-semibold text-[#931115]"
                  >
                    <Copy className="size-3" />
                    Duplicate
                  </button>
                  <button
                    type="button"
                    title="Remove room"
                    onClick={() => setRooms(rooms.filter((x) => x.id !== room.id))}
                    className="flex size-[26px] shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-b border-[#F1F1F3] px-2.5 py-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                    Stay
                  </span>
                  <DatePickerGridInput
                    className="h-7 flex-1 bg-white text-xs"
                    value={br.rStart}
                    onChange={(value) =>
                      setRooms(
                        rooms.map((x) => (x.id === room.id ? { ...x, start: value } : x)),
                      )
                    }
                  />
                  <span className="text-[11px] font-semibold text-[#A1A1A1]">→</span>
                  <DatePickerGridInput
                    className="h-7 flex-1 bg-white text-xs"
                    value={br.rEnd}
                    onChange={(value) =>
                      setRooms(rooms.map((x) => (x.id === room.id ? { ...x, end: value } : x)))
                    }
                    referenceValue={br.rStart}
                  />
                  <span className="whitespace-nowrap text-[11px] font-semibold text-[#525252]">
                    {br.rNights} {br.rNights === 1 ? 'night' : 'nights'}
                  </span>
                </div>
                <div className="min-h-10 p-2.5">
                  {room.guestIds.length === 0 ? (
                    <span className="text-[12px] text-[#A1A1A1]">
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
                            resBg={cs.resBg}
                            resFg={cs.resFg}
                            bg={cs.bg}
                            bd={cs.bd}
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
                      disabled={unassigned.length === 0}
                    >
                      <SelectTrigger className="h-8 w-auto min-w-45 bg-white text-[12.5px]">
                        <SelectValue placeholder="+ Add guest to this room" />
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
                      <button
                        type="button"
                        onClick={() => addAllRemainingToRoom(room.id)}
                        className="flex h-7 items-center rounded-lg border border-[#E5E7EB] bg-white px-2.5 text-xs font-semibold text-[#931115]"
                      >
                        Add all remaining
                      </button>
                    ) : null}
                  </div>
                </div>
                {br.priceRows.length > 0 ? (
                  <div className="border-t border-[#F1F1F3] text-[12.5px]">
                    {br.priceRows.map((pr) => (
                      <div
                        key={pr.label}
                        className="grid grid-cols-[40px_1fr_80px_70px_70px] items-center px-2.5 py-1.5 text-[#171717]"
                      >
                        <span className="font-semibold">{pr.qty}</span>
                        <span>{pr.label}</span>
                        <span className="text-[#A1A1A1]">Night</span>
                        <span className="text-right font-semibold">{formatUsd(pr.net)}</span>
                        <span className="text-right font-semibold">{formatUsd(pr.rack)}</span>
                      </div>
                    ))}
                    <div className="grid grid-cols-[1fr_auto] border-t border-[#F1F1F3] bg-[#F9FAFB] px-2.5 py-1.5 font-bold text-[#171717]">
                      <span>Room total (Cost / Sell)</span>
                      <span>
                        {formatUsd(br.netTotal)} / {formatUsd(br.rackTotal)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}

          <Button
            variant="outline"
            className="h-9 w-full border-dashed border-[#C9CCD3] text-[#931115]"
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
            <Plus className="size-4" />
            Add room
          </Button>

          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-[#A1A1A1]">Assignment Rules</p>
            <textarea
              rows={2}
              readOnly
              value="Up to 3 adults per room. Up to 2 children may share with adults."
              className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[12.5px] text-[#A1A1A1] outline-none"
            />
          </div>
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
                  borderColor: sel ? '#2B7FFF' : '#E5E7EB',
                  background: sel ? '#EFF6FF' : '#FFFFFF',
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
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[14px] font-bold text-[#171717]">Service Notes</p>
            <textarea
              readOnly
              rows={3}
              className="w-full resize-none rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
              value="Must include Conservancy Fee as an extra. Families (5 pax or more) with children aged 5-12 years receive FOC exclusive use of vehicle."
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Internal notes</Label>
            <textarea
              rows={3}
              value={String(draft.notes || '')}
              onChange={(e) => patch({ notes: e.target.value })}
              className="w-full rounded-lg border p-2.5 text-[13px] outline-none"
              placeholder="Add notes…"
            />
          </div>
        </div>
      ) : null}

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
