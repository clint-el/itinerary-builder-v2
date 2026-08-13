import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '@/app/store'
import { guestRoleLabel } from '@/shared/lib/helpers'
import type { GuestDetail, GuestResidency, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { DatePickerGridInput } from '@/shared/ui/date-picker'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type GuestMode = 'manage' | 'assign'

interface GuestDrawerProps {
  open: boolean
  onClose: () => void
  itinerary: Itinerary
}

const AGE_OPTIONS = Array.from({ length: 16 }, (_, i) => i + 2)
const SALUTATIONS = ['Mrs', 'Ms', 'Mr'] as const
const RESIDENCY_OPTIONS: { id: GuestResidency; label: string }[] = [
  { id: 'citizen', label: 'Citizen' },
  { id: 'resident', label: 'Resident' },
  { id: 'nonResident', label: 'Non-Resident' },
]
const ROLE_OPTIONS: { id: GuestDetail['ageBand']; label: string }[] = [
  { id: 'adult', label: 'Adult' },
  { id: 'child', label: 'Child' },
  { id: 'infant', label: 'Infant' },
]

function residencyQuota(itinerary: Itinerary, band: 'adult' | 'child' | 'infant'): GuestResidency[] {
  const list: GuestResidency[] = []
  if (band === 'adult') {
    for (let i = 0; i < (itinerary.adultsCitizen ?? 0); i++) list.push('citizen')
    for (let i = 0; i < (itinerary.adultsRes ?? 0); i++) list.push('resident')
    for (let i = 0; i < (itinerary.adultsNonRes ?? 0); i++) list.push('nonResident')
  } else if (band === 'child') {
    for (let i = 0; i < (itinerary.childrenCitizen ?? 0); i++) list.push('citizen')
    for (let i = 0; i < (itinerary.childrenRes ?? 0); i++) list.push('resident')
    for (let i = 0; i < (itinerary.childrenNonRes ?? 0); i++) list.push('nonResident')
  } else {
    for (let i = 0; i < (itinerary.infantsCitizen ?? 0); i++) list.push('citizen')
    for (let i = 0; i < (itinerary.infantsRes ?? 0); i++) list.push('resident')
    for (let i = 0; i < (itinerary.infantsNonRes ?? 0); i++) list.push('nonResident')
  }
  return list
}

function normalizeBand(band: GuestDetail['ageBand'] | 'youth' | undefined): GuestDetail['ageBand'] {
  if (band === 'infant') return 'infant'
  if (band === 'adult') return 'adult'
  return 'child' // youth → child for Role column
}

function buildGuestSlots(
  adults: number,
  children: number,
  infants: number,
  childAges: number[],
  existing: GuestDetail[],
  itinerary: Itinerary,
): GuestDetail[] {
  const slots: GuestDetail[] = []
  let idx = 0
  const adultQuota = residencyQuota(itinerary, 'adult')
  const childQuota = residencyQuota(itinerary, 'child')
  const infantQuota = residencyQuota(itinerary, 'infant')

  for (let i = 0; i < adults; i++) {
    const prev = existing[idx]
    slots.push({
      id: prev?.id || `g-a-${i}`,
      salutation: prev?.salutation || (i === 0 ? 'Mrs' : 'Mr'),
      firstName: prev?.firstName || (i === 0 ? itinerary.leadFirst || '' : ''),
      lastName: prev?.lastName || (i === 0 ? itinerary.leadLast || '' : ''),
      dob: prev?.dob || '',
      ageBand: 'adult',
      age: prev?.age,
      residency: prev?.residency || adultQuota[i] || 'resident',
      flight: prev?.flight || '',
      dietary: prev?.dietary || '',
      preferences: prev?.preferences || '',
      note: prev?.note || '',
      lead: i === 0,
    })
    idx++
  }

  for (let i = 0; i < children; i++) {
    const prev = existing[idx]
    const age = childAges[i] ?? prev?.age
    slots.push({
      id: prev?.id || `g-c-${i}`,
      salutation: prev?.salutation || '',
      firstName: prev?.firstName || '',
      lastName: prev?.lastName || '',
      ageBand: 'child',
      age,
      residency: prev?.residency || childQuota[i] || 'resident',
      flight: prev?.flight || '',
      dietary: prev?.dietary || '',
      preferences: prev?.preferences || '',
      note: prev?.note || '',
      lead: false,
    })
    idx++
  }

  for (let i = 0; i < infants; i++) {
    const prev = existing[idx]
    slots.push({
      id: prev?.id || `g-i-${i}`,
      salutation: prev?.salutation || '',
      firstName: prev?.firstName || '',
      lastName: prev?.lastName || '',
      ageBand: 'infant',
      age: prev?.age ?? 1,
      residency: prev?.residency || infantQuota[i] || 'resident',
      note: prev?.note || '',
      lead: false,
    })
    idx++
  }

  return slots.map((g) => ({ ...g, ageBand: normalizeBand(g.ageBand) }))
}

function guestDisplayName(g: GuestDetail, index: number) {
  const named = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
  if (named) return named
  if (g.lead) return 'Lead Traveler'
  return `${guestRoleLabel(g.ageBand)} ${index + 1}`
}

function describePendingChanges(
  baseline: GuestDetail[],
  current: GuestDetail[],
  baseAdults: number,
  adults: number,
  baseChildren: number,
  children: number,
  baseInfants: number,
  infants: number,
): string[] {
  const lines: string[] = []
  if (adults !== baseAdults || children !== baseChildren || infants !== baseInfants) {
    lines.push(
      `Updated party size to ${adults} adult${adults === 1 ? '' : 's'} · ${children} child${children === 1 ? '' : 'ren'} · ${infants} infant${infants === 1 ? '' : 's'}`,
    )
  }
  const byId = new Map(baseline.map((g) => [g.id, g]))
  for (const g of current) {
    const prev = byId.get(g.id)
    if (!prev) {
      lines.push(`Added ${guestDisplayName(g, 0)} (${guestRoleLabel(g.ageBand)})`)
      continue
    }
    const prevName = [prev.firstName, prev.lastName].filter(Boolean).join(' ').trim()
    const nextName = [g.firstName, g.lastName].filter(Boolean).join(' ').trim()
    if (!prevName && nextName) {
      lines.push(`Named placeholder as ${nextName}`)
    } else if (prevName !== nextName && nextName) {
      lines.push(`Updated name to ${nextName}`)
    }
    if (prev.residency !== g.residency) {
      const label = RESIDENCY_OPTIONS.find((r) => r.id === g.residency)?.label || g.residency
      lines.push(`Updated residency for ${guestDisplayName(g, 0)} → ${label}`)
    }
    if (normalizeBand(prev.ageBand) !== normalizeBand(g.ageBand)) {
      lines.push(`Updated role for ${guestDisplayName(g, 0)} → ${guestRoleLabel(g.ageBand)}`)
    }
    if ((prev.age ?? null) !== (g.age ?? null) && g.age != null) {
      lines.push(`Updated age for ${guestDisplayName(g, 0)} → ${g.age}`)
    }
    if ((prev.note || '') !== (g.note || '') || (prev.dietary || '') !== (g.dietary || '')) {
      lines.push(`Updated notes for ${guestDisplayName(g, 0)}`)
    }
  }
  for (const prev of baseline) {
    if (!current.some((g) => g.id === prev.id)) {
      lines.push(`Removed ${guestDisplayName(prev, 0)}`)
    }
  }
  return lines
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-semibold text-[#171717]">{label}</span>
      {children}
    </div>
  )
}

const inputClass =
  'h-9 w-full rounded-md border-0 bg-[#F9FAFB] px-3 text-sm font-medium text-[#171717] shadow-[inset_0_0_0_1px_#E5E7EB] outline-none'
const textareaClass =
  'h-[60px] w-full resize-none rounded-md border-0 bg-white px-3 py-1.5 text-sm font-medium text-[#171717] shadow-[0_0_0_1px_#E5E7EB] outline-none'

export function GuestDrawer({ open, onClose, itinerary }: GuestDrawerProps) {
  const { getGuestDetails, saveGuestDetails, upsertItinerary } = useStore()
  const [mode, setMode] = useState<GuestMode>('manage')
  const [adults, setAdults] = useState(1)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [childAges, setChildAges] = useState<(number | '')[]>([])
  const [guests, setGuests] = useState<GuestDetail[]>([])
  const [baseline, setBaseline] = useState<GuestDetail[]>([])
  const [baseCounts, setBaseCounts] = useState({ adults: 1, children: 0, infants: 0 })
  const [expandedIdx, setExpandedIdx] = useState(0)
  const [adultsErr, setAdultsErr] = useState('')
  const [childAgesErr, setChildAgesErr] = useState('')

  useEffect(() => {
    if (!open) return
    const saved = getGuestDetails(itinerary.id).map((g) => ({
      ...g,
      ageBand: normalizeBand(g.ageBand as GuestDetail['ageBand'] | 'youth'),
    }))
    const ad = Math.max(1, itinerary.adults ?? itinerary.paxAdults ?? 1)
    const ch = itinerary.children ?? itinerary.paxChildren ?? 0
    const inf = itinerary.infants ?? 0
    const ages = (itinerary.childAges || []).slice(0, ch)
    while (ages.length < ch) ages.push(0)
    setAdults(ad)
    setChildren(ch)
    setInfants(inf)
    setChildAges(ages.map((a) => (a > 0 ? a : ('' as const))))
    const slots = buildGuestSlots(
      ad,
      ch,
      inf,
      ages.filter((a) => a > 0),
      saved,
      itinerary,
    )
    setGuests(slots)
    setBaseline(structuredClone(slots))
    setBaseCounts({ adults: ad, children: ch, infants: inf })
    setMode('manage')
    setExpandedIdx(0)
    setAdultsErr('')
    setChildAgesErr('')
  }, [open, itinerary, getGuestDetails])

  const pendingLines = useMemo(
    () =>
      describePendingChanges(
        baseline,
        guests,
        baseCounts.adults,
        adults,
        baseCounts.children,
        children,
        baseCounts.infants,
        infants,
      ),
    [baseline, guests, baseCounts, adults, children, infants],
  )

  const childAgeRows = useMemo(
    () =>
      Array.from({ length: children }, (_, i) => ({
        label: `Child ${i + 1}`,
        age: childAges[i] ?? '',
      })),
    [children, childAges],
  )

  if (!open) return null

  function syncAssignFromCounts(
    nextAdults: number,
    nextChildren: number,
    nextInfants: number,
    ages: (number | '')[],
  ) {
    const numericAges = ages.map((a) => (typeof a === 'number' ? a : 0)).filter((a) => a > 0)
    setGuests((prev) =>
      buildGuestSlots(nextAdults, nextChildren, nextInfants, numericAges, prev, itinerary),
    )
  }

  function onAdultsChange(v: number) {
    const n = Math.max(0, v)
    setAdults(n)
    setAdultsErr(n < 1 ? 'At least 1 adult is required' : '')
    syncAssignFromCounts(Math.max(1, n), children, infants, childAges)
  }

  function onChildrenChange(v: number) {
    const n = Math.max(0, v)
    setChildren(n)
    const ages = childAges.slice(0, n)
    while (ages.length < n) ages.push('')
    setChildAges(ages)
    syncAssignFromCounts(Math.max(1, adults), n, infants, ages)
  }

  function onInfantsChange(v: number) {
    const n = Math.max(0, v)
    setInfants(n)
    syncAssignFromCounts(Math.max(1, adults), children, n, childAges)
  }

  function patchGuest(index: number, patch: Partial<GuestDetail>) {
    setGuests((prev) =>
      prev.map((g, i) => {
        if (i !== index) return g
        const next = { ...g, ...patch }
        if (patch.ageBand) next.ageBand = normalizeBand(patch.ageBand)
        return next
      }),
    )
  }

  function discardPending() {
    setAdults(baseCounts.adults)
    setChildren(baseCounts.children)
    setInfants(baseCounts.infants)
    const ages = (itinerary.childAges || []).slice(0, baseCounts.children)
    while (ages.length < baseCounts.children) ages.push(0)
    setChildAges(ages.map((a) => (a > 0 ? a : ('' as const))))
    setGuests(structuredClone(baseline))
    setAdultsErr('')
    setChildAgesErr('')
  }

  function handleSave() {
    if (adults < 1) {
      setAdultsErr('At least 1 adult is required')
      setMode('manage')
      return
    }
    const numericAges = childAges.map((a) => (typeof a === 'number' ? a : 0))
    if (children > 0 && numericAges.slice(0, children).some((a) => a < 2 || a > 17)) {
      setChildAgesErr('Select an age (2–17) for each child')
      setMode('manage')
      return
    }
    setChildAgesErr('')

    const finalGuests = buildGuestSlots(
      adults,
      children,
      infants,
      numericAges.filter((a) => a > 0),
      guests,
      itinerary,
    ).map((g, i) => ({ ...g, ...(guests[i] || {}), ageBand: normalizeBand(guests[i]?.ageBand || g.ageBand) }))

    saveGuestDetails(itinerary.id, finalGuests)

    const citizen = (band: GuestDetail['ageBand']) =>
      finalGuests.filter((g) => g.ageBand === band && g.residency === 'citizen').length
    const res = (band: GuestDetail['ageBand']) =>
      finalGuests.filter((g) => g.ageBand === band && g.residency === 'resident').length
    const nonRes = (band: GuestDetail['ageBand']) =>
      finalGuests.filter((g) => g.ageBand === band && g.residency === 'nonResident').length

    const lead = finalGuests.find((g) => g.lead) || finalGuests[0]
    upsertItinerary({
      ...itinerary,
      adults,
      children,
      infants,
      paxAdults: adults,
      paxChildren: children,
      adultsCitizen: citizen('adult'),
      adultsRes: res('adult'),
      adultsNonRes: nonRes('adult'),
      childrenCitizen: citizen('child'),
      childrenRes: res('child'),
      childrenNonRes: nonRes('child'),
      infantsCitizen: citizen('infant'),
      infantsRes: res('infant'),
      infantsNonRes: nonRes('infant'),
      childAges: numericAges.slice(0, children),
      leadFirst: lead?.firstName || itinerary.leadFirst,
      leadLast: lead?.lastName || itinerary.leadLast,
      guestsLabel: [
        adults ? `${adults} Ad` : '',
        children ? `${children} Ch` : '',
        infants ? `${infants} In` : '',
      ]
        .filter(Boolean)
        .join(' · '),
      updatedAt: new Date().toISOString(),
    })
    onClose()
  }

  const modeBtn = (active: boolean) =>
    cn(
      'h-9 flex-1 text-sm font-semibold',
      active ? 'bg-[#931115] text-white' : 'bg-transparent text-[#171717] hover:bg-[#F3F4F6]',
    )

  return (
    <>
      <div className="fixed inset-0 z-[70] bg-black/35" onClick={onClose} role="presentation" />
      <div className="fixed bottom-4 right-4 top-4 z-[71] flex w-[362px] max-w-[calc(100vw-32px)] flex-col rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
        <div className="flex shrink-0 flex-col gap-6 rounded-t-xl border border-[#E5E7EB] bg-[#F9FAFB] px-6 pb-4 pt-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight text-[#171717]">Guests Details</span>
            <button
              type="button"
              onClick={onClose}
              className="flex size-6 items-center justify-center border-0 bg-transparent text-[#171717]"
              aria-label="Close"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="h-px shrink-0 border-t border-dashed border-[#E5E7EB]" />

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden border-x border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex shrink-0 overflow-hidden rounded-md border border-[#E5E7EB]">
            <button type="button" className={modeBtn(mode === 'manage')} onClick={() => setMode('manage')}>
              Manage
            </button>
            <button type="button" className={modeBtn(mode === 'assign')} onClick={() => setMode('assign')}>
              Assign
            </button>
          </div>

          {pendingLines.length > 0 ? (
            <div className="shrink-0 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[12.5px] font-bold text-[#1D4ED8]">
                  Pending changes ({pendingLines.length})
                </span>
                <button
                  type="button"
                  onClick={discardPending}
                  className="border-0 bg-transparent p-0 text-[12px] font-semibold text-[#0369A1]"
                >
                  Discard all
                </button>
              </div>
              <ul className="m-0 list-disc space-y-0.5 pl-4 text-[11.5px] text-[#1E3A8A]">
                {pendingLines.slice(0, 5).map((line) => (
                  <li key={line}>{line}</li>
                ))}
                {pendingLines.length > 5 ? (
                  <li>+{pendingLines.length - 5} more</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
            {mode === 'manage' ? (
              <>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[#171717]">Adults (18+ y.o.)*</span>
                  <input
                    type="number"
                    min={1}
                    value={adults}
                    onChange={(e) => onAdultsChange(Number(e.target.value) || 0)}
                    className={inputClass}
                    style={{ boxShadow: adultsErr ? 'inset 0 0 0 1px #D92D20' : undefined }}
                  />
                  {adultsErr ? <span className="text-xs text-[#D92D20]">{adultsErr}</span> : null}
                </div>

                <div className="h-px border-t border-dashed border-[#E5E7EB]" />

                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-[#171717]">Children (2-17 y.o.)</span>
                    <input
                      type="number"
                      min={0}
                      value={children}
                      onChange={(e) => onChildrenChange(Number(e.target.value) || 0)}
                      className={inputClass}
                    />
                  </div>
                  {children > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-sm font-bold text-[#171717]">Children Age</span>
                      <div className="grid grid-cols-3 gap-3">
                        {childAgeRows.map((row, i) => (
                          <div key={row.label} className="flex flex-col gap-1">
                            <span className="text-xs font-semibold text-[#525252]">{row.label}</span>
                            <Select
                              value={row.age === '' ? '__none__' : String(row.age)}
                              onValueChange={(value) => {
                                const next = [...childAges]
                                next[i] = value === '__none__' ? '' : Number(value)
                                setChildAges(next)
                                setChildAgesErr('')
                                syncAssignFromCounts(Math.max(1, adults), children, infants, next)
                              }}
                            >
                              <SelectTrigger className={inputClass}>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Select</SelectItem>
                                {AGE_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={String(opt)}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                      </div>
                      {childAgesErr ? (
                        <span className="text-xs text-[#D92D20]">{childAgesErr}</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="h-px border-t border-dashed border-[#E5E7EB]" />

                <div className="flex flex-col gap-1">
                  <span className="text-sm font-semibold text-[#171717]">Infants (0-1 y.o.)</span>
                  <input
                    type="number"
                    min={0}
                    value={infants || ''}
                    placeholder="Type here"
                    onChange={(e) => onInfantsChange(Number(e.target.value) || 0)}
                    className={cn(inputClass, 'bg-white shadow-[0_0_0_1px_#E5E7EB]')}
                  />
                </div>
              </>
            ) : (
              guests.map((g, i) => {
                const expanded = expandedIdx === i
                const label = g.lead
                  ? 'Lead Traveler'
                  : `${guestRoleLabel(g.ageBand)} ${i + 1}`
                const isInfant = g.ageBand === 'infant'
                return (
                  <div key={g.id} className="flex flex-col gap-4">
                    {i > 0 ? <div className="h-px border-t border-dashed border-[#E5E7EB]" /> : null}
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(expanded ? -1 : i)}
                      className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-base font-semibold text-[#171717]">{label}</span>
                        <span className="shrink-0 rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[#525252]">
                          {guestRoleLabel(g.ageBand)}
                        </span>
                      </span>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#171717"
                        strokeWidth="2"
                        className={cn('transition-transform', expanded ? '' : '-rotate-90')}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                    {expanded ? (
                      <div className="flex flex-col gap-3">
                        {!isInfant ? (
                          <div className="flex overflow-hidden rounded-md">
                            {SALUTATIONS.map((s) => (
                              <button
                                key={s}
                                type="button"
                                onClick={() => patchGuest(i, { salutation: s })}
                                className={cn(
                                  'h-9 flex-1 text-sm font-semibold',
                                  g.salutation === s
                                    ? 'bg-[#931115] text-white'
                                    : 'bg-[#F3F4F6] text-[#171717]',
                                )}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <Field label="First Name">
                          <input
                            value={g.firstName}
                            onChange={(e) => patchGuest(i, { firstName: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Last Name">
                          <input
                            value={g.lastName}
                            onChange={(e) => patchGuest(i, { lastName: e.target.value })}
                            className={inputClass}
                          />
                        </Field>
                        {!g.lead ? (
                          <Field label="Role">
                            <div className="flex overflow-hidden rounded-md">
                              {ROLE_OPTIONS.map((role) => (
                                <button
                                  key={role.id}
                                  type="button"
                                  disabled={g.lead && role.id !== 'adult'}
                                  onClick={() => patchGuest(i, { ageBand: role.id })}
                                  className={cn(
                                    'h-9 flex-1 text-sm font-semibold',
                                    g.ageBand === role.id
                                      ? 'bg-[#931115] text-white'
                                      : 'bg-[#F3F4F6] text-[#171717]',
                                  )}
                                >
                                  {role.label}
                                </button>
                              ))}
                            </div>
                          </Field>
                        ) : null}
                        <Field label="Residency">
                          <Select
                            value={g.residency || 'resident'}
                            onValueChange={(value) =>
                              patchGuest(i, { residency: value as GuestResidency })
                            }
                          >
                            <SelectTrigger className={inputClass}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {RESIDENCY_OPTIONS.map((opt) => (
                                <SelectItem key={opt.id} value={opt.id}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                        {g.lead ? (
                          <Field label="DOB">
                            <DatePickerGridInput
                              value={g.dob || ''}
                              onChange={(value) => patchGuest(i, { dob: value })}
                              className="bg-[#F9FAFB]"
                            />
                          </Field>
                        ) : (
                          <Field label="Age">
                            <Select
                              value={g.age == null ? '__none__' : String(g.age)}
                              onValueChange={(value) =>
                                patchGuest(i, {
                                  age: value === '__none__' ? undefined : Number(value),
                                })
                              }
                            >
                              <SelectTrigger className={inputClass}>
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">Select</SelectItem>
                                {(g.ageBand === 'infant'
                                  ? [0, 1]
                                  : g.ageBand === 'adult'
                                    ? Array.from({ length: 83 }, (_, n) => n + 18)
                                    : AGE_OPTIONS
                                ).map((opt) => (
                                  <SelectItem key={opt} value={String(opt)}>
                                    {opt}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                        {!isInfant ? (
                          <>
                            <Field label="International Flight Details">
                              <input
                                value={g.flight || ''}
                                placeholder="Type here"
                                onChange={(e) => patchGuest(i, { flight: e.target.value })}
                                className={inputClass}
                              />
                            </Field>
                            <Field label="Dietary Requirements">
                              <textarea
                                value={g.dietary || ''}
                                placeholder="Type here"
                                onChange={(e) => patchGuest(i, { dietary: e.target.value })}
                                className={textareaClass}
                              />
                            </Field>
                            <Field label="Preferences">
                              <textarea
                                value={g.preferences || ''}
                                placeholder="Type here"
                                onChange={(e) => patchGuest(i, { preferences: e.target.value })}
                                className={textareaClass}
                              />
                            </Field>
                          </>
                        ) : null}
                        <Field label="Note">
                          <textarea
                            value={g.note || ''}
                            placeholder="Type here"
                            onChange={(e) => patchGuest(i, { note: e.target.value })}
                            className={textareaClass}
                          />
                        </Field>
                        <div className="flex items-center justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(Math.min(i + 1, guests.length - 1))}
                            className="h-9 rounded-md bg-transparent px-4 text-sm font-medium text-[#931115] shadow-[inset_0_0_0_1px_#931115]"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 rounded-b-xl border border-[#E5E7EB] bg-[#F9FAFB] px-6 py-4 shadow-sm">
          <p className="m-0 text-[11.5px] font-medium text-[#737373]">
            {pendingLines.length > 0
              ? 'Edits are staged as Pending Changes until you Save.'
              : 'No pending guest changes.'}
          </p>
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded-md border-0 bg-[#E5E7EB] px-4 text-sm font-semibold text-[#171717]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="h-9 rounded-md border-0 bg-[#931115] px-4 text-sm font-medium text-white"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
