import { useEffect, useMemo, useState } from 'react'
import { buildGuestDetailsFromCreateInput } from '@/shared/lib/helpers'
import type { CreateItineraryInput, GuestDetail } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import { GuestDetailsPanel } from './GuestDetailsPanel'
import {
  bandToRole,
  blankGuest,
  guestDisplayName,
  isPlaceholderGuest,
  roleToBand,
  type GuestPendingChange,
  type GuestRole,
} from './guestUtils'

interface DraftGuestDetailsSheetProps {
  open: boolean
  onClose: () => void
  input: CreateItineraryInput
  guests: GuestDetail[]
  onChange: (guests: GuestDetail[]) => void
}

interface GuestFormState {
  id: string | null
  wasPlaceholder: boolean
  sal: string
  first: string
  last: string
  role: GuestRole
  age: string
  note: string
}

const SALS = ['Mrs.', 'Ms.', 'Mr.'] as const
const ROLES: GuestRole[] = ['Adult', 'Child', 'Infant']

function normalizeSal(s?: string): string {
  const raw = String(s || 'Mr').replace(/\.$/, '')
  if (raw === 'Mrs') return 'Mrs.'
  if (raw === 'Ms') return 'Ms.'
  return 'Mr.'
}

/** Guest roster sheet for Create Itinerary (no service lines yet). */
export function DraftGuestDetailsSheet({
  open,
  onClose,
  input,
  guests,
  onChange,
}: DraftGuestDetailsSheetProps) {
  const [form, setForm] = useState<GuestFormState | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [pending, setPending] = useState<GuestPendingChange[]>([])
  const emptyAssignments = useMemo(() => new Map<string, string[]>(), [])

  useEffect(() => {
    if (!open) return
    if (guests.length === 0) {
      onChange(buildGuestDetailsFromCreateInput(input))
    }
    setForm(null)
    setDeleteId(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open) return null

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
    })
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
    })
  }

  function saveForm() {
    if (!form) return
    const age = form.age === '' ? undefined : Number(form.age)
    if (form.id) {
      const prev = guests.find((g) => g.id === form.id)
      const next = guests.map((g) =>
        g.id !== form.id
          ? g
          : {
              ...g,
              salutation: form.sal.replace(/\.$/, ''),
              firstName: form.first.trim(),
              lastName: form.last.trim(),
              ageBand: roleToBand(form.role),
              age,
              note: form.note,
            },
      )
      onChange(next)
      const nm = [form.first, form.last].filter(Boolean).join(' ').trim() || 'Unnamed Guest'
      if (prev && form.wasPlaceholder && nm !== 'Unnamed Guest') {
        setPending((p) => [
          ...p,
          {
            id: `pc-${Date.now()}`,
            kind: 'Named',
            text: `${guestDisplayName(prev, guests)} → ${nm}`,
          },
        ])
      }
    } else {
      const g = blankGuest(form.role)
      g.salutation = form.sal.replace(/\.$/, '')
      g.firstName = form.first.trim()
      g.lastName = form.last.trim()
      g.age = age
      g.note = form.note
      onChange([...guests, g])
      setPending((p) => [
        ...p,
        {
          id: `pc-${Date.now()}`,
          kind: 'Added',
          text: `${[form.first, form.last].filter(Boolean).join(' ').trim() || 'Unnamed Guest'} (${form.role})`,
        },
      ])
    }
    setForm(null)
  }

  function confirmDelete() {
    if (!deleteId) return
    const g = guests.find((x) => x.id === deleteId)
    const next = guests.filter((x) => x.id !== deleteId)
    if (next.length && !next.some((x) => x.lead)) next[0] = { ...next[0], lead: true }
    onChange(next)
    if (g) {
      setPending((p) => [
        ...p,
        {
          id: `pc-${Date.now()}`,
          kind: 'Deleted',
          text: `${guestDisplayName(g, guests)} removed`,
        },
      ])
    }
    setDeleteId(null)
  }

  const deleteGuest = deleteId ? guests.find((g) => g.id === deleteId) : null

  return (
    <>
      <div className="fixed inset-0 z-[90] bg-black/35" onClick={onClose} />
      <div className="fixed bottom-0 right-0 top-0 z-[91] flex w-[840px] max-w-[100vw] flex-col bg-[#F9FAFB] shadow-[-10px_0_40px_rgba(0,0,0,0.18)]">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E5E7EB] bg-white px-6 py-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="text-lg font-bold tracking-tight text-[#171717]">Guests Details</span>
            <span className="text-[12.5px] text-[#A1A1A1]">
              Name guests now, or leave placeholders and finish later
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
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 pb-8">
          <GuestDetailsPanel
            guests={guests}
            lines={[]}
            assignments={emptyAssignments}
            pending={pending}
            onClearPending={() => setPending([])}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={(g) => setDeleteId(g.id)}
          />
        </div>
      </div>

      {form ? (
        <>
          <div className="fixed inset-0 z-[92] bg-black/35" onClick={() => setForm(null)} />
          <div className="fixed bottom-0 right-0 top-0 z-[93] flex w-[460px] max-w-[100vw] flex-col bg-white shadow-[-10px_0_40px_rgba(0,0,0,0.18)]">
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#E5E7EB] px-6 pb-4 pt-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-lg font-bold tracking-tight text-[#171717]">
                  {form.id ? 'Edit guest' : 'Add guest'}
                </span>
                <span className="text-[12.5px] text-[#A1A1A1]">
                  Counts alone are enough — names can wait until after create
                </span>
              </div>
              <button
                type="button"
                onClick={() => setForm(null)}
                className="flex size-[26px] items-center justify-center border-0 bg-transparent"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              <div className="inline-flex w-fit overflow-hidden rounded-lg border border-[#E5E7EB]">
                {SALS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm({ ...form, sal: s })}
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
                  <span className="text-[13px] font-semibold">First name</span>
                  <input
                    value={form.first}
                    onChange={(e) => setForm({ ...form, first: e.target.value })}
                    placeholder="Type here"
                    className="h-[38px] rounded-lg border border-[#E5E7EB] px-3 text-sm outline-none"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">Last name</span>
                  <input
                    value={form.last}
                    onChange={(e) => setForm({ ...form, last: e.target.value })}
                    placeholder="Type here"
                    className="h-[38px] rounded-lg border border-[#E5E7EB] px-3 text-sm outline-none"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {ROLES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, role: r })}
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
              <label className="flex w-[120px] flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Age</span>
                <input
                  type="number"
                  min={0}
                  value={form.age}
                  onChange={(e) => setForm({ ...form, age: e.target.value })}
                  placeholder="—"
                  className="h-[38px] rounded-lg border border-[#E5E7EB] px-3 text-sm outline-none"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">Note</span>
                <textarea
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Type here"
                  className="min-h-[84px] resize-y rounded-lg border border-[#E5E7EB] px-3 py-2.5 text-sm outline-none"
                />
              </label>
            </div>
            <div className="flex shrink-0 justify-end gap-2.5 border-t border-[#E5E7EB] px-6 py-3.5">
              <button
                type="button"
                onClick={() => setForm(null)}
                className="h-[38px] rounded-lg border border-[#E5E7EB] px-4 text-[13px] font-semibold text-[#525252]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveForm}
                className="h-[38px] rounded-lg border-0 bg-[#931115] px-[18px] text-[13px] font-semibold text-white"
              >
                {form.id ? 'Save changes' : 'Add guest'}
              </button>
            </div>
          </div>
        </>
      ) : null}

      {deleteGuest ? (
        <>
          <div className="fixed inset-0 z-[94] bg-black/45" onClick={() => setDeleteId(null)} />
          <div className="fixed left-1/2 top-1/2 z-[95] w-[400px] max-w-[calc(100vw-48px)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-6 shadow-2xl">
            <p className="text-base font-bold text-[#171717]">
              Delete {guestDisplayName(deleteGuest, guests)}?
            </p>
            <p className="mt-2 text-[13px] text-[#525252]">
              They will be removed from the guest list for this itinerary.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                className="h-[38px] rounded-lg border border-[#E5E7EB] px-4 text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="h-[38px] rounded-lg border-0 bg-[#931115] px-[18px] text-[13px] font-semibold text-white"
              >
                Delete traveller
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  )
}
