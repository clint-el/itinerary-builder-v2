import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/app/store'
import {
  ACTIVITY_TYPES,
  CATALOG,
  DESTINATIONS,
  EXTRAS_CATALOG,
  ROOM_CAP,
  VEHICLE_TYPES,
} from '@/shared/lib/catalogs'
import { nightsBetween, partyGuests } from '@/shared/lib/helpers'
import type {
  ActivityItem,
  Guest,
  Hold,
  QuoteExtra,
  QuoteGroup,
  QuoteService,
  Room,
  ServiceTab,
  Vehicle,
} from '@/shared/lib/types'
import { cn, formatDay, formatUsd } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type SearchTypeLabel = 'Accommodation' | 'Transportation' | 'Flight' | 'Activity' | 'Other'

const TYPE_TO_TAB: Record<SearchTypeLabel, ServiceTab> = {
  Accommodation: 'accommodation',
  Transportation: 'transportation',
  Flight: 'flight',
  Activity: 'activity',
  Other: 'other',
}

const TYPE_META: Record<
  SearchTypeLabel,
  { iconBg: string; stroke: string; bannerBg: string; bannerBorder: string; titleColor: string; desc: string }
> = {
  Accommodation: {
    iconBg: '#D1FAE5',
    stroke: '#059669',
    bannerBg: '#ECFDF5',
    bannerBorder: '#A7F3D0',
    titleColor: '#059669',
    desc: 'Lodges, camps and hotels for overnight stays.',
  },
  Transportation: {
    iconBg: '#FEF3C7',
    stroke: '#D97706',
    bannerBg: '#FFFBEB',
    bannerBorder: '#FDE68A',
    titleColor: '#D97706',
    desc: 'Transfers, vehicle hire and ground logistics.',
  },
  Flight: {
    iconBg: '#DBEAFE',
    stroke: '#2563EB',
    bannerBg: '#EFF6FF',
    bannerBorder: '#BFDBFE',
    titleColor: '#2563EB',
    desc: 'Scheduled and charter flights between airstrips.',
  },
  Activity: {
    iconBg: '#FCE7F3',
    stroke: '#DB2777',
    bannerBg: '#FDF2F8',
    bannerBorder: '#FBCFE8',
    titleColor: '#DB2777',
    desc: 'Game drives, balloon safaris and experiences.',
  },
  Other: {
    iconBg: '#E2E8F0',
    stroke: '#475569',
    bannerBg: '#F8FAFC',
    bannerBorder: '#CBD5E1',
    titleColor: '#475569',
    desc: 'Fees, insurance, meet & assist and misc. services.',
  },
}

