import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/app/store'
import type { GuestDetail, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { GuestDetailsPanel } from './GuestDetailsPanel'
import {
  autoAllocateGuestOnServices,
  bandToRole,
  blankGuest,
  collectServiceLines,
  guestDisplayName,
  dietaryStatusOf,
  guestLineAssignments,
  isPlaceholderGuest,
  removeGuestFromServices,
  roleToBand,
  syncItineraryPaxFromGuests,
  type GuestPendingChange,
  type GuestRole,
  type ServiceLineRef,
} from './guestUtils'

interface GuestFormState {
  id: string | null
  wasPlaceholder: boolean
  sal: string
  first: string
  last: string
  role: GuestRole
  age: string
  note: string
  dietary: string
  dietaryNone: boolean
}

interface GuestDetailsSheetProps {
  open: boolean
  onClose: () => void
  itinerary: Itinerary
  /** When true, render panel only (no outer sheet chrome) — used on quote Guests tab. */
  inline?: boolean
}

const SALS = ['Mrs.', 'Ms.', 'Mr.'] as const
const ROLES: GuestRole[] = ['Adult', 'Child', 'Infant']

function normalizeSal(s?: string): string {
  const raw = String(s || 'Mr').replace(/\.$/, '')
  if (raw === 'Mrs') return 'Mrs.'
  if (raw === 'Ms') return 'Ms.'
  return 'Mr.'
}

function toStorageSal(s: string): string {
  return s.replace(/\.$/, '')
}

export function GuestDetailsSheet({ open, onClose, itinerary, inline = false }: GuestDetailsSheetProps) {
  const {
    getGuestDetails,
    saveGuestDetails,
    upsertItinerary,
    getServices,
    saveServices,
    getQuoteGroups,
  } = useStore()

  const [guests, setGuests] = useState<GuestDetail[]>([])
  const [pending, setPending] = useState<GuestPendingChange[]>([])
  const [form, setForm] = useState<GuestFormState | null>(null)
  const [breachAck, setBreachAck] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const services = useMemo(() => getServices(itinerary.id), [getServices, itinerary.id, tick, open])
  const quoteGroups = useMemo(
    () => getQuoteGroups(itinerary.id),
    [getQuoteGroups, itinerary.id, tick, open],
  )
  const lines = useMemo(
    () => collectServiceLines(services, quoteGroups),
    [services, quoteGroups],
  )
  const assignments = useMemo(
    () => guestLineAssignments(guests, services, lines),
    [guests, services, lines],
  )

  useEffect(() => {
    if (!open && !inline) return
    setGuests(getGuestDetails(itinerary.id))
    setPending([])
    setForm(null)
    setDeleteId(null)
    setTick((t) => t + 1)
  }, [open, inline, itinerary.id, getGuestDetails])

  const deleteBlockedIds = useMemo(() => {
    const set = new Set<string>()
    guests.forEach((g) => {
      const ids = assignments.get(g.id) || []
      if (ids.some((id) => lines.find((l) => l.id === id)?.locked)) set.add(g.id)
    })
    return set
  }, [guests, assignments, lines])

  if (!open && !inline) return null

  function persist(next: GuestDetail[], nextServices = services) {
    saveGuestDetails(itinerary.id, next)
    upsertItinerary(syncItineraryPaxFromGuests(itinerary, next))
    if (nextServices !== services) saveServices(itinerary.id, nextServices)
    setGuests(next)
    setTick((t) => t + 1)
  }

  function pushPending(kind: string, text: string) {
    setPending((prev) => [
      ...prev,
      { id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind, text },
    ])
  }

  function openAdd() {
    setForm({
      id: null,
      wasPlaceholder: false,
      sal: 'Mr.',
      first: '',
      last: '',
      role: 'Adult',
      age: '',
      note: '',
      dietary: '',
      dietaryNone: false,
    })
    setBreachAck(false)
  }

  function openEdit(g: GuestDetail) {
    setForm({
      id: g.id,
      wasPlaceholder: isPlaceholderGuest(g),
      sal: normalizeSal(g.salutation),
      first: g.firstName || '',
      last: g.lastName || '',
      role: bandToRole(g.ageBand),
      age: g.age == null ? '' : String(g.age),
      note: g.note || '',
      dietary: dietaryStatusOf(g) === 'recorded' ? g.dietary || '' : '',
      dietaryNone: dietaryStatusOf(g) === 'none',
    })
    setBreachAck(false)
  }

  function ageHint(f: GuestFormState): string {
    if (f.age === '') return ''
    const age = Number(f.age)
    if (Number.isNaN(age)) return ''
    if (f.role === 'Infant' && age > 2)
      return `Age ${age} is unusual for an Infant — check the role before saving.`
    if (f.role === 'Child' && age >= 18)
      return `Age ${age} would normally be an Adult — check the role before saving.`
    if (f.role === 'Adult' && age < 16)
      return `Age ${age} would normally be a Child — check the role before saving.`
    return ''
  }

  function breachesFor(f: GuestFormState): ServiceLineRef[] {
    if (!f.id || f.age === '') return []
    const age = Number(f.age)
    if (Number.isNaN(age)) return []
    const assigned = assignments.get(f.id) || []
    return lines.filter((l) => assigned.includes(l.id) && age < l.minAge)
  }

  function saveForm() {
    if (!form) return
    const age = form.age === '' ? undefined : Number(form.age)
    const breaches = breachesFor(form)
    if (breaches.length && !breachAck) {
      setBreachAck(true)
      return
    }

    if (form.id) {
      const prev = guests.find((g) => g.id === form.id)
      if (!prev) return
      const next = guests.map((g) =>
        g.id !== form.id
          ? g
          : {
              ...g,
              salutation: toStorageSal(form.sal),
              firstName: form.first.trim(),
              lastName: form.last.trim(),
              ageBand: roleToBand(form.role),
              age,
              note: form.note,
              dietary: form.dietaryNone ? '' : form.dietary.trim(),
              dietaryStatus: form.dietaryNone
                ? 'none'
                : form.dietary.trim()
                  ? 'recorded'
                  : 'not_captured',
            },
      )
      persist(next)
      const nm =
        [form.first, form.last].filter(Boolean).join(' ').trim() || 'Unnamed Guest'
      if (form.wasPlaceholder && nm !== 'Unnamed Guest') {
        pushPending(
          'Named',
          `${guestDisplayName(prev, guests)} → ${nm} — replaced on service lines, rooming lists and vouchers`,
        )
      } else {
        pushPending(
          'Updated',
          `${nm} updated${breaches.length ? ` — unassigned from ${breaches.length} line${breaches.length === 1 ? '' : 's'} below minimum age` : ''}`,
        )
      }
    } else {
      const g = blankGuest(form.role)
      g.salutation = toStorageSal(form.sal)
      g.firstName = form.first.trim()
      g.lastName = form.last.trim()
      g.age = age
      g.note = form.note
      g.dietary = form.dietaryNone ? '' : form.dietary.trim()
      g.dietaryStatus = form.dietaryNone ? 'none' : form.dietary.trim() ? 'recorded' : 'not_captured'
      const next = [...guests, g]
      const nextServices = autoAllocateGuestOnServices(services, next.length)
      persist(next, nextServices)
      const nm =
        [form.first, form.last].filter(Boolean).join(' ').trim() || 'Unnamed Guest'
      pushPending(
        'Added',
        `${nm} (${form.role}${age != null ? `, age ${age}` : ''}) — auto-allocated to eligible service lines`,
      )
    }
    setForm(null)
    setBreachAck(false)
  }

  function confirmDelete() {
    if (!deleteId) return
    const idx = guests.findIndex((g) => g.id === deleteId)
    const g = guests[idx]
    if (!g || idx < 0) return
    const assigned = (assignments.get(g.id) || []).filter((id) => lines.some((l) => l.id === id))
    const locked = assigned.some((id) => lines.find((l) => l.id === id)?.locked)
    if (locked) return
    const next = guests.filter((x) => x.id !== deleteId)
    if (next.length && !next.some((x) => x.lead)) next[0] = { ...next[0], lead: true }
    const nextServices = removeGuestFromServices(services, idx)
    persist(next, nextServices)
    pushPending(
      'Deleted',
      `${guestDisplayName(g, guests)} removed — unassigned from ${assigned.length} line${assigned.length === 1 ? '' : 's'}, per-guest pricing recomputed`,
    )
    setDeleteId(null)
  }

  const deleteGuest = deleteId ? guests.find((g) => g.id === deleteId) : null
  const deleteLines = deleteGuest
    ? (assignments.get(deleteGuest.id) || [])
        .map((id) => lines.find((l) => l.id === id))
        .filter(Boolean) as ServiceLineRef[]
    : []
  const deleteBlocked = deleteLines.some((l) => l.locked)

  const panel = (
    <GuestDetailsPanel
      guests={guests}
      lines={lines}
      assignments={assignments}
      pending={pending}
      onClearPending={() => setPending([])}
      onAdd={openAdd}
      onEdit={openEdit}
      onDelete={(g) => setDeleteId(g.id)}
      deleteBlockedIds={deleteBlockedIds}
    />
  )

  const formAge = form && form.age !== '' ? Number(form.age) : null
  const eligibleCount =
    form && !form.id
      ? lines.filter((l) => formAge == null || Number.isNaN(formAge) || formAge >= l.minAge).length
      : 0
  const formBreaches = form ? breachesFor(form) : []
  const saveLabel = formBreaches.length
    ? breachAck
      ? 'Unassign & save'
      : 'Review conflicts'
    : form?.id
      ? 'Save changes'
      : 'Add guest'

  const formSheet = form ? (
    <>
      <div className="fixed inset-0 z-[72] bg-black/35" onClick={() => setForm(null)} />
      <div className="fixed bottom-0 right-0 top-0 z-[73] flex w-[460px] max-w-[100vw] flex-col bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.18)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E5E7EB] px-6 pb-4 pt-5">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight text-[#171717]">
              {form.id ? 'Edit guest' : 'Add guest'}
            </span>
            <span className="text-[12.5px] text-[#A1A1A1]">
              {form.id
                ? form.wasPlaceholder
                  ? 'Naming this guest updates every service line, rooming list and voucher'
                  : 'Changes are queued as a Pending Change'
                : 'Auto-allocated to every eligible line on save'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setForm(null)}
            className="flex size-[26px] items-center justify-center border-0 bg-transparent text-[#171717]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto px-6 py-5">
          <section className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Identity
            </span>
            <div className="inline-flex w-fit overflow-hidden rounded-lg border border-[#E5E7EB]">
              {SALS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, sal: s })
                    setBreachAck(false)
                  }}
                  className={cn(
                    'h-[34px] border-0 border-r border-[#E5E7EB] px-4 text-[13px] font-semibold last:border-r-0',
                    form.sal === s ? 'bg-[#931115] text-white' : 'bg-white text-[#525252]',
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#171717]">First name</span>
                <input
                  value={form.first}
                  onChange={(e) => {
                    setForm({ ...form, first: e.target.value })
                    setBreachAck(false)
                  }}
                  placeholder="Type here"
                  className="h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[#171717]">Last name</span>
                <input
                  value={form.last}
                  onChange={(e) => {
                    setForm({ ...form, last: e.target.value })
                    setBreachAck(false)
                  }}
                  placeholder="Type here"
                  className="h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
                />
              </label>
            </div>
            {!form.first && !form.last ? (
              <span className="text-[11.5px] text-[#A1A1A1]">
                Left blank, this guest stays a placeholder called “{form.role}{' '}
                {guests.filter((t) => bandToRole(t.ageBand) === form.role && t.id !== form.id).length +
                  1}
                ” and can still be allocated to lines.
              </span>
            ) : null}
          </section>

          <div className="border-t border-dashed border-[#E5E7EB]" />

          <section className="flex flex-col gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Role &amp; age
            </span>
            <div className="grid grid-cols-3 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, role: r })
                    setBreachAck(false)
                  }}
                  className={cn(
                    'h-[38px] rounded-lg border text-[13px] font-semibold',
                    form.role === r
                      ? 'border-[#931115] bg-[#FDF3F3] text-[#931115]'
                      : 'border-[#E5E7EB] bg-white text-[#525252]',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
            <span className="text-[11.5px] text-[#A1A1A1]">
              Suppliers apply their own age bands — CPS stores the role and age, and the band resolves
              per rate plan.
            </span>
            <label className="flex w-[120px] flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-[#171717]">Age</span>
              <input
                type="number"
                min={0}
                value={form.age}
                onChange={(e) => {
                  setForm({ ...form, age: e.target.value })
                  setBreachAck(false)
                }}
                placeholder="—"
                className="h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
              />
            </label>
            {ageHint(form) ? (
              <span className="text-[11.5px] text-[#B45309]">{ageHint(form)}</span>
            ) : null}
          </section>

          <div className="border-t border-dashed border-[#E5E7EB]" />

          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Dietary &amp; special requirements
            </span>
            <label className="flex w-fit items-center gap-1.5 text-[12.5px] font-medium text-[#525252]">
              <input
                type="checkbox"
                checked={form.dietaryNone}
                onChange={(e) =>
                  setForm({
                    ...form,
                    dietaryNone: e.target.checked,
                    dietary: e.target.checked ? '' : form.dietary,
                  })
                }
              />
              No requirements
            </label>
            <textarea
              value={form.dietary}
              onChange={(e) =>
                setForm({
                  ...form,
                  dietary: e.target.value,
                  dietaryNone: false,
                })
              }
              disabled={form.dietaryNone}
              placeholder={form.dietaryNone ? 'None — untick above to record a requirement' : 'No requirements'}
              className={cn(
                'min-h-[84px] resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#171717] outline-none',
                form.dietaryNone && 'opacity-50',
              )}
            />
            <span className="text-[11.5px] text-[#A1A1A1]">
              Captured once here and reused on every voucher for this guest across all suppliers.
            </span>
          </section>

          <section className="flex flex-col gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Internal note</span>
            <textarea
              value={form.note}
              onChange={(e) => {
                setForm({ ...form, note: e.target.value })
                setBreachAck(false)
              }}
              placeholder="Type here"
              className="min-h-[64px] resize-y rounded-lg border border-[#E5E7EB] bg-white px-3 py-2.5 text-sm leading-relaxed text-[#171717] outline-none"
            />
            <span className="text-[11.5px] text-[#A1A1A1]">Planner-only — not printed on supplier vouchers.</span>
          </section>

          {!form.id ? (
            <div className="flex items-start gap-2 rounded-lg border border-[#EEF0F2] bg-[#F9FAFB] px-3 py-2.5">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#0369A1"
                strokeWidth="2"
                className="mt-0.5 shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="text-[12.5px] leading-relaxed text-[#525252]">
                On save this guest is allocated automatically to {eligibleCount} of {lines.length}{' '}
                service lines. Lines with a higher minimum age are skipped.
              </span>
            </div>
          ) : null}

          {formBreaches.length > 0 ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-3">
              <span className="text-[13px] font-bold text-[#991B1B]">
                This change breaks {formBreaches.length} existing assignment
                {formBreaches.length === 1 ? '' : 's'}
              </span>
              {formBreaches.map((b) => (
                <span key={b.id} className="text-[12.5px] leading-relaxed text-[#991B1B]">
                  · {b.label} — minimum age {b.minAge}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#E5E7EB] px-6 py-3.5">
          <span className="text-[11.5px] text-[#A1A1A1]">Saved as a Pending Change</span>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#525252]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveForm}
              className="h-[38px] rounded-lg border-0 bg-[#931115] px-[18px] text-[13px] font-semibold text-white"
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  ) : null

  const deleteModal = deleteGuest ? (
    <>
      <div className="fixed inset-0 z-[80] bg-black/45" onClick={() => setDeleteId(null)} />
      <div className="fixed left-1/2 top-1/2 z-[81] flex w-[440px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-xl bg-white shadow-[0_20px_60px_rgba(0,0,0,0.3)]">
        <div className="flex items-start gap-3 px-6 pb-3.5 pt-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FEF2F2]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#931115" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-base font-bold text-[#171717]">
              Delete {guestDisplayName(deleteGuest, guests)}?
            </span>
            <span className="text-[13px] leading-relaxed text-[#525252]">
              {deleteBlocked
                ? 'This guest sits on a confirmed line, so they can no longer be deleted from the itinerary.'
                : 'They will be removed from the guest list and unassigned from every line below.'}
            </span>
          </div>
        </div>
        <div className="px-6 pb-4">
          <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
            <div className="bg-[#F9FAFB] px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              Will be unassigned from
            </div>
            <div className="max-h-[180px] overflow-y-auto">
              {deleteLines.length === 0 ? (
                <div className="border-t border-[#F1F1F2] px-3 py-2 text-[12.5px] text-[#A1A1A1]">
                  No service lines
                </div>
              ) : (
                deleteLines.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between gap-2.5 border-t border-[#F1F1F2] px-3 py-2"
                  >
                    <span className="min-w-0 truncate text-[12.5px] text-[#171717]">{l.label}</span>
                    <span
                      className={cn(
                        'inline-flex h-4 items-center rounded-full px-1.5 text-[9.5px] font-bold uppercase tracking-wide',
                        l.locked
                          ? 'bg-[rgba(0,212,146,0.14)] text-[#067A55]'
                          : 'bg-[#F4F4F5] text-[#A1A1A1]',
                      )}
                    >
                      {l.locked ? l.status : 'Editable'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
          {deleteBlocked ? (
            <div className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#991B1B]">
              Blocked — {deleteLines.filter((l) => l.locked).length} confirmed line
              {deleteLines.filter((l) => l.locked).length === 1 ? '' : 's'} in the list above. Raise a
              change request first, or unassign the guest from the remaining draft lines instead.
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-[#EEF0F2] bg-[#F9FAFB] px-3 py-2.5 text-[12.5px] leading-relaxed text-[#525252]">
              Per-guest pricing on {deleteLines.length} line
              {deleteLines.length === 1 ? '' : 's'} will be recomputed, and minimum-pax rules
              re-checked, when the Pending Change is applied.
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2.5 border-t border-[#E5E7EB] px-6 py-3.5">
          <button
            type="button"
            onClick={() => setDeleteId(null)}
            className="h-[38px] rounded-lg border border-[#E5E7EB] bg-white px-4 text-[13px] font-semibold text-[#525252]"
          >
            {deleteBlocked ? 'Close' : 'Cancel'}
          </button>
          {!deleteBlocked ? (
            <button
              type="button"
              onClick={confirmDelete}
              className="h-[38px] rounded-lg border-0 bg-[#931115] px-[18px] text-[13px] font-semibold text-white"
            >
              Delete traveller
            </button>
          ) : null}
        </div>
      </div>
    </>
  ) : null

  if (inline) {
    return (
      <>
        <div className="min-h-full bg-[#F9FAFB] px-4 py-4 pb-10">{panel}</div>
        {formSheet}
        {deleteModal}
      </>
    )
  }

  return (
    <>
      <div className="fixed inset-0 z-[68] bg-black/35" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-[69] flex w-[840px] max-w-[100vw] flex-col bg-[#F9FAFB] shadow-[-10px_0_40px_rgba(0,0,0,0.18)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E5E7EB] bg-white px-6 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight text-[#171717]">Guests Details</span>
            <span className="text-[12.5px] text-[#A1A1A1]">
              Guest list for {itinerary.reference} — shared across every service on this itinerary
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-[26px] items-center justify-center border-0 bg-transparent text-[#171717]"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">{panel}</div>
      </div>
      {formSheet}
      {deleteModal}
    </>
  )
}

/** Compact Guests toolbar button matching Two Panel Display. */
export function GuestsToolbarButton({
  count,
  hasIssues,
  onClick,
}: {
  count: number
  hasIssues?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-[13px] font-semibold text-[#171717]"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 21a8 8 0 0 0-16 0" />
        <circle cx="10" cy="8" r="5" />
        <path d="M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" />
      </svg>
      Guests
      <span className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#E5E7EB] px-1 text-[11px] font-bold text-[#525252]">
        {count}
      </span>
      {hasIssues ? <span className="size-[7px] rounded-full bg-[#F59E0B]" /> : null}
    </button>
  )
}

export function guestHasIssues(guests: GuestDetail[], lineCount: number, assignedZero: number): boolean {
  if (guests.some(isPlaceholderGuest)) return true
  if (guests.some((g) => g.age == null)) return true
  if (lineCount > 0 && assignedZero > 0) return true
  return false
}

export function guestIssueHint(guests: GuestDetail[]): boolean {
  return (
    guests.some(isPlaceholderGuest) ||
    guests.some((g) => g.age == null) ||
    guests.length === 0
  )
}
