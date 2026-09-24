import type { ReactNode } from 'react'
import { guestRoleLabel } from '@/shared/lib/helpers'
import type { GuestDetail, Itinerary } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'
import {
  buildGuestIssues,
  coverageForGuest,
  dietaryRequirementsLabel,
  guestDisplayName,
  guestInitials,
  isPlaceholderGuest,
  roleChipClass,
  type GuestCoverage,
  type GuestPendingChange,
  type ServiceLineRef,
} from './guestUtils'

interface GuestDetailsPanelProps {
  itinerary?: Pick<
    Itinerary,
    'agency' | 'invoiceAddresseeType' | 'invoiceAddresseeGuestId'
  >
  guests: GuestDetail[]
  lines: ServiceLineRef[]
  assignments: Map<string, string[]>
  pending?: GuestPendingChange[]
  onClearPending?: () => void
  onAdd: () => void
  onEdit: (guest: GuestDetail) => void
  onDelete: (guest: GuestDetail) => void
  deleteBlockedIds?: Set<string>
}

export function GuestDetailsPanel({
  itinerary,
  guests,
  lines,
  assignments,
  pending = [],
  onClearPending,
  onAdd,
  onEdit,
  onDelete,
  deleteBlockedIds,
}: GuestDetailsPanelProps) {
  const counts = { Adult: 0, Child: 0, Infant: 0 }
  guests.forEach((g) => {
    const role = guestRoleLabel(g.ageBand)
    counts[role as keyof typeof counts] += 1
  })
  const unnamed = guests.filter(isPlaceholderGuest)
  const lead = guests.find((g) => g.lead)
  const ages = guests
    .map((g) => g.age)
    .filter((a): a is number => a != null && !Number.isNaN(Number(a)))
    .sort((a, b) => a - b)
  const noAge = guests.filter((g) => g.age == null || Number.isNaN(Number(g.age))).length

  const unassigned = guests.filter((g) => {
    const c = coverageForGuest(g.id, assignments, lines)
    return lines.length > 0 && c.assigned === 0
  })
  const partial = guests.filter((g) => {
    const c = coverageForGuest(g.id, assignments, lines)
    return c.assigned > 0 && c.assigned < c.total
  })

  const roleBreakdown = (() => {
    const base = [
      counts.Adult ? `${counts.Adult} adult${counts.Adult === 1 ? '' : 's'}` : '',
      counts.Child ? `${counts.Child} child${counts.Child === 1 ? '' : 'ren'}` : '',
      counts.Infant ? `${counts.Infant} infant${counts.Infant === 1 ? '' : 's'}` : '',
    ]
      .filter(Boolean)
      .join(' · ') || 'No guests yet'
    return unnamed.length ? `${base} · ${unnamed.length} to name` : base
  })()

  const coverageColor = unassigned.length
    ? '#931115'
    : partial.length
      ? '#B45309'
      : '#16A34A'
  const coverageSub = unassigned.length
    ? `${unassigned.length} guest${unassigned.length === 1 ? '' : 's'} unassigned`
    : partial.length
      ? `${partial.length} partially allocated`
      : 'All guests fully allocated'

  const issues = buildGuestIssues(guests, assignments, lines, itinerary)

  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(178px,1fr))] gap-3">
        <SummaryCard
          label="Guests"
          value={<span className="text-[26px] font-bold leading-none text-[#171717]">{guests.length}</span>}
          sub={roleBreakdown}
        />
        <SummaryCard
          label="Lead Traveler"
          value={
            <span className="text-[15px] font-bold text-[#171717]">
              {lead ? guestDisplayName(lead, guests) : 'Not set'}
            </span>
          }
          sub={
            lead
              ? `${guestRoleLabel(lead.ageBand)}${lead.age != null ? ` · ${lead.age} y.o.` : ''}`
              : 'Set a lead traveler for documents'
          }
        />
        <SummaryCard
          label="Ages"
          value={
            <span className="text-[15px] font-bold text-[#171717]">
              {ages.length ? ages.join(', ') : '—'}
            </span>
          }
          sub={noAge ? `${noAge} without an age` : 'All ages captured'}
        />
        <SummaryCard
          label="Line coverage"
          value={
            <span className="text-[15px] font-bold text-[#171717]">
              {lines.length} service line{lines.length === 1 ? '' : 's'}
            </span>
          }
          sub={coverageSub}
          subColor={coverageColor}
        />
      </div>

      {issues.length > 0 ? (
        <div className="flex items-start gap-2.5 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#B45309"
            strokeWidth="2"
            className="mt-0.5 shrink-0"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-bold text-[#92400E]">
              {issues.length} thing{issues.length === 1 ? '' : 's'} to resolve before documents
            </span>
            {issues.map((iss) => (
              <span key={iss.text} className="text-[12.5px] leading-relaxed text-[#92400E]">
                · {iss.text}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {pending.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-[10px] border border-[#BFDBFE] bg-[#EFF6FF] px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-bold text-[#1E40AF]">
              Pending changes ({pending.length})
            </span>
            {onClearPending ? (
              <button
                type="button"
                onClick={onClearPending}
                className="border-0 bg-transparent p-0 text-xs font-semibold text-[#2563EB]"
              >
                Discard all
              </button>
            ) : null}
          </div>
          {pending.map((p) => (
            <div key={p.id} className="flex items-start gap-2">
              <span className="inline-flex h-[19px] shrink-0 items-center rounded-full bg-[#DBEAFE] px-2 text-[11px] font-bold uppercase tracking-wide text-[#1E40AF]">
                {p.kind}
              </span>
              <span className="text-[12.5px] leading-relaxed text-[#1E3A8A]">{p.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-[10px] border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] px-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-[#171717]">Guests Details</span>
            <span className="text-xs text-[#A1A1A1]">View and edit guests details here</span>
          </div>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border-0 bg-[#931115] px-3.5 text-[13px] font-semibold text-white"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
            Add Guest
          </button>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[minmax(0,1.4fr)_92px_84px_minmax(0,1.3fr)_116px_84px] gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
              <div>Guest</div>
              <div>Role</div>
              <div>Age</div>
              <div>Requirements</div>
              <div className="text-center">Used on</div>
              <div className="text-right">Actions</div>
            </div>

            {guests.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[#A1A1A1]">
                No guests yet — add one to start naming the party.
              </div>
            ) : (
              guests.map((g) => {
                const role = guestRoleLabel(g.ageBand) as 'Adult' | 'Child' | 'Infant'
                const cov = coverageForGuest(g.id, assignments, lines)
                const placeholder = isPlaceholderGuest(g)
                const blocked = deleteBlockedIds?.has(g.id)
                return (
                  <GuestRow
                    key={g.id}
                    guest={g}
                    all={guests}
                    role={role}
                    coverage={cov}
                    placeholder={placeholder}
                    blocked={!!blocked}
                    onEdit={() => onEdit(g)}
                    onDelete={() => onDelete(g)}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: ReactNode
  sub: string
  subColor?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-3.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">{label}</span>
      {value}
      <span className="text-xs text-[#525252]" style={subColor ? { color: subColor } : undefined}>
        {sub}
      </span>
    </div>
  )
}

function GuestRow({
  guest,
  all,
  role,
  coverage,
  placeholder,
  blocked,
  onEdit,
  onDelete,
}: {
  guest: GuestDetail
  all: GuestDetail[]
  role: 'Adult' | 'Child' | 'Infant'
  coverage: GuestCoverage
  placeholder: boolean
  blocked: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const name = guestDisplayName(guest, all)
  const requirements = dietaryRequirementsLabel(guest)
  const requirementsCaptured = requirements !== 'Not yet advised'
  const linesColor =
    coverage.assigned === 0 ? '#931115' : coverage.assigned < coverage.total ? '#B45309' : '#171717'

  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_92px_84px_minmax(0,1.3fr)_116px_84px] items-center gap-3 border-b border-[#F1F1F2] px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
            placeholder ? 'bg-[#FEF3C7] text-[#92400E]' : 'bg-[#F4F4F5] text-[#525252]',
          )}
        >
          {guestInitials(guest, all)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span
            className={cn(
              'truncate text-[13px] font-semibold',
              placeholder ? 'italic text-[#A1A1A1]' : 'text-[#171717]',
            )}
          >
            {name}
          </span>
          {guest.lead ? (
            <span className="text-[11px] font-semibold text-[#931115]">Lead Traveler</span>
          ) : null}
          {guest.invoiceContact ? (
            <span className="text-[11px] font-semibold text-[#0369A1]">Invoice contact</span>
          ) : null}
          {placeholder ? (
            <span className="inline-flex h-[18px] w-fit items-center rounded-full bg-[#FEF3C7] px-1.5 text-[10.5px] font-bold uppercase tracking-wide text-[#92400E]">
              Placeholder
            </span>
          ) : null}
        </div>
      </div>
      <div>
        <span
          className={cn(
            'inline-flex h-[21px] items-center rounded-full px-2 text-[11.5px] font-bold',
            roleChipClass(role),
          )}
        >
          {role}
        </span>
      </div>
      <div>
        <span className="text-[13px] font-semibold text-[#171717]">
          {guest.age != null ? guest.age : '—'}
        </span>
      </div>
      <div className="min-w-0">
        <span
          className="block truncate text-[12.5px]"
          style={{ color: requirementsCaptured ? '#525252' : '#D4D4D8' }}
        >
          {requirements}
        </span>
      </div>
      <div className="flex flex-col items-center gap-px text-center">
        <span className="text-[13px] font-bold" style={{ color: linesColor }}>
          {coverage.assigned} / {coverage.total}
        </span>
        {coverage.skipped > 0 && coverage.assigned > 0 ? (
          <span className="text-[11px] text-[#A1A1A1]">{coverage.skipped} skipped</span>
        ) : null}
      </div>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          title="Edit guest"
          onClick={onEdit}
          className="flex size-7 items-center justify-center rounded-[7px] border border-[#E5E7EB] bg-white text-[#525252]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          type="button"
          title={blocked ? 'Cannot delete — assigned to a confirmed line' : 'Delete guest'}
          disabled={blocked}
          onClick={onDelete}
          className={cn(
            'flex size-7 items-center justify-center rounded-[7px] border',
            blocked
              ? 'cursor-not-allowed border-[#F1F1F2] bg-[#FAFAFA] text-[#D4D4D8]'
              : 'border-[#F4E2E3] bg-white text-[#931115]',
          )}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
