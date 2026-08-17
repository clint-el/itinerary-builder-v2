import { useEffect, useMemo, useRef } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { STATUS_META } from '@/shared/lib/catalogs'
import type { DemoRole, ServiceTab } from '@/shared/lib/types'
import { cn, formatDay } from '@/shared/lib/utils'
import {
  cancellationRuleCopy,
  cancellationTravelWindow,
  resolveCancellationPolicy,
  sortedRulesForDisplay,
  type CancellationPolicy,
  type CancellationSelection,
} from './cancellationPolicy'

const NONE_TEXT = 'No cancellation policy is configured for the selected travel dates. Contact Database.'
const INCOMPLETE_TEXT =
  'Cancellation policy is incompletely configured for these dates; some terms may be missing. Contact Database.'

// Reuses the app's existing itinerary-status color pairs (StatusChip / STATUS_META)
// instead of inventing a new palette — same green/amber/orange/red vocabulary the
// rest of the builder already uses.
const STATE_STYLE = {
  resolved: { bg: STATUS_META.CONFIRMED.bg, fg: STATUS_META.CONFIRMED.fg, Icon: CheckCircle2, label: 'Resolved' },
  overlap: { bg: STATUS_META.INVOICED.bg, fg: STATUS_META.INVOICED.fg, Icon: AlertTriangle, label: 'Needs selection' },
  incomplete: { bg: STATUS_META.APPROVED.bg, fg: STATUS_META.APPROVED.fg, Icon: AlertTriangle, label: 'Incomplete' },
  none: { bg: STATUS_META.CANCELLED.bg, fg: STATUS_META.CANCELLED.fg, Icon: XCircle, label: 'Not configured' },
} as const

/**
 * "Policy" tab body, shared by all four Add/Update Service panels (Stay,
 * Transport, Flight, Activity/Other). AC1–AC9 from the cancellation-policy
 * implementation brief.
 *
 * Presentation note: this used to be a chip that opened a modal next to the
 * Supplier field. It now renders directly as the Policy tab's content — a
 * persistent tab that still requires a click to open a dialog is redundant
 * UX, so the resolved-state messaging, the AC4 overlap picker, and
 * PolicyDetails all render inline instead. None of the underlying resolution
 * logic in cancellationPolicy.ts changed — this is a shape change only.
 *
 * State shape: fully derived from `draft` (the per-service-line draft each
 * panel already owns) — no local/context state needed for the resolution
 * itself. The one piece of state that must persist across renders and
 * survive a tab switch is the AC4 overlap selection, so it lives in the same
 * draft object via `patch`, exactly like every other draft field, and rides
 * along into `AddedService.draft` for free.
 */
