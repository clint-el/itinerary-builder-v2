import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useStore } from '@/app/store'
import type { GuestDetail, Itinerary } from '@/shared/lib/types'
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

function buildGuestSlots(
  adults: number,
  children: number,
  infants: number,
  childAges: number[],
  existing: GuestDetail[],
  leadFirst?: string,
  leadLast?: string,
): GuestDetail[] {
  const slots: GuestDetail[] = []
  let idx = 0

  for (let i = 0; i < adults; i++) {
    const prev = existing[idx]
    slots.push({
      id: prev?.id || `g-a-${i}`,
      salutation: prev?.salutation || (i === 0 ? 'Mrs' : 'Mr'),
      firstName: prev?.firstName || (i === 0 ? leadFirst || '' : ''),
      lastName: prev?.lastName || (i === 0 ? leadLast || '' : ''),
      dob: prev?.dob || '',
      ageBand: 'adult',
      age: prev?.age,
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
      ageBand: age != null && age >= 12 ? 'youth' : 'child',
      age,
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
      note: prev?.note || '',
      lead: false,
    })
    idx++
  }

  return slots
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
  const [expandedIdx, setExpandedIdx] = useState(0)
  const [adultsErr, setAdultsErr] = useState('')
  const [childAgesErr, setChildAgesErr] = useState('')

  useEffect(() => {
    if (!open) return
    const saved = getGuestDetails(itinerary.id)
    const ad = Math.max(1, itinerary.adults ?? itinerary.paxAdults ?? 1)
    const ch = itinerary.children ?? itinerary.paxChildren ?? 0
    const inf = itinerary.infants ?? 0
    const ages = (itinerary.childAges || []).slice(0, ch)
    while (ages.length < ch) ages.push(0)
    setAdults(ad)
    setChildren(ch)
    setInfants(inf)
    setChildAges(ages.map((a) => (a > 0 ? a : ('' as const))))
    setGuests(
      buildGuestSlots(
        ad,
        ch,
        inf,
        ages.filter((a) => a > 0),
        saved,
        itinerary.leadFirst,
        itinerary.leadLast,
      ),
    )
    setMode('manage')
    setExpandedIdx(0)
    setAdultsErr('')
    setChildAgesErr('')
  }, [open, itinerary, getGuestDetails])

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
      buildGuestSlots(
        nextAdults,
        nextChildren,
        nextInfants,
        numericAges,
        prev,
        itinerary.leadFirst,
        itinerary.leadLast,
      ),
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
    setGuests((prev) => prev.map((g, i) => (i === index ? { ...g, ...patch } : g)))
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
      itinerary.leadFirst,
      itinerary.leadLast,
    ).map((g, i) => guests[i] || g)

    saveGuestDetails(itinerary.id, finalGuests)

    const lead = finalGuests.find((g) => g.lead) || finalGuests[0]
    upsertItinerary({
      ...itinerary,
      adults,
      children,
      infants,
      paxAdults: adults,
      paxChildren: children,
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

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-hidden border-x border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex shrink-0 overflow-hidden rounded-md border border-[#E5E7EB]">
            <button type="button" className={modeBtn(mode === 'manage')} onClick={() => setMode('manage')}>
              Manage
            </button>
            <button type="button" className={modeBtn(mode === 'assign')} onClick={() => setMode('assign')}>
              Assign
            </button>
          </div>

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
                  : g.ageBand === 'infant'
                    ? `Infant ${i}`
                    : g.ageBand === 'child' || g.ageBand === 'youth'
                      ? `Child ${i}`
                      : `Guest ${i + 1}`
                const isChildLike =
                  g.ageBand === 'child' || g.ageBand === 'youth' || g.ageBand === 'infant'
                return (
                  <div key={g.id} className="flex flex-col gap-4">
                    {i > 0 ? <div className="h-px border-t border-dashed border-[#E5E7EB]" /> : null}
                    <button
                      type="button"
                      onClick={() => setExpandedIdx(expanded ? -1 : i)}
                      className="flex w-full items-center justify-between border-0 bg-transparent p-0 text-left"
                    >
                      <span className="text-base font-semibold text-[#171717]">{label}</span>
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
                        {!isChildLike || g.ageBand === 'youth' ? (
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
                              {AGE_OPTIONS.map((opt) => (
                                <SelectItem key={opt} value={String(opt)}>
                                  {opt}
                                </SelectItem>
                              ))}
                              </SelectContent>
                            </Select>
                          </Field>
                        )}
                        {!isChildLike || g.ageBand === 'youth' ? (
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

        <div className="flex shrink-0 justify-end rounded-b-xl border border-[#E5E7EB] bg-[#F9FAFB] px-6 py-4 shadow-sm">
          <div className="flex gap-4">
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
