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
  nights,
  roomPriceBreakdown,
  roomQty,
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
      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-[12px] font-bold uppercase tracking-wide text-[#334155]">
            Supplier & stay dates
          </h3>
          <p className="text-[11.5px] text-[#94A3B8]">
            Sets the supplier for this service and the default room dates
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>1. Location</Label>
            <LocationDropdown
              value={String(draft.location || '')}
              onChange={(name) => patch({ location: name, supplier: '', service: '' })}
              clearSupplierOnPick
            />
          </div>
          <div className="grid gap-1.5">
            <Label>2. Supplier</Label>
            <SupplierPicker
              tab="accommodation"
              value={String(draft.supplier || '')}
              onPick={(item: CatalogItem) => patch({ supplier: item.name, service: item.service })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Start Date</Label>
            <DatePickerGridInput
              value={start}
              onChange={(value) => patch({ start: value })}
              className="bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>End Date</Label>
            <DatePickerGridInput
              value={end}
              onChange={(value) => patch({ end: value })}
              referenceValue={start}
              className="bg-white"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Nights</Label>
            <div className="flex h-9 items-center rounded-md border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#171717]">
              {nights(start, end)}
            </div>
          </div>
        </div>
        <p className="mt-2 text-[12px] text-[#737373]">
          Applies to all rooms by default — set different dates per room below if some guests stay
          longer or shorter.
        </p>
        {overrideCount > 0 ? (
          <span className="mt-2 inline-flex h-[18px] items-center rounded bg-[#FEF3C7] px-1.5 text-[9px] font-bold text-[#92400E]">
            CUSTOM dates · {overrideCount}
          </span>
        ) : null}
      </section>

      <section className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 shadow-sm">
        <div className="mb-3 grid gap-1.5">
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
        </div>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Included
            </p>
            <p className="text-[12.5px] leading-relaxed text-[#171717]">{details?.included}</p>
          </div>
          <div className="border-t border-[#E2E8F0]" />
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Excluded
            </p>
            <p className="text-[12.5px] leading-relaxed text-[#525252]">{details?.excluded}</p>
          </div>
        </div>
      </section>

      <div className="flex gap-1 border-b">
        {tabBtn('guests', 'Guests')}
        {tabBtn('extras', 'Extras', extras.length)}
        {tabBtn('promotions', 'Promotions')}
        {tabBtn('supplier', 'Supplier')}
        {tabBtn('notes', 'Supplier Notes')}
      </div>

      {accTab === 'guests' ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-bold text-[#171717]">Rooms & Guests</span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: unassigned.length ? '#D97706' : '#16A34A' }}
            >
              {unassigned.length ? `${unassigned.length} guests to place` : 'Everyone has a room'}
            </span>
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
            const qty = roomQty(room)
            const cap = (ROOM_CAP[room.type] || 2) * qty
            const over = room.guestIds.length > cap
            const br = roomPriceBreakdown(room, start, end, guests)
            const datesDiffer =
              (!!room.start && room.start !== start) || (!!room.end && room.end !== end)
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
                        <SelectItem key={t} value={t}>
                          {t}
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
                  <div className="flex items-center" title="Number of rooms of this type">
                    <button
                      type="button"
                      disabled={qty <= 1}
                      onClick={() =>
                        setRooms(
                          rooms.map((x) =>
                            x.id === room.id ? { ...x, qty: Math.max(1, qty - 1) } : x,
                          ),
                        )
                      }
                      className="flex size-6 items-center justify-center rounded-l-md border border-[#E5E7EB] bg-white text-[#525252] disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="flex h-6 min-w-6 items-center justify-center border-y border-[#E5E7EB] bg-white text-[12px] font-bold">
                      ×{qty}
                    </span>
                    <button
                      type="button"
                      title="Add another room of this type"
                      onClick={() =>
                        setRooms(rooms.map((x) => (x.id === room.id ? { ...x, qty: qty + 1 } : x)))
                      }
                      className="flex size-6 items-center justify-center rounded-r-md border border-[#E5E7EB] bg-white text-[#931115]"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRooms(rooms.filter((x) => x.id !== room.id))}
                    className="flex size-[26px] items-center justify-center rounded-md border bg-white text-[#931115]"
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
                  {datesDiffer ? (
                    <>
                      <span className="inline-flex h-[18px] items-center rounded bg-[#FEF3C7] px-1.5 text-[9px] font-bold text-[#92400E]">
                        CUSTOM
                      </span>
                      <button
                        type="button"
                        title="Reset to default stay dates"
                        className="text-[11px] font-semibold text-[#2563EB]"
                        onClick={() =>
                          setRooms(
                            rooms.map((x) =>
                              x.id === room.id ? { ...x, start: '', end: '' } : x,
                            ),
                          )
                        }
                      >
                        Reset
                      </button>
                    </>
                  ) : null}
                </div>
                <div className="min-h-10 p-2.5">
                  {room.guestIds.length === 0 ? (
                    <span className="text-[12px] text-[#A1A1A1]">
                      Empty — drag a guest here to assign.
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
                      <span>Room total (Net / Rack)</span>
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
                  type: 'Twin',
                  basis: String(draft.basis || 'bb'),
                  rate: 150,
                  qty: 1,
                  guestIds: [],
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
