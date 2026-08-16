import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/app/store'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { buildGuestDetailsFromCreateInput, nextChildReference } from '@/shared/lib/helpers'
import type { GuestDetail, GuestResidency, SplitForm } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import {
  bandToRole,
  blankGuest,
  guestDisplayName,
  guestInitials,
  isPlaceholderGuest,
  roleChipClass,
  roleToBand,
  type GuestRole,
} from '@/features/guests/guestUtils'

interface Props {
  open: boolean
  parentRef: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (parentRef: string, form: SplitForm) => void
}

const RESIDENCY_LABEL: Record<GuestResidency, string> = {
  citizen: 'Citizen',
  resident: 'Resident',
  nonResident: 'Non-Resident',
}

const ROLE_GROUPS: { role: GuestRole; label: string }[] = [
  { role: 'Adult', label: 'Adults' },
  { role: 'Child', label: 'Children' },
  { role: 'Infant', label: 'Infants' },
]

const ROLES: GuestRole[] = ['Adult', 'Child', 'Infant']

const RESIDENCIES: GuestResidency[] = ['citizen', 'resident', 'nonResident']

/** Single grid template shared by the Guest Details header row and every guest row, so
 * columns (avatar / First Name / Last Name / PAX Type / Residency / Age / delete) stay
 * pixel-aligned regardless of row content — the Age track is always reserved, even for
 * Adult/Infant rows that render a static value instead of an input. */
const GUEST_ROW_GRID = 'grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_92px_128px_64px_28px]'

function bucketOf(guests: GuestDetail[], role: GuestRole, residency: GuestResidency): GuestDetail[] {
  return guests.filter(
    (g) => bandToRole(g.ageBand) === role && (g.residency || 'nonResident') === residency,
  )
}

/** Default age seeded when a guest's role changes and their current age no longer fits the new
 * band — mirrors blankGuest's per-role defaults so a role switch doesn't leave a stale age. */
function defaultAgeForRole(role: GuestRole, currentAge?: number): number {
  if (role === 'Child') return currentAge != null && currentAge >= 2 && currentAge <= 17 ? currentAge : 8
  if (role === 'Adult') return currentAge ?? 34
  return currentAge ?? 1
}

