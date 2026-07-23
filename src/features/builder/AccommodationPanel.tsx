import { Plus, Trash2 } from 'lucide-react'
import {
  BASIS,
  BASIS_DETAILS,
  BASIS_OPTIONS,
  EXTRAS_CATALOG,
  PROMOTIONS,
  ROOM_CAP,
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
import type { Guest, Hold, Room } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import {
  CustomExtraModal,
  GuestChip,
  HoldModal,
  HoldsList,
} from './BuilderModals'
import { LocationDropdown } from './LocationDropdown'
import { SupplierPicker } from './SupplierPicker'
import {
  asCustomExtras,
  asExtraIds,
  asRooms,
  extraObjects,
  findGuest,
  guestChipStyle,
  roomPriceBreakdown,
  usedGuestIds,
} from './builderUtils'
import type { CatalogItem } from '@/shared/lib/types'
import { useState } from 'react'

type AccTab = 'guests' | 'extras' | 'promotions' | 'supplier' | 'notes'

export function AccommodationPanel({
  draft,
  patch,
  guests,
}: {
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  guests: Guest[]
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
  const details = BASIS_DETAILS[basis]
  const start = String(draft.start || '')
  const end = String(draft.end || '')
  const overrideCount = rooms.filter(
    (r) => (r.start && r.start !== start) || (r.end && r.end !== end),
  ).length

  function setRooms(next: Room[]) {
    patch({ rooms: next })
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

  const tabBtn = (key: AccTab, label: string, badge?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => setAccTab(key)}
      className={cn(
        'h-[38px] border-b-2 px-3 text-[12.5px] font-semibold',
        accTab === key
          ? 'border-[#931115] text-[#931115]'
          : 'border-transparent text-[#525252]',
      )}
    >
      {label}
      {badge != null && badge > 0 ? (
        <span className="ml-1 rounded bg-[#F3F4F6] px-1.5 text-[11px] font-semibold text-[#525252]">
          {badge}
        </span>
      ) : null}
    </button>
  )

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-3">
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[#475569]">
            Supplier & location
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">
            Sets the supplier for this service and the default room dates
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>Location</Label>
            <LocationDropdown
              value={String(draft.location || '')}
              onChange={(name) => patch({ location: name, supplier: '', service: '' })}
              clearSupplierOnPick
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Supplier</Label>
            <SupplierPicker
              tab="accommodation"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) => patch({ supplier: item.name, service: item.service })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Check-in</Label>
            <DatePickerGridInput
              value={start}
              onChange={(value) => patch({ start: value })}
              className="bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Check-out</Label>
            <DatePickerGridInput
              value={end}
              onChange={(value) => patch({ end: value })}
              referenceValue={start}
              className="bg-white"
            />
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#737373]">
          Applies to all rooms by default — set different dates per room below if some guests stay
          longer or shorter.
        </p>
        {overrideCount > 0 ? (
          <p className="mt-1 text-[12px] font-semibold text-[#D97706]">
            {overrideCount} {overrideCount === 1 ? 'room has' : 'rooms have'} custom stay dates
          </p>
        ) : null}
        <div className="mt-3 grid gap-1.5">
          <Label>Basis</Label>
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
            {BASIS_OPTIONS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.label}
              </SelectItem>
            ))}
            </SelectContent>
          </Select>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border bg-[#F0FDF4] p-2.5 text-[12px] text-[#166534]">
              <div className="mb-0.5 font-bold">Included</div>
              {details?.included}
            </div>
            <div className="rounded-lg border bg-[#FEF2F2] p-2.5 text-[12px] text-[#991B1B]">
              <div className="mb-0.5 font-bold">Excluded</div>
              {details?.excluded}
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-1 border-b">
        {tabBtn('guests', 'Guests')}
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Promotions')}
        {tabBtn('supplier', 'Supplier')}
        {tabBtn('notes', 'Notes')}
      </div>

      {accTab === 'guests' ? (
        <div className="space-y-3">
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
            <p
              className="mb-2 text-[12px] font-semibold"
              style={{ color: unassigned.length ? '#D97706' : '#16A34A' }}
            >
              {unassigned.length ? `${unassigned.length} guests to place` : 'Everyone has a room'}
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
            const cap = ROOM_CAP[room.type] || 2
            const over = room.guestIds.length > cap
            const br = roomPriceBreakdown(room, start, end, guests)
            const datesDiffer =
              (!!room.start && room.start !== start) || (!!room.end && room.end !== end)
            return (
              <div
                key={room.id}
                className="rounded-xl border bg-[#F9FAFB] p-3"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const gid = Number(e.dataTransfer.getData('text/plain'))
                  if (gid) moveGuestToRoom(gid, room.id)
                }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded border bg-white text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <Select
                    value={room.type}
                    onValueChange={(value) =>
                      setRooms(rooms.map((x) => (x.id === room.id ? { ...x, type: value } : x)))
                    }
                  >
                    <SelectTrigger className="h-7 w-auto bg-white text-[12.5px] font-semibold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    {Object.keys(ROOM_CAP).map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                    </SelectContent>
                  </Select>
                  <span
                    className="text-[12px] font-semibold"
                    style={{ color: over ? '#DC2626' : '#16A34A' }}
                  >
                    {room.guestIds.length} / {cap} guests
                  </span>
                  <div className="flex-1" />
                  <button
                    type="button"
                    onClick={() => setRooms(rooms.filter((x) => x.id !== room.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border bg-white text-[#931115]"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <DatePickerGridInput
                    className="h-7 flex-1 bg-white text-xs"
                    value={br.rStart}
                    onChange={(value) =>
                      setRooms(
                        rooms.map((x) => (x.id === room.id ? { ...x, start: value } : x)),
                      )
                    }
                  />
                  <DatePickerGridInput
                    className="h-7 flex-1 bg-white text-xs"
                    value={br.rEnd}
                    onChange={(value) =>
                      setRooms(rooms.map((x) => (x.id === room.id ? { ...x, end: value } : x)))
                    }
                    referenceValue={br.rStart}
                  />
                  <span className="text-[11px] font-semibold text-[#525252]">
                    {br.rNights} {br.rNights === 1 ? 'night' : 'nights'}
                  </span>
                  {datesDiffer ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-[#2563EB]"
                      onClick={() =>
                        setRooms(rooms.map((x) => (x.id === room.id ? { ...x, start: '', end: '' } : x)))
                      }
                    >
                      Reset
                    </button>
                  ) : null}
                </div>
                <div className="mb-2 flex min-h-10 flex-wrap gap-1.5 rounded-md border border-dashed bg-white p-2">
                  {room.guestIds.length === 0 ? (
                    <span className="text-[12px] text-[#A1A1A1]">Drop guests here</span>
                  ) : (
                    room.guestIds.map((gid) => {
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
                    })
                  )}
                </div>
                {br.priceRows.length > 0 ? (
                  <div className="space-y-1 text-[12px]">
                    {br.priceRows.map((pr) => (
                      <div key={pr.label} className="flex justify-between text-[#525252]">
                        <span>
                          {pr.qty}× {pr.label}
                        </span>
                        <span>
                          {formatUsd(pr.net)} / {formatUsd(pr.rack)}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t pt-1 font-semibold text-[#171717]">
                      <span>Room total</span>
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
            onClick={() =>
              setRooms([
                ...rooms,
                {
                  id: `r${Date.now()}`,
                  type: 'Twin',
                  basis: String(draft.basis || 'bb'),
                  rate: 150,
                  guestIds: [],
                },
              ])
            }
          >
            <Plus className="size-4" />
            Add room
          </Button>
        </div>
      ) : null}

      {accTab === 'extras' ? (
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
            </p>
            <div className="space-y-1.5">
              {EXTRAS_CATALOG.filter((c) => !extraIds.includes(c.id)).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => patch({ extras: [...extraIds, c.id] })}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left hover:bg-[#F9FAFB]"
                >
                  <span className="text-[13px] font-semibold">{c.title}</span>
                  <span className="text-[12.5px] font-semibold text-[#525252]">
                    {formatUsd(c.price)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <Button variant="outline" onClick={() => setCeOpen(true)}>
            <Plus className="size-4" />
            Custom extra
          </Button>
        </div>
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
        <div className="space-y-3">
          <textarea
            readOnly
            rows={3}
            className="w-full resize-none rounded-lg border bg-[#FAFAFB] p-2.5 text-[13px] text-[#525252]"
            value="Must include Conservancy Fee as an extra. Families (5 pax or more) with children aged 5-12 years receive FOC exclusive use of vehicle."
          />
          <textarea
            readOnly
            rows={8}
            className="w-full rounded-lg border-0 bg-[#F3F4F6] p-3 text-[12.5px] leading-relaxed text-[#525252]"
            value="Rates confirmed subject to availability at time of booking. Peak-season surcharge (20 Dec - 5 Jan) applies automatically. Cancellations within 30 days of arrival are non-refundable."
          />
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
