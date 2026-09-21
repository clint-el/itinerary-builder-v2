import { useMemo, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import type { VoucherCard, VoucherRow } from './summaryModel'

function rowLabel(row: VoucherRow) {
  return `${row.date}  ·  ${row.service}${row.detail && row.detail !== '—' ? `  ·  ${row.detail}` : ''}`
}

export function VoucherAnswerForm({
  card,
  readOnly,
  submitLabel = 'Submit',
  courtesyNameField,
  onSubmit,
}: {
  card: VoucherCard
  readOnly: boolean
  submitLabel?: string
  courtesyNameField?: boolean
  onSubmit?: (ticks: Record<string, boolean>, reasons: Record<string, string>, courtesyName?: string) => void
}) {
  const [ticks, setTicks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(card.rows.map((r) => [r.lineId, r.outcome !== 'rejected'])),
  )
  const [reasons, setReasons] = useState<Record<string, string>>(() =>
    Object.fromEntries(card.rows.filter((r) => r.reason).map((r) => [r.lineId, r.reason as string])),
  )
  const [courtesyName, setCourtesyName] = useState('')

  const heldCount = card.rows.filter((r) => ticks[r.lineId] !== false).length
  const rejectedRows = card.rows.filter((r) => ticks[r.lineId] === false)
  const guardedRows = rejectedRows.filter((r) => r.depositPaid)
  const trueRejectedCount = rejectedRows.length - guardedRows.length

  const consequence = useMemo(() => {
    if (heldCount === card.rows.length) return { label: 'Supplier hold will apply — every line confirmed', tone: '#15803D' }
    if (heldCount === 0) return { label: 'Voucher will be rejected — every line unticked', tone: '#B91C1C' }
    return { label: `Partial — ${heldCount} held, ${rejectedRows.length} not held`, tone: '#B45309' }
  }, [heldCount, card.rows.length, rejectedRows.length])

  const missingReason = rejectedRows.some((r) => !r.depositPaid && !(reasons[r.lineId] || '').trim())
  const canSubmit = !readOnly && !missingReason

  function toggle(lineId: string) {
    if (readOnly) return
    setTicks((cur) => {
      const nextVal = cur[lineId] === false
      const next = { ...cur, [lineId]: nextVal }
      if (!nextVal) {
        for (const r of card.rows) {
          if (r.parentLineId === lineId) next[r.lineId] = false
        }
      }
      return next
    })
  }

  function submit() {
    if (!onSubmit || !canSubmit) return
    onSubmit(ticks, reasons, courtesyNameField || !readOnly ? courtesyName || undefined : undefined)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-lg border border-[#E5E7EB]">
        <div className="grid grid-cols-[28px_minmax(0,1fr)_84px_200px] items-center gap-2 bg-[#FBFBFC] px-3.5 py-2 text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]">
          <span />
          <span>Service line</span>
          <span className="text-right">Value</span>
          <span>{readOnly ? 'Outcome' : 'Reason if not held'}</span>
        </div>
        {card.rows.map((row) => {
          const held = ticks[row.lineId] !== false
          const guarded = !held && row.depositPaid
          const parentHeld = !row.parentLineId || ticks[row.parentLineId] !== false
          const extraBlocked = Boolean(row.isExtra && row.parentLineId && !parentHeld)
          const reasonValue = reasons[row.lineId] || ''
          return (
            <div
              key={row.lineId}
              className={cn(
                'grid grid-cols-[28px_minmax(0,1fr)_84px_200px] items-start gap-2 border-t border-[#F3F4F6] px-3.5 py-2.5 first:border-t-0',
                guarded && 'bg-[#FFFBEB]',
              )}
            >
              <input
                type="checkbox"
                checked={held && !extraBlocked}
                disabled={readOnly || extraBlocked}
                onChange={() => toggle(row.lineId)}
                aria-label={`${held ? 'Confirm' : 'Reject'} ${rowLabel(row)}`}
                className="mt-0.5 size-4"
              />
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[#171717]">{rowLabel(row)}</div>
                {row.reconfirmRequired && row.formerSourceRef ? (
                  <div className="mt-0.5 text-[11.5px] font-medium text-[#B45309]">
                    Reconfirm required — formerly on {row.formerSourceRef}
                  </div>
                ) : null}
                {extraBlocked ? (
                  <div className="mt-0.5 text-[11.5px] font-medium text-[#737373]">
                    Confirm the parent line first before holding this extra.
                  </div>
                ) : null}
                {guarded ? (
                  <div className="mt-0.5 text-[11.5px] font-medium text-[#B45309]">
                    Deposit already paid — this line can&apos;t be rejected here; it&apos;s held back for your
                    planner to resolve directly.
                  </div>
                ) : null}
              </div>
              <div className="text-right text-[13px] tabular-nums text-[#171717]">{card.showValue ? row.value : '—'}</div>
              {readOnly ? (
                <span className="text-[12.5px] text-[#737373]">
                  {row.outcome === 'held'
                    ? 'On hold'
                    : row.outcome === 'rejected'
                      ? `Rejected — ${row.reason || 'no reason given'}`
                      : row.outcome === 'deposit_held_back'
                        ? 'Held back — deposit paid'
                        : held
                          ? 'Will be held'
                          : 'Will be rejected'}
                </span>
              ) : !held && !guarded ? (
                <textarea
                  value={reasonValue}
                  onChange={(e) => setReasons((cur) => ({ ...cur, [row.lineId]: e.target.value }))}
                  placeholder="Required — say why this line can't be held"
                  rows={2}
                  className="min-h-[52px] resize-y rounded-md border border-[#E5E7EB] bg-white px-2 py-1.5 text-[12.5px] text-[#171717] outline-none"
                />
              ) : (
                <span className="text-[12.5px] text-[#A1A1A1]">—</span>
              )}
            </div>
          )
        })}
      </div>

      {!readOnly ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] px-4 py-3">
          <span className="text-[13px] font-semibold" style={{ color: consequence.tone }}>
            {consequence.label}
          </span>
          {guardedRows.length ? (
            <span className="text-[12px] font-medium text-[#B45309]">
              {guardedRows.length} line{guardedRows.length === 1 ? '' : 's'} held back for the planner (deposit
              already paid)
            </span>
          ) : null}
        </div>
      ) : null}

      {!readOnly ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold text-[#171717]">Your name (optional courtesy label)</span>
          <input
            value={courtesyName}
            onChange={(e) => setCourtesyName(e.target.value)}
            placeholder="Who is submitting this reply?"
            className="h-9 rounded-lg border border-[#E5E7EB] bg-white px-3 text-sm text-[#171717] outline-none"
          />
        </label>
      ) : null}

      {!readOnly ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11.5px] text-[#A1A1A1]">
            {missingReason ? 'Every unticked line needs a free-text reason before you can submit.' : `${trueRejectedCount + heldCount + guardedRows.length} of ${card.rows.length} lines answered`}
          </span>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={submit}
            className="h-10 rounded-lg border-0 bg-[#931115] px-5 text-[13.5px] font-semibold text-white disabled:opacity-40"
          >
            {submitLabel}
          </button>
        </div>
      ) : null}
    </div>
  )
}