export function SplitItineraryDialog({ open, parentRef, onOpenChange, onConfirm }: Props) {
  const { itineraries, getGuestDetails } = useStore()
  const parent = useMemo(
    () => (parentRef ? itineraries.find((it) => it.reference === parentRef) : undefined),
    [itineraries, parentRef],
  )

  const [family, setFamily] = useState('')
  const [guests, setGuests] = useState<GuestDetail[]>([])
  // Roster is the sole source of truth (Confluence "Split & Options" v6 / PCP-1519 / PCP-1523):
  // no count spinners anywhere in this dialog, and a removal always routes through this one
  // confirm step — only one guest can be queued for removal at a time.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !parent) return
    const title = parent.title || 'Untitled Itinerary'
    setFamily(title ? `Copy ${title}` : '')

    const sourceRoster = getGuestDetails(parent.id)
    if (sourceRoster.length > 0) {
      setGuests(structuredClone(sourceRoster))
    } else {
      // Known prototype gap: some itineraries predate the guest-details store, so there's no
      // named roster to copy. Fall back to synthesizing placeholders from the parent's pax
      // breakdown so Split still shows a real (editable) roster instead of nothing.
      setGuests(
        buildGuestDetailsFromCreateInput({
          title: parent.title || '',
          agency: parent.agency || '',
          agent: parent.agent || '',
          leadFirst: parent.leadFirst || '',
          leadLast: parent.leadLast || '',
          destinations: parent.destinations || [],
          travelDateFrom: parent.travelDateFrom,
          travelDateTo: parent.travelDateTo,
          adultsCitizen: parent.adultsCitizen ?? 0,
          adultsRes: parent.adultsRes ?? 0,
          adultsNonRes: parent.adultsNonRes ?? parent.paxAdults ?? parent.adults ?? 2,
          childrenCitizen: parent.childrenCitizen ?? 0,
          childrenRes: parent.childrenRes ?? 0,
          childrenNonRes: parent.childrenNonRes ?? parent.paxChildren ?? parent.children ?? 0,
          infantsCitizen: parent.infantsCitizen ?? 0,
          infantsRes: parent.infantsRes ?? 0,
          infantsNonRes: parent.infantsNonRes ?? parent.infants ?? 0,
          childAges: parent.childAges || [],
        }),
      )
    }
    setPendingDeleteId(null)
  }, [open, parent, getGuestDetails])

  const newId = parentRef ? nextChildReference(parentRef, itineraries) : ''
  const masterId = parentRef || ''

  const adultsTotal = guests.filter((g) => g.ageBand === 'adult').length
  const childrenTotal = guests.filter((g) => g.ageBand === 'child').length
  const infantsTotal = guests.filter((g) => g.ageBand === 'infant').length
  const childGuests = guests.filter((g) => g.ageBand === 'child')

  function addGuest() {
    // Same placeholder-seeding pattern as Create Itinerary's draft roster: the row appears
    // immediately, editable in place — no form has to be filled in first.
    setGuests((prev) => [...prev, blankGuest('Adult')])
  }

  function updateGuestName(id: string, field: 'firstName' | 'lastName', value: string) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, [field]: value } : g)))
  }

  function updateGuestRole(id: string, role: GuestRole) {
    setGuests((prev) =>
      prev.map((g) =>
        g.id === id ? { ...g, ageBand: roleToBand(role), age: defaultAgeForRole(role, g.age) } : g,
      ),
    )
  }

  function updateGuestResidency(id: string, residency: GuestResidency) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, residency } : g)))
  }

  function updateChildAge(id: string, age: number | undefined) {
    setGuests((prev) => prev.map((g) => (g.id === id ? { ...g, age } : g)))
  }

  /** Every removal — placeholder or named — routes through the confirm dialog below. No silent
   * deletes, no exceptions (Confluence "Split & Options" v6, requirement 4). */
  function requestGuestRemoval(g: GuestDetail) {
    setPendingDeleteId(g.id)
  }

  function confirmRemoval() {
    if (!pendingDeleteId) return
    setGuests((prev) => {
      const next = prev.filter((g) => g.id !== pendingDeleteId)
      // Keep a lead traveler set on the roster so the split itinerary's lead name doesn't
      // silently fall back to array order once the flagged lead is removed.
      if (next.length && !next.some((g) => g.lead)) next[0] = { ...next[0], lead: true }
      return next
    })
    setPendingDeleteId(null)
  }

  function cancelRemoval() {
    setPendingDeleteId(null)
  }

  const pendingDeleteGuest = pendingDeleteId ? guests.find((g) => g.id === pendingDeleteId) ?? null : null

  function handleConfirm() {
    if (!parentRef) return
    const form: SplitForm = {
      family,
      adultsCitizen: bucketOf(guests, 'Adult', 'citizen').length,
      adultsRes: bucketOf(guests, 'Adult', 'resident').length,
      adultsNonRes: bucketOf(guests, 'Adult', 'nonResident').length,
      childrenCitizen: bucketOf(guests, 'Child', 'citizen').length,
      childrenRes: bucketOf(guests, 'Child', 'resident').length,
      childrenNonRes: bucketOf(guests, 'Child', 'nonResident').length,
      infantsCitizen: bucketOf(guests, 'Infant', 'citizen').length,
      infantsRes: bucketOf(guests, 'Infant', 'resident').length,
      infantsNonRes: bucketOf(guests, 'Infant', 'nonResident').length,
      childAges: childGuests.map((g) => g.age ?? 8),
      guests,
    }
    onConfirm(parentRef, form)
    onOpenChange(false)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100vh-48px)] w-full max-w-[640px] flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="shrink-0 space-y-1 border-b border-[#EEF0F2] px-6 py-[18px]">
            <DialogTitle className="text-[17px] font-bold text-[#171717]">Split into new itinerary</DialogTitle>
            <DialogDescription className="text-[13px] font-medium text-[#A1A1A1]">
              New itinerary <span className="font-bold text-[#931115]">{newId}</span> from{' '}
              <span className="font-bold text-[#171717]">{masterId}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div className="grid gap-1.5">
              <Label htmlFor="split-family" className="text-[13px] font-semibold text-[#171717]">
                Itinerary title<span className="text-[#931115]">*</span>
              </Label>
              <Input
                id="split-family"
                value={family}
                onChange={(e) => setFamily(e.target.value)}
                placeholder="e.g. Copy Whitfield Family"
                className="h-10"
              />
            </div>

            {/* Read-only, computed live from the roster below — there is no editable total
                anywhere in this dialog (requirement 6). */}
            <div className="overflow-hidden rounded-lg border border-[#EEF0F2]">
              <table className="w-full border-collapse text-[12.5px]">
                <caption className="sr-only">
                  Guest totals by PAX type and residency, computed live from the guest roster below
                </caption>
                <thead>
                  <tr className="border-b border-[#EEF0F2] bg-[#F9FAFB] text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                    <th scope="col" className="px-3.5 py-2 text-left">
                      PAX Type
                    </th>
                    {RESIDENCIES.map((r) => (
                      <th key={r} scope="col" className="px-3 py-2 text-right">
                        {RESIDENCY_LABEL[r]}
                      </th>
                    ))}
                    <th scope="col" className="px-3.5 py-2 text-right">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROLE_GROUPS.map(({ role, label }) => {
                    const total = role === 'Adult' ? adultsTotal : role === 'Child' ? childrenTotal : infantsTotal
                    return (
                      <tr key={role} className="border-b border-[#F1F1F2] last:border-b-0">
                        <th
                          scope="row"
                          className="px-3.5 py-2 text-left text-[13px] font-semibold text-[#171717]"
                        >
                          {label}
                          {role === 'Adult' ? <span className="text-[#931115]"> *</span> : null}
                        </th>
                        {RESIDENCIES.map((r) => (
                          <td key={r} className="px-3 py-2 text-right tabular-nums text-[#525252]">
                            {bucketOf(guests, role, r).length}
                          </td>
                        ))}
                        <td className="px-3.5 py-2 text-right text-[13px] font-bold tabular-nums text-[#171717]">
                          {total}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="overflow-hidden rounded-lg border border-[#EEF0F2]">
              <div className="flex items-center justify-between gap-3 border-b border-[#EEF0F2] bg-[#F9FAFB] px-3.5 py-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                  Guest Details ({guests.length})
                </span>
                <button
                  type="button"
                  onClick={addGuest}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border-0 bg-[#931115] px-2.5 text-[11.5px] font-semibold text-white"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14" />
                    <path d="M12 5v14" />
                  </svg>
                  Add guest
                </button>
              </div>
              {guests.length === 0 ? (
                <div className="px-3.5 py-6 text-center text-[12.5px] text-[#A1A1A1]">
                  No guests yet — use Add guest to start the roster.
                </div>
              ) : (
                <>
                  {/* Column headers for the roster grid below. Shares the exact same grid
                      template as each row (GUEST_ROW_GRID) so labels stay pixel-aligned with
                      their fields regardless of whether a given row has an editable Age field —
                      that column's track width is reserved by the grid whether or not a row
                      fills it (Adult/Infant rows show a static value or dash, not an input). */}
                  <div
                    className={cn(
                      GUEST_ROW_GRID,
                      'items-center gap-2 border-b border-[#EEF0F2] bg-[#F9FAFB] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]',
                    )}
                  >
                    <span aria-hidden="true" />
                    <span>First Name</span>
                    <span>Last Name</span>
                    <span>PAX Type</span>
                    <span>Residency</span>
                    <span className="text-center">Age</span>
                    <span aria-hidden="true" />
                  </div>
                  <div className="divide-y divide-[#F1F1F2]">
                    {guests.map((g) => {
                      const role = bandToRole(g.ageBand)
                      const placeholder = isPlaceholderGuest(g)
                      const name = guestDisplayName(g, guests)
                      // Adults total can never reach 0 — the remove action is unavailable on the
                      // last remaining Adult, expressed as a disabled control (requirement 5).
                      const isLastAdult = role === 'Adult' && adultsTotal <= 1
                      return (
                        <div
                          key={g.id}
                          className={cn(GUEST_ROW_GRID, 'items-center gap-2 px-3.5 py-2.5')}
                        >
                          <span
                            className={cn(
                              'inline-flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                              placeholder ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F4F4F5] text-[#525252]',
                            )}
                          >
                            {guestInitials(g, guests)}
                          </span>
                          <Input
                            aria-label={`First name — ${name}`}
                            value={g.firstName}
                            onChange={(e) => updateGuestName(g.id, 'firstName', e.target.value)}
                            placeholder="First name"
                            className="h-8 min-w-0 text-[13px]"
                          />
                          <Input
                            aria-label={`Last name — ${name}`}
                            value={g.lastName}
                            onChange={(e) => updateGuestName(g.id, 'lastName', e.target.value)}
                            placeholder="Last name"
                            className="h-8 min-w-0 text-[13px]"
                          />
                          <Select
                            value={role}
                            onValueChange={(v) => updateGuestRole(g.id, v as GuestRole)}
                            disabled={isLastAdult}
                          >
                            <SelectTrigger
                              aria-label={`PAX Type — ${name}`}
                              title={isLastAdult ? 'At least one Adult is required' : undefined}
                              className={cn(
                                'h-8 w-full border-0 text-[11.5px] font-bold',
                                roleChipClass(role),
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {r}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Select
                            value={g.residency || 'nonResident'}
                            onValueChange={(v) => updateGuestResidency(g.id, v as GuestResidency)}
                          >
                            <SelectTrigger
                              aria-label={`Residency — ${name}`}
                              className="h-8 w-full min-w-0 bg-white px-2 text-[11.5px] [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
                            >
                              <SelectValue placeholder="Residency" />
                            </SelectTrigger>
                            <SelectContent>
                              {RESIDENCIES.map((r) => (
                                <SelectItem key={r} value={r} className="text-[12.5px]">
                                  {RESIDENCY_LABEL[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {role === 'Child' ? (
                            <Input
                              type="number"
                              min={2}
                              max={17}
                              inputMode="numeric"
                              aria-label={`Age — ${name}`}
                              value={g.age ?? ''}
                              onChange={(e) => {
                                // Let the user type freely (e.g. clear the field, or the first
                                // keystroke of "12") without clamping mid-entry — an ignored
                                // empty string would otherwise snap the controlled value back
                                // before the next keystroke lands. Range is enforced on blur.
                                const raw = e.target.value
                                if (raw === '') {
                                  updateChildAge(g.id, undefined)
                                  return
                                }
                                const parsed = Number(raw)
                                if (Number.isNaN(parsed)) return
                                updateChildAge(g.id, parsed)
                              }}
                              onBlur={(e) => {
                                const parsed = Number(e.target.value)
                                const clamped =
                                  e.target.value === '' || Number.isNaN(parsed)
                                    ? 8
                                    : Math.min(17, Math.max(2, parsed))
                                if (clamped !== g.age) updateChildAge(g.id, clamped)
                              }}
                              className="h-8 min-w-0 text-center text-[12.5px]"
                            />
                          ) : (
                            <span className="text-center text-[12.5px] text-[#525252]">
                              {g.age ?? '—'}
                            </span>
                          )}
                          <button
                            type="button"
                            title={isLastAdult ? 'At least one Adult is required' : 'Remove guest'}
                            aria-label={
                              isLastAdult
                                ? `Cannot remove ${name} — at least one Adult is required`
                                : `Remove ${name}`
                            }
                            disabled={isLastAdult}
                            onClick={() => requestGuestRemoval(g)}
                            className={cn(
                              'flex size-7 shrink-0 items-center justify-center rounded-[7px] border',
                              isLastAdult
                                ? 'cursor-not-allowed border-[#F1F1F2] bg-[#FAFAFA] text-[#D4D4D8]'
                                : 'border-[#F4E2E3] bg-white text-[#931115]',
                            )}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>

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
              <span className="text-xs font-medium leading-relaxed text-[#525252]">
                Title, guests, dates and services are copied from {masterId}. Edit names, PAX type, residency
                or age directly in the roster above, or finish later on the new itinerary&apos;s guest list and
                services table.
              </span>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-[#EEF0F2] px-6 py-3.5 sm:justify-between">
            <span />
            <div className="flex gap-2.5">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#931115] text-white hover:bg-[#7a0e11]"
                onClick={handleConfirm}
                disabled={!parentRef || !family.trim() || adultsTotal < 1}
              >
                Create & edit services
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Explicit confirm step for every removal — placeholder or named, no exceptions
          (requirement 4). Nested shadcn Dialog reuses the same primitive as the parent dialog
          rather than inventing a second confirm-modal pattern. */}
      <Dialog open={!!pendingDeleteGuest} onOpenChange={(o) => !o && cancelRemoval()}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold text-[#171717]">
              Remove {pendingDeleteGuest ? guestDisplayName(pendingDeleteGuest, guests) : 'guest'}?
            </DialogTitle>
            <DialogDescription>
              {pendingDeleteGuest && isPlaceholderGuest(pendingDeleteGuest)
                ? 'This placeholder row will be removed from the roster.'
                : 'This guest will be removed from the roster. This can’t be undone.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cancelRemoval}>
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-[#931115] text-white hover:bg-[#7a0e11]"
              onClick={confirmRemoval}
            >
              Remove guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