function iconFor(tab: ServiceTab): QuoteGroup['icon'] {
  if (tab === 'transportation') return 'vehicle'
  if (tab === 'flight') return 'flight'
  return 'lodge'
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

interface AddServiceOverlayProps {
  open: boolean
  itineraryId: string
  onClose: () => void
  defaultStart?: string
  defaultEnd?: string
}

export function AddServiceOverlay({
  open,
  itineraryId,
  onClose,
  defaultStart = '',
  defaultEnd = '',
}: AddServiceOverlayProps) {
  const { getQuoteGroups, saveQuoteGroups, itineraries, getGuestDetails } = useStore()
  const itinerary = itineraries.find((it) => it.id === itineraryId)
  const party: Guest[] = useMemo(
    () => (itinerary ? partyGuests(itinerary, getGuestDetails(itineraryId)) : []),
    [itinerary, itineraryId, getGuestDetails],
  )

  const [searchExpanded, setSearchExpanded] = useState(true)
  const [searchType, setSearchType] = useState<SearchTypeLabel>('Accommodation')
  const [startDate, setStartDate] = useState(defaultStart)
  const [endDate, setEndDate] = useState(defaultEnd)
  const [location, setLocation] = useState('')
  const [destFrom, setDestFrom] = useState('')
  const [destTo, setDestTo] = useState('')
  const [supplier, setSupplier] = useState('')
  const [service, setService] = useState('')
  const [supOpen, setSupOpen] = useState(false)
  const [svcOpen, setSvcOpen] = useState(false)
  const [rooms, setRooms] = useState<Room[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [selectedExtras, setSelectedExtras] = useState<string[]>(['conservancy'])
  const [holds, setHolds] = useState<Hold[]>([])
  const [discount, setDiscount] = useState(0)
  const [toastMsg, setToastMsg] = useState('')

  const tab = TYPE_TO_TAB[searchType]
  const meta = TYPE_META[searchType]
  const catalog = CATALOG[tab]
  const nights = nightsBetween(startDate, endDate)

  const ready =
    !!supplier &&
    (tab === 'accommodation' || !!service) &&
    !!startDate &&
    (tab === 'transportation' || tab === 'flight' ? true : !!endDate || tab !== 'accommodation')

  useEffect(() => {
    if (!open) return
    setSearchType('Accommodation')
    setSearchExpanded(true)
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setLocation('')
    setDestFrom('')
    setDestTo('')
    setSupplier('')
    setService('')
    setSupOpen(false)
    setRooms([])
    setVehicles([])
    setActivities([])
    setSelectedExtras(['conservancy'])
    setHolds([])
    setDiscount(0)
    setToastMsg('')
  }, [open, defaultStart, defaultEnd])

  useEffect(() => {
    if (ready && searchExpanded) {
      setSearchExpanded(false)
    }
  }, [ready, searchExpanded, supplier, service])

  function resetForm(keepType = false) {
    if (!keepType) setSearchType('Accommodation')
    setSearchExpanded(true)
    setStartDate(defaultStart)
    setEndDate(defaultEnd)
    setLocation('')
    setDestFrom('')
    setDestTo('')
    setSupplier('')
    setService('')
    setSupOpen(false)
    setSvcOpen(false)
    setRooms([])
    setVehicles([])
    setActivities([])
    setSelectedExtras(tab === 'accommodation' || keepType ? ['conservancy'] : [])
    setHolds([])
    setDiscount(0)
  }

  const estimate = useMemo(() => {
    const extraTotal = selectedExtras.reduce((sum, id) => {
      const item = EXTRAS_CATALOG.find((e) => e.id === id)
      return sum + (item?.price || 0)
    }, 0)
    if (tab === 'accommodation') {
      const n = nights || 1
      const roomTotal = rooms.reduce((s, r) => s + (r.rate || 390) * n, 0) || 390 * n
      return Math.max(0, roomTotal + extraTotal - discount)
    }
    if (tab === 'transportation') {
      const vTotal = vehicles.reduce((s, v) => s + (v.rate || 220), 0) || 220
      return Math.max(0, vTotal + extraTotal - discount)
    }
    if (tab === 'activity') {
      const aTotal = activities.reduce((s, a) => s + (a.rate || 60) * Math.max(1, a.guestIds.length), 0) || 60
      return Math.max(0, aTotal + extraTotal - discount)
    }
    if (tab === 'flight') return Math.max(0, 310 + extraTotal - discount)
    return Math.max(0, 95 + extraTotal - discount)
  }, [tab, nights, rooms, vehicles, activities, selectedExtras, discount])

  function pickSupplier(item: (typeof catalog)[number]) {
    setSupplier(item.name)
    setService(item.service)
    setLocation(item.location || location)
    setSupOpen(false)
    if (tab === 'accommodation' && rooms.length === 0) {
      setRooms([
        {
          id: uid('rm'),
          type: 'Double',
          basis: 'fb',
          rate: 390,
          guestIds: party.slice(0, 2).map((g) => g.id),
          start: startDate,
          end: endDate,
        },
      ])
    }
  }

  function addRoom() {
    setRooms((prev) => [
      ...prev,
      {
        id: uid('rm'),
        type: 'Twin',
        basis: 'fb',
        rate: 390,
        guestIds: [],
        start: startDate,
        end: endDate,
      },
    ])
  }

  function toggleRoomGuest(roomId: string, guestId: number) {
    setRooms((prev) =>
      prev.map((r) => {
        if (r.id !== roomId) return r
        const cap = ROOM_CAP[r.type] ?? 2
        const has = r.guestIds.includes(guestId)
        if (has) return { ...r, guestIds: r.guestIds.filter((id) => id !== guestId) }
        if (r.guestIds.length >= cap) return r
        return { ...r, guestIds: [...r.guestIds, guestId] }
      }),
    )
  }

  function addVehicle() {
    const vt = VEHICLE_TYPES[0]
    setVehicles((prev) => [
      ...prev,
      {
        id: uid('vh'),
        type: vt.type,
        cap: vt.cap,
        rate: vt.rate,
        guestIds: party.map((g) => g.id),
      },
    ])
  }

  function addActivity() {
    const at = ACTIVITY_TYPES[0]
    setActivities((prev) => [
      ...prev,
      {
        id: uid('ac'),
        name: at.name,
        rate: at.rate,
        start: startDate,
        end: endDate || startDate,
        guestIds: party.map((g) => g.id),
      },
    ])
  }

  function addHold() {
    setHolds((prev) => [
      ...prev,
      {
        id: uid('h'),
        status: 'Held',
        price: estimate,
        date: formatDay(startDate) || '—',
        ref: `REF-${1100 + prev.length}`,
        comment: '',
      },
    ])
  }

  function buildQuoteService(): { groupName: string; loc: string; icon: QuoteGroup['icon']; service: QuoteService } {
    const dates =
      endDate && endDate !== startDate
        ? `${formatDay(startDate)} - ${formatDay(endDate)}`
        : formatDay(startDate) || '—'
    const allocParts: string[] = []
    const ad = party.filter((g) => g.type === 'adult').length
    const ch = party.filter((g) => g.type === 'child' || g.type === 'youth').length
    const inf = party.filter((g) => g.type === 'infant').length
    if (ad) allocParts.push(`${ad}A`)
    if (ch) allocParts.push(`${ch}C`)
    if (inf) allocParts.push(`${inf}In`)

    const extras: QuoteExtra[] = selectedExtras.map((id) => {
      const item = EXTRAS_CATALOG.find((e) => e.id === id)!
      return {
        label: item.title,
        isNew: true,
        qty: '1',
        dates,
        alloc: allocParts.join(', ') || '—',
        statusLabel: holds.length ? 'Hold' : 'Prepared',
        statusColor: holds.length ? '#931115' : '#0B69A3',
        statusBg: holds.length ? '#F4E2E3' : '#DFF2FE',
        statusSub: holds[0]?.date,
        amount: formatUsd(item.price),
      }
    })
    if (discount > 0) {
      extras.unshift({
        label: 'Discount',
        isDiscount: true,
        amount: `-${formatUsd(discount)}`,
        pct: '',
      })
    }

    const title =
      tab === 'accommodation'
        ? service || 'Full Board (FB)'
        : tab === 'transportation'
          ? vehicles[0]?.type || service || 'Standard'
          : service || supplier

    return {
      groupName: supplier,
      loc: location || destTo || '',
      icon: iconFor(tab),
      service: {
        id: uid('sv'),
        title,
        sub: tab === 'transportation' && vehicles[0] ? `· ${vehicles[0].type}` : undefined,
        isNew: true,
        qty: String(rooms.length || vehicles.length || activities.length || 1),
        nights: tab === 'accommodation' ? String(nights || 1) : undefined,
        dates,
        alloc: allocParts.join(', ') || '—',
        statusLabel: holds.length ? 'Hold' : 'Prepared',
        statusColor: holds.length ? '#931115' : '#0B69A3',
        statusBg: holds.length ? '#F4E2E3' : '#DFF2FE',
        statusSub: holds[0]?.date,
        subtotal: formatUsd(estimate),
        hasChevron: extras.length > 0,
        expanded: extras.length > 0,
        extras,
      },
    }
  }

  function commit(continueAdding: boolean) {
    if (!supplier) return
    const built = buildQuoteService()
    const groups = structuredClone(getQuoteGroups(itineraryId))
    const existing = groups.find((g) => g.name === built.groupName)
    if (existing) {
      existing.services.push(built.service)
      if (!existing.loc && built.loc) existing.loc = built.loc
    } else {
      groups.push({
        id: uid('g'),
        name: built.groupName,
        loc: built.loc,
        icon: built.icon,
        services: [built.service],
      })
    }
    saveQuoteGroups(itineraryId, groups)
    setToastMsg(continueAdding ? 'Service added — pick another' : 'Service added successfully')
    setTimeout(() => {
      setToastMsg('')
      if (continueAdding) {
        resetForm(true)
        setSearchExpanded(true)
      } else {
        onClose()
      }
    }, 700)
  }

  if (!open) return null

  const typeBtn = (label: SearchTypeLabel) => {
    const m = TYPE_META[label]
    const active = searchType === label
    return (
      <button
        key={label}
        type="button"
        onClick={() => {
          setSearchType(label)
          setSupplier('')
          setService('')
          setSearchExpanded(true)
        }}
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold',
          active ? 'border-[#931115] bg-white text-[#171717]' : 'border-transparent bg-white/60 text-[#525252]',
        )}
      >
        <span
          className="flex size-[26px] shrink-0 items-center justify-center rounded-lg"
          style={{ background: m.iconBg }}
        >
          <TypeIcon label={label} stroke={m.stroke} />
        </span>
        {label}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4">
      <div className="flex max-h-[calc(100vh-32px)] w-[1066px] max-w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
        {searchExpanded ? (
          <>
            <div className="shrink-0 rounded-t-[14px] bg-[#F9FAFB] px-4 pb-3 pt-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  {(Object.keys(TYPE_META) as SearchTypeLabel[]).map(typeBtn)}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-6 shrink-0 items-center justify-center border-0 bg-transparent text-[#171717]"
                  aria-label="Close"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
              <div
                className="mt-3 flex items-center gap-3 rounded-lg px-3 py-2.5"
                style={{ background: meta.bannerBg, boxShadow: `inset 0 0 0 1px ${meta.bannerBorder}` }}
              >
                <span
                  className="flex size-[34px] shrink-0 items-center justify-center rounded-lg"
                  style={{ background: meta.iconBg }}
                >
                  <TypeIcon label={searchType} stroke={meta.stroke} size={18} />
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-bold" style={{ color: meta.titleColor }}>
                    {searchType}
                  </div>
                  <div className="text-[12.5px] font-medium text-[#525252]">{meta.desc}</div>
                </div>
              </div>
            </div>
            <div className="border-t border-dashed border-[#E5E7EB]" />
            <div className="shrink-0 bg-white px-4 pb-4 pt-3">
              <div className="flex flex-wrap gap-3">
                <div className="w-[220px] shrink-0">
                  <label className="mb-1.5 block text-sm font-semibold text-[#171717]">
                    {tab === 'flight' ? 'Depart' : 'Start date'}
                  </label>
                  <DatePickerGridInput
                    value={startDate}
                    onChange={setStartDate}
                    className="bg-[#F9FAFB]"
                  />
                </div>
                {tab === 'accommodation' || tab === 'activity' || tab === 'other' ? (
                  <div className="w-[220px] shrink-0">
                    <label className="mb-1.5 block text-sm font-semibold text-[#171717]">End date</label>
                    <DatePickerGridInput
                      value={endDate}
                      onChange={setEndDate}
                      referenceValue={startDate}
                      className="bg-[#F9FAFB]"
                    />
                  </div>
                ) : null}
                {tab === 'accommodation' ? (
                  <div className="w-[132px] shrink-0">
                    <label className="mb-1.5 block text-sm font-semibold text-[#171717]">No. of Nights</label>
                    <div className="flex h-9 items-center gap-1.5 rounded-md bg-[#F3F4F6] px-3 shadow-[inset_0_0_0_1px_#E5E7EB]">
                      <span className="text-sm font-semibold text-[#171717]">{nights || '—'}</span>
                    </div>
                  </div>
                ) : null}
                {tab === 'transportation' || tab === 'flight' ? (
                  <>
                    <div className="min-w-0 flex-1">
                      <label className="mb-1.5 block text-sm font-semibold text-[#171717]">From</label>
                      <input
                        value={destFrom}
                        onChange={(e) => setDestFrom(e.target.value)}
                        placeholder="Select Departure"
                        className="h-9 w-full rounded-md bg-[#F9FAFB] px-3 text-sm shadow-[inset_0_0_0_1px_#E5E7EB] outline-none"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <label className="mb-1.5 block text-sm font-semibold text-[#171717]">To</label>
                      <input
                        value={destTo}
                        onChange={(e) => setDestTo(e.target.value)}
                        placeholder="Select Arrival"
                        className="h-9 w-full rounded-md bg-[#F9FAFB] px-3 text-sm shadow-[inset_0_0_0_1px_#E5E7EB] outline-none"
                      />
                    </div>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <label className="mb-1.5 block text-sm font-semibold text-[#171717]">Location</label>
                    <Select
                      value={location || '__all__'}
                      onValueChange={(value) => setLocation(value === '__all__' ? '' : value)}
                    >
                      <SelectTrigger className="bg-[#F9FAFB]">
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                      <SelectItem value="__all__">All</SelectItem>
                      {DESTINATIONS.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                      {catalog
                        .map((c) => c.location)
                        .filter((v, i, a) => v && a.indexOf(v) === i)
                        .map((loc) => (
                          <SelectItem key={loc} value={loc}>
                            {loc}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="relative mt-3 flex gap-3">
                <div className="min-w-0 flex-1">
                  <label className="mb-1.5 block text-sm font-semibold text-[#171717]">Supplier</label>
                  <button
                    type="button"
                    onClick={() => {
                      setSupOpen((o) => !o)
                      setSvcOpen(false)
                    }}
                    className="flex h-9 w-full items-center gap-1.5 rounded-md bg-[#F9FAFB] px-3 text-left text-sm shadow-[inset_0_0_0_1px_#E5E7EB]"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium text-[#171717]">
                      {supplier || 'Search supplier…'}
                    </span>
                  </button>
                  {supOpen ? (
                    <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-auto rounded-md border border-[#E5E7EB] bg-white shadow-md">
                      {catalog
                        .filter((c) => !location || c.location === location || location === c.location)
                        .map((item) => (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => pickSupplier(item)}
                            className="flex w-full gap-2 border-b border-[#E5E7EB] px-3 py-2.5 text-left hover:bg-[#F9FAFB]"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="truncate text-[15px] font-bold text-[#171717]">{item.name}</span>
                                <span className="shrink-0 text-[13px] text-[#525252]">{item.group}</span>
                              </div>
                              <div className="mt-0.5 text-[13px] text-[#525252]">{item.location}</div>
                            </div>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </div>
                {tab !== 'accommodation' ? (
                  <div className="relative min-w-0 flex-1">
                    <label className="mb-1.5 block text-sm font-semibold text-[#171717]">Service</label>
                    <button
                      type="button"
                      onClick={() => {
                        setSvcOpen((o) => !o)
                        setSupOpen(false)
                      }}
                      className="flex h-9 w-full items-center gap-1.5 rounded-md bg-[#F9FAFB] px-3 text-left text-sm shadow-[inset_0_0_0_1px_#E5E7EB]"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium text-[#171717]">
                        {service || 'Search service…'}
                      </span>
                    </button>
                    {svcOpen ? (
                      <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-auto rounded-md border border-[#E5E7EB] bg-white shadow-md">
                        {catalog.map((item) => (
                          <button
                            key={`${item.name}-${item.service}`}
                            type="button"
                            onClick={() => {
                              setSupplier(item.name)
                              setService(item.service)
                              setLocation(item.location || location)
                              setSvcOpen(false)
                            }}
                            className="flex w-full flex-col gap-1 border-b border-[#E5E7EB] px-3 py-2.5 text-left hover:bg-[#F9FAFB]"
                          >
                            <span className="text-[15px] font-bold text-[#171717]">{item.service}</span>
                            <span className="text-[13px] text-[#525252]">{item.name}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E7EB] px-6 py-4">
              <div className="min-w-0">
                <div className="truncate text-base font-bold text-[#171717]">
                  {supplier}
                  {service ? <span className="font-medium text-[#A1A1A1]"> · {service}</span> : null}
                </div>
                <div className="text-xs text-[#A1A1A1]">
                  {formatDay(startDate)}
                  {endDate ? ` – ${formatDay(endDate)}` : ''}
                  {location ? ` · ${location}` : ''}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchExpanded(true)}
                  className="h-8 rounded-md px-3 text-sm font-semibold text-[#931115] shadow-[inset_0_0_0_1px_#931115]"
                >
                  Edit search
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex size-8 items-center justify-center rounded-md text-[#A1A1A1] hover:bg-[#F3F4F6]"
                  aria-label="Close"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              {tab === 'accommodation' ? (
                <section className="border-b border-dashed border-[#E5E7EB] px-6 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#171717]">Rooms board</span>
                    <button
                      type="button"
                      onClick={addRoom}
                      className="text-sm font-semibold text-[#931115]"
                    >
                      + Add room
                    </button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {rooms.map((room, idx) => (
                      <div key={room.id} className="rounded-lg border border-[#E5E7EB] p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-[#525252]">Room {idx + 1}</span>
                          <Select
                            value={room.type}
                            onValueChange={(value) =>
                              setRooms((prev) =>
                                prev.map((r) => (r.id === room.id ? { ...r, type: value } : r)),
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-auto bg-[#F9FAFB] text-sm">
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
                          <span className="text-sm font-semibold text-[#067A55]">{formatUsd(room.rate)}/nt</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {party.map((g) => {
                            const checked = room.guestIds.includes(g.id)
                            return (
                              <button
                                key={g.id}
                                type="button"
                                onClick={() => toggleRoomGuest(room.id, g.id)}
                                className={cn(
                                  'inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-semibold',
                                  checked
                                    ? 'border-[#931115] bg-[#F4E2E3] text-[#171717]'
                                    : 'border-[#E5E7EB] bg-white text-[#171717]',
                                )}
                              >
                                {g.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                    {rooms.length === 0 ? (
                      <p className="text-xs text-[#A1A1A1]">Add a room and assign guests from the party.</p>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {tab === 'transportation' ? (
                <section className="border-b border-dashed border-[#E5E7EB] px-6 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#171717]">Vehicles</span>
                    <button type="button" onClick={addVehicle} className="text-sm font-semibold text-[#931115]">
                      + Add vehicle
                    </button>
                  </div>
                  {vehicles.map((v) => (
                    <div key={v.id} className="mb-2 flex items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2">
                      <Select
                        value={v.type}
                        onValueChange={(value) => {
                          const vt = VEHICLE_TYPES.find((x) => x.type === value) || VEHICLE_TYPES[0]
                          setVehicles((prev) =>
                            prev.map((x) =>
                              x.id === v.id ? { ...x, type: vt.type, cap: vt.cap, rate: vt.rate } : x,
                            ),
                          )
                        }}
                      >
                        <SelectTrigger className="h-8 w-auto bg-[#F9FAFB] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        {VEHICLE_TYPES.map((vt) => (
                          <SelectItem key={vt.type} value={vt.type}>
                            {vt.type} (cap {vt.cap})
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                      <span className="text-sm font-semibold">{formatUsd(v.rate)}</span>
                    </div>
                  ))}
                </section>
              ) : null}

              {tab === 'activity' ? (
                <section className="border-b border-dashed border-[#E5E7EB] px-6 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[#171717]">Activities &amp; PAX</span>
                    <button type="button" onClick={addActivity} className="text-sm font-semibold text-[#931115]">
                      + Add activity
                    </button>
                  </div>
                  {activities.map((a) => (
                    <div key={a.id} className="mb-2 rounded-lg border border-[#E5E7EB] p-3">
                      <Select
                        value={a.name}
                        onValueChange={(value) => {
                          const at = ACTIVITY_TYPES.find((x) => x.name === value) || ACTIVITY_TYPES[0]
                          setActivities((prev) =>
                            prev.map((x) => (x.id === a.id ? { ...x, name: at.name, rate: at.rate } : x)),
                          )
                        }}
                      >
                        <SelectTrigger className="mb-2 h-8 bg-[#F9FAFB] text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                        {ACTIVITY_TYPES.map((at) => (
                          <SelectItem key={at.name} value={at.name}>
                            {at.name}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                      <div className="flex flex-wrap gap-2">
                        {party.map((g) => {
                          const checked = a.guestIds.includes(g.id)
                          return (
                            <button
                              key={g.id}
                              type="button"
                              onClick={() =>
                                setActivities((prev) =>
                                  prev.map((x) =>
                                    x.id !== a.id
                                      ? x
                                      : {
                                          ...x,
                                          guestIds: checked
                                            ? x.guestIds.filter((id) => id !== g.id)
                                            : [...x.guestIds, g.id],
                                        },
                                  ),
                                )
                              }
                              className={cn(
                                'inline-flex h-8 items-center rounded-lg border px-2.5 text-[12.5px] font-semibold',
                                checked ? 'border-[#931115] bg-[#F4E2E3]' : 'border-[#E5E7EB]',
                              )}
                            >
                              {g.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </section>
              ) : null}

              <section className="border-b border-dashed border-[#E5E7EB] px-6 py-4">
                <span className="mb-3 block text-sm font-semibold text-[#171717]">Extras</span>
                <div className="flex flex-col gap-2">
                  {EXTRAS_CATALOG.map((ex) => {
                    const checked = selectedExtras.includes(ex.id)
                    return (
                      <label
                        key={ex.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-[#E5E7EB] px-3 py-2"
                      >
                        <span className="flex items-center gap-2 text-sm font-medium text-[#171717]">
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={ex.mandatory}
                            onChange={() => {
                              if (ex.mandatory) return
                              setSelectedExtras((prev) =>
                                checked ? prev.filter((id) => id !== ex.id) : [...prev, ex.id],
                              )
                            }}
                          />
                          {ex.title}
                          {ex.mandatory ? (
                            <span className="text-[11px] font-semibold text-[#A1A1A1]">Mandatory</span>
                          ) : null}
                        </span>
                        <span className="text-sm font-semibold">{formatUsd(ex.price)}</span>
                      </label>
                    )
                  })}
                </div>
              </section>

              <section className="border-b border-dashed border-[#E5E7EB] px-6 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-sm font-semibold text-[#171717]">Holds</span>
                  <button type="button" onClick={addHold} className="text-sm font-semibold text-[#931115]">
                    + Request hold
                  </button>
                </div>
                {holds.length === 0 ? (
                  <p className="text-xs text-[#A1A1A1]">No holds yet.</p>
                ) : (
                  holds.map((h) => (
                    <div key={h.id} className="mb-2 overflow-hidden rounded-md">
                      <div className="bg-[#00BCFF] px-2.5 py-1 text-xs font-semibold text-white">
                        {h.status} · {h.ref}
                      </div>
                      <div className="flex justify-between border border-t-0 border-[#00A6F4] bg-[#DFF2FE] px-2.5 py-2 text-sm">
                        <span>{h.date}</span>
                        <span className="font-semibold">{formatUsd(h.price)}</span>
                      </div>
                    </div>
                  ))
                )}
              </section>

              <section className="px-6 py-4">
                <label className="mb-1.5 block text-sm font-semibold text-[#171717]">Discount ($)</label>
                <input
                  type="number"
                  min={0}
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                  className="h-9 w-40 rounded-md bg-[#F9FAFB] px-3 text-sm shadow-[inset_0_0_0_1px_#E5E7EB] outline-none"
                />
              </section>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-4 border-t border-[#E5E7EB] px-6 py-4">
              <div className="text-sm">
                <span className="font-semibold text-[#A1A1A1]">Est. </span>
                <span className="text-lg font-bold text-[#171717]">{formatUsd(estimate)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => commit(false)}
                  className="h-[38px] rounded-lg border-0 bg-[#931115] px-5 text-sm font-semibold text-white"
                >
                  Add Service
                </button>
                <button
                  type="button"
                  onClick={() => commit(true)}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-[#931115] bg-white px-[18px] text-sm font-semibold text-[#931115]"
                >
                  Add &amp; Continue
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {toastMsg ? (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-[#171717] px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          {toastMsg}
        </div>
      ) : null}
    </div>
  )
}

function TypeIcon({
  label,
  stroke,
  size = 15,
}: {
  label: SearchTypeLabel
  stroke: string
  size?: number
}) {
  if (label === 'Accommodation') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M2 4v16" />
        <path d="M2 8h18a2 2 0 0 1 2 2v10" />
        <path d="M2 17h20" />
        <path d="M6 8v9" />
      </svg>
    )
  }
  if (label === 'Transportation') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
        <circle cx="7" cy="17" r="2" />
        <path d="M9 17h6" />
        <circle cx="17" cy="17" r="2" />
      </svg>
    )
  }
  if (label === 'Flight') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.3.5-.1 1.1.4 1.4l5.7 3.4-2 3.5H4l-1 1.5 3.5 2 2 3.5L10 21v-3.4l3.5-2 3.4 5.7c.3.5.9.7 1.4.4l.5-.3c.4-.2.6-.6.5-1.1" />
      </svg>
    )
  }
  if (label === 'Activity') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="m12 6 4 6-4 6-4-6z" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  )
}