export function CancellationPolicyControl({
  tab,
  draft,
  patch,
  demoRole,
  isDraftItinerary,
}: {
  tab: ServiceTab
  draft: Record<string, unknown>
  patch: (p: Record<string, unknown>) => void
  demoRole: DemoRole
  isDraftItinerary: boolean
}) {
  const supplier = String(draft.supplier || '')
  const { from: travelFrom, to: travelTo } = cancellationTravelWindow(tab, draft)
  const rawSelection = draft.cancellationSelection
  const selection =
    rawSelection && typeof rawSelection === 'object' ? (rawSelection as CancellationSelection) : undefined

  const outcome = useMemo(
    () => resolveCancellationPolicy({ tab, supplier, travelFrom, travelTo }),
    [tab, supplier, travelFrom, travelTo],
  )

  // AC7 — a travel-date change discards any prior outcome, including a manual
  // AC4 overlap selection, and resolution re-runs from scratch (the useMemo
  // above already does that; this only clears the persisted selection).
  const prevRange = useRef({ travelFrom, travelTo })
  useEffect(() => {
    const changed = prevRange.current.travelFrom !== travelFrom || prevRange.current.travelTo !== travelTo
    prevRange.current = { travelFrom, travelTo }
    if (changed && rawSelection !== undefined) {
      patch({ cancellationSelection: undefined })
    }
    // Only re-run when the resolved travel window itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelFrom, travelTo])

  if (!supplier) {
    return (
      <p className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFB] p-3 text-[12.5px] text-[#A1A1A1]">
        Select a supplier to view its cancellation policy.
      </p>
    )
  }

  function choose(policyId: string) {
    const next: CancellationSelection = { policyId, actor: demoRole, at: new Date().toISOString() }
    patch({ cancellationSelection: next })
  }

  const style =
    outcome.kind === 'none'
      ? STATE_STYLE.none
      : outcome.kind === 'incomplete'
        ? STATE_STYLE.incomplete
        : outcome.kind === 'overlap'
          ? STATE_STYLE.overlap
          : STATE_STYLE.resolved
  const Icon = style.Icon

  const dateLabel = travelFrom
    ? `${formatDay(travelFrom)}${travelTo && travelTo !== travelFrom ? ` – ${formatDay(travelTo)}` : ''}`
    : 'no travel date set'

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold text-[#171717]">Cancellation Policy</p>
          <p className="text-[12px] text-[#737373]">
            {supplier} · {dateLabel}
          </p>
        </div>
        <span
          role="status"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] font-bold"
          style={{ background: style.bg, color: style.fg }}
        >
          <Icon className="size-3.5" />
          {style.label}
        </span>
      </div>

      {outcome.kind === 'none' ? <p className="text-[13px] font-medium text-[#B91C1C]">{NONE_TEXT}</p> : null}

      {outcome.kind === 'incomplete' ? (
        <div className="space-y-3">
          <p className="rounded-lg bg-[#FFFBEB] p-2.5 text-[12.5px] font-medium text-[#92400E] shadow-[inset_0_0_0_1px_#FDE68A]">
            {INCOMPLETE_TEXT}
          </p>
          <PolicyDetails policy={outcome.policy} isDraftItinerary={isDraftItinerary} />
        </div>
      ) : null}

      {outcome.kind === 'non-refundable' || outcome.kind === 'complete' ? (
        <div className="space-y-2">
          <p className="text-[13.5px] font-bold text-[#171717]">{outcome.policy.name}</p>
          <p className="text-[12.5px] text-[#525252]">{outcome.policy.description}</p>
          <PolicyDetails policy={outcome.policy} isDraftItinerary={isDraftItinerary} />
        </div>
      ) : null}

      {outcome.kind === 'overlap' ? (
        <fieldset className="space-y-3">
          <legend className="sr-only">Overlapping cancellation policies — select one to apply</legend>
          <p className="rounded-lg bg-[#FFF7ED] p-2.5 text-[12.5px] font-medium text-[#9A3412] shadow-[inset_0_0_0_1px_#FDBA74]">
            {outcome.candidates.length} overlapping policies match these travel dates — review each and select
            the stricter policy to apply.
          </p>
          <div className="space-y-3">
            {outcome.candidates.map((candidate) => {
              const chosen = selection?.policyId === candidate.id
              return (
                <label
                  key={candidate.id}
                  className={cn(
                    'block cursor-pointer rounded-lg border p-3',
                    chosen ? 'border-[#931115] bg-[#FEF2F2]' : 'border-[#E5E7EB] bg-white',
                  )}
                >
                  <div className="mb-1 flex items-start gap-2">
                    <input
                      type="radio"
                      name="cancellation-candidate"
                      className="mt-1"
                      checked={chosen}
                      onChange={() => choose(candidate.id)}
                    />
                    <span className="text-[13px] font-bold text-[#171717]">{candidate.name}</span>
                  </div>
                  <p className="mb-1.5 pl-5 text-[11.5px] text-[#737373]">
                    Applies {formatDay(candidate.travelDateFrom)} – {formatDay(candidate.travelDateTo)}
                  </p>
                  <div className="pl-5">
                    <PolicyDetails policy={candidate} isDraftItinerary={isDraftItinerary} compact />
                  </div>
                </label>
              )
            })}
          </div>
          {selection ? (
            <p className="text-[11.5px] text-[#A1A1A1]">
              Selected by {selection.actor} ·{' '}
              {new Date(selection.at).toLocaleString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          ) : (
            <p className="text-[11.5px] text-[#A1A1A1]">No candidate selected yet.</p>
          )}
        </fieldset>
      ) : null}
    </div>
  )
}

// AC8 — read-only by construction: this renders penalty values, it never accepts
// an edit to any of them, and there is no control here to substitute a policy
// outside the system-surfaced set.
function PolicyDetails({
  policy,
  isDraftItinerary,
  compact,
}: {
  policy: CancellationPolicy
  isDraftItinerary: boolean
  compact?: boolean
}) {
  if (!policy.refundable) {
    return (
      <p className="inline-flex items-center rounded-md bg-[#FEE2E2] px-2 py-1 text-[12px] font-bold text-[#B91C1C]">
        Non-Refundable
      </p>
    )
  }
  const rules = sortedRulesForDisplay(policy.rules)
  if (rules.length === 0) return null
  return (
    <ul className={cn('space-y-1.5', compact ? 'text-[11.5px]' : 'text-[12.5px]')}>
      {rules.map((rule) => (
        <li key={rule.id} className="rounded-md bg-[#F9FAFB] px-2.5 py-1.5 text-[#171717]">
          {cancellationRuleCopy(rule, isDraftItinerary)}
        </li>
      ))}
    </ul>
  )
}
