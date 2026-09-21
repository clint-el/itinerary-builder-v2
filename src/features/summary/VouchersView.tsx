import { useState, type ComponentType, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  FileDown,
  Lock,
  Mail,
  MessageSquareReply,
  Send,
  StickyNote,
  Tag,
  Users,
} from 'lucide-react'
import { cn } from '@/shared/lib/utils'
import type { GateResult, VoucherLineInput } from '@/shared/lib/lifecycleRules'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { VoucherRecipientBody } from './VoucherRecipientBody'
import { VoucherIssueDialog } from './VoucherIssueDialog'
import type { VoucherCard, VoucherValueMode } from './summaryModel'

type SubmitInput = {
  lines: VoucherLineInput[]
  ticks: Record<string, boolean>
  reasons: Record<string, string>
  via: 'link' | 'staff'
  token?: string
  courtesyName?: string
}

const SECTION_LABEL = 'text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#A1A1A1]'

const HEADER_CELL =
  'flex items-center px-3.5 py-[9px] text-[10.5px] font-bold uppercase tracking-[0.4px] text-[#94A3B8]'

const BODY_CELL = 'flex min-w-0 items-center border-b border-[#F3F4F6] px-3.5 py-[11px] text-[13px] text-[#171717]'

/** Tinted background paired with each requirement-coverage tone the model emits. */
const COVERAGE_BG: Record<string, string> = { '#B45309': '#FFFBEB', '#15803D': '#F0FDF4' }

export function VouchersView({
  vouchers,
  mode,
  setMode,
  valueModeClass,
  itineraryId,
  bookingRef,
  raised,
  canIssue,
  canRecordOnBehalf,
  issueVoucher,
  resendVoucher,
  submitVoucherAnswers,
  clearVoucherReply,
  onOpenGuests,
  followUps,
}: {
  vouchers: VoucherCard[]
  mode: VoucherValueMode
  setMode: (mode: VoucherValueMode) => void
  valueModeClass: (active: boolean) => string
  itineraryId: string
  bookingRef: string
  raised: boolean
  canIssue: boolean
  canRecordOnBehalf: boolean
  issueVoucher: (
    entityId: string,
    opts: { recipientEmails: string[]; note?: string; supplierBookingRef?: string },
  ) => GateResult
  resendVoucher: (entityId: string) => GateResult
  submitVoucherAnswers: (entityId: string, input: SubmitInput) => GateResult & { depositGuardCount?: number }
  clearVoucherReply: (entityId: string) => GateResult
  onOpenGuests: () => void
  followUps?: { id: string; kind: string; entityId: string; status: string; formerSourceRef?: string }[]
}) {
  const [previewCard, setPreviewCard] = useState<VoucherCard | null>(null)
  const [issueCard, setIssueCard] = useState<VoucherCard | null>(null)
  const [issueStep, setIssueStep] = useState<'review' | 'send'>('review')
  const [recordCard, setRecordCard] = useState<VoucherCard | null>(null)
  const [supplierNoteDrafts, setSupplierNoteDrafts] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)

  function supplierNoteFor(card: VoucherCard) {
    return supplierNoteDrafts[card.entityId] ?? card.note ?? ''
  }

  function lineInputsFor(card: VoucherCard): VoucherLineInput[] {
    return card.rows.map((r) => ({
      lineId: r.lineId,
      serviceId: r.serviceId,
      depositPaid: r.depositPaid,
      isExtra: r.isExtra,
      parentLineId: r.parentLineId,
    }))
  }

  function openIssue(card: VoucherCard) {
    setIssueCard(card)
    setIssueStep('review')
  }

  function flashResult(result: GateResult & { depositGuardCount?: number }, successMessage: (guardCount: number) => string) {
    if (!result.ok) {
      setNotice(result.reason)
      return
    }
    setNotice(successMessage(result.depositGuardCount || 0))
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 rounded-[14px] border border-[#E5E7EB] bg-white px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-[#171717]">Supplier vouchers</h2>
            <span className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-[#F3F4F6] px-1.5 text-[11px] font-bold text-[#737373]">
              {vouchers.length}
            </span>
          </div>
          <p className="mt-1 max-w-[640px] text-[11.5px] font-medium leading-relaxed text-[#94A3B8]">
            The supplier copy prints cost only. Sell values and margin stay internal and are never shown on an issued
            voucher.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="text-[11.5px] font-semibold text-[#A1A1A1]">Values shown</span>
          <div className="flex gap-[3px] rounded-[9px] bg-[#F3F4F6] p-[3px]">
            <button type="button" className={valueModeClass(mode === 'cost')} onClick={() => setMode('cost')}>
              Cost
            </button>
            <button type="button" className={valueModeClass(mode === 'sell')} onClick={() => setMode('sell')}>
              Sell (internal)
            </button>
            <button type="button" className={valueModeClass(mode === 'none')} onClick={() => setMode('none')}>
              Hidden
            </button>
          </div>
        </div>
      </div>

      {notice ? (
        <div className="flex items-center gap-2.5 rounded-[10px] bg-[#171717] px-4 py-3 text-[13px] font-semibold text-white">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {notice}
        </div>
      ) : null}

      {followUps?.filter((f) => f.status === 'open').map((f) => (
        <div
          key={f.id}
          className="rounded-[10px] border border-[#FDE68A] bg-[#FFFDF5] px-4 py-3 text-[12.5px] font-semibold text-[#B45309]"
        >
          Mandatory follow-up: {f.kind.replace(/_/g, ' ')}
          {f.formerSourceRef ? ` · formerly ${f.formerSourceRef}` : ''}
        </div>
      ))}

      {vouchers.map((v) => (
        <section
          key={v.entityId}
          className="overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
        >
          <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 border-b border-[#EDEFF2] px-5 py-4">
            <div className="flex min-w-0 flex-[1_1_320px] items-start gap-3">             
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-[15px] font-bold text-[#171717]">{v.supplier}</h3>
                  <span
                    className="inline-flex h-[21px] items-center rounded-full px-[9px] text-[11px] font-bold"
                    style={{ background: v.holdBg, color: v.holdFg }}
                  >
                    {v.holdLabel}
                  </span>
                </div>
                <div className="mt-[3px] text-[12px] font-medium text-[#A1A1A1]">
                  {v.ref} · {v.dateRange} · {v.countLabel}
                  {v.propertyNames.length > 1 ? ` · ${v.propertyNames.length} properties` : ''}
                </div>
                {v.agency ? (
                  <div className="mt-1 text-[12px] font-medium text-[#737373]">
                    <span className="font-semibold text-[#A1A1A1]">Agency</span>
                    <span className="mx-1.5 text-[#D4D4D8]">·</span>
                    {v.agency}
                  </div>
                ) : null}
                <span
                  className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold"
                  style={{ background: COVERAGE_BG[v.dietColor] || '#F4F4F5', color: v.dietColor }}
                >
                  {v.dietColor === '#15803D' ? (
                    <CheckCircle2 className="h-3 w-3 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                  )}
                  {v.dietLine}
                </span>
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-3">
              {v.showValue ? (
                <div className="text-right">
                  <div className={SECTION_LABEL}>{v.totalLabel}</div>
                  <div className="mt-0.5 text-[17px] font-bold tabular-nums text-[#171717]">{v.total}</div>
                </div>
              ) : null}
              <div className="flex flex-wrap items-center justify-end gap-2">
                <GhostButton icon={Users} onClick={onOpenGuests}>
                  Guest requirements
                </GhostButton>
                <GhostButton icon={Mail} onClick={() => setPreviewCard(v)}>
                  Preview email
                </GhostButton>
                {v.issued ? (
                  <GhostLink icon={FileDown} to={`/voucher-doc/${itineraryId}/${encodeURIComponent(v.entityId)}`}>
                    Download voucher PDF
                  </GhostLink>
                ) : null}
                {v.issued ? (
                  <GhostLink
                    icon={ExternalLink}
                    to={`/voucher-link/${itineraryId}/${encodeURIComponent(v.entityId)}${
                      v.activeToken ? `?t=${encodeURIComponent(v.activeToken)}` : ''
                    }`}
                    newTab
                  >
                    Open supplier link
                  </GhostLink>
                ) : null}
                {raised && canIssue ? (
                  <button
                    type="button"
                    onClick={() => openIssue(v)}
                    className={cn(
                      'inline-flex h-[34px] items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-semibold',
                      v.issued
                        ? 'border-[#E5E7EB] bg-white text-[#737373]'
                        : 'border-[#931115] bg-[#931115] text-white',
                    )}
                  >
                    <Send className="h-3.5 w-3.5" />
                    {v.issued ? 'Re-issue voucher' : 'Issue voucher'}
                  </button>
                ) : null}
                {!raised ? (
                  <span className="inline-flex h-[34px] items-center gap-1.5 rounded-lg bg-[#F4F4F5] px-3 text-[11.5px] font-semibold text-[#A1A1A1]">
                    <Lock className="h-3 w-3" />
                    Raise vouchers to enable sending
                  </span>
                ) : null}
              </div>
            </div>
          </header>

          {v.emailLine ? (
            <div className="border-b border-[#DCFCE7] bg-[#F6FEF9] px-5 py-2.5">
              <div className="flex items-center gap-2 text-[11.5px] font-semibold text-[#15803D]">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                {v.emailLine}
              </div>
              {v.sendHistory.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {v.sendHistory.slice(-3).map((s, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-[10.5px] font-medium text-[#15803D] ring-1 ring-[#BBF7D0]"
                    >
                      {s.via} · {s.recipient} · {s.deliveryStatus}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {v.pendingRequestLatest ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FDE68A] bg-[#FFFDF5] px-5 py-2.5">
              <span className="text-[11.5px] font-semibold text-[#B45309]">
                Supplier requested the latest version — resend when ready.
              </span>
              {raised && canIssue ? (
                <button
                  type="button"
                  onClick={() => flashResult(resendVoucher(v.entityId), () => `Resent to ${v.issuedTo[0] || v.supplierEmail}`)}
                  className="h-7 rounded-[7px] border border-[#B45309] bg-white px-[11px] text-[11.5px] font-bold text-[#B45309]"
                >
                  Resend latest
                </button>
              ) : null}
            </div>
          ) : null}

          {v.changedSinceIssued ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#FDE68A] bg-[#FFFDF5] px-5 py-2.5">
              <span className="flex items-center gap-2 text-[11.5px] font-semibold text-[#B45309]">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Guest requirements changed since this voucher was issued — {v.supplier} has the older copy.
              </span>
              {raised && canIssue ? (
                <button
                  type="button"
                  onClick={() =>
                    flashResult(resendVoucher(v.entityId), () => `Resent to ${v.issuedTo[0] || v.supplierEmail}`)
                  }
                  className="h-7 rounded-[7px] border border-[#B45309] bg-white px-[11px] text-[11.5px] font-bold text-[#B45309]"
                >
                  Re-send updated voucher
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-3 border-b border-[#EDEFF2] bg-[#FBFBFC] p-4 lg:grid-cols-[1.15fr_1.05fr]">
            <Panel title="Pax details" count={v.paxRows.length}>
              {v.paxRows.length ? (
                <div className="flex flex-col">
                  {v.paxRows.map((p) => (
                    <div
                      key={p.key}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[#F3F4F6] py-[7px] first:pt-0 last:border-b-0 last:pb-0"
                    >
                      <span className="truncate text-[12.5px] font-semibold text-[#171717]">{p.name}</span>
                      <span className="shrink-0 whitespace-nowrap rounded-full bg-[#F4F4F5] px-2 py-[2px] text-[10.5px] font-bold text-[#94A3B8]">
                        {p.bandLabel}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[12.5px] font-medium text-[#A1A1A1]">No guests assigned to this supplier</span>
              )}
            </Panel>

            <Panel title="Room listing" count={v.rooms.length || undefined}>
              {v.rooms.length ? (
                <div className="flex flex-col gap-2">
                  {v.rooms.map((rm, i) => (
                    <div key={i} className="rounded-lg border border-[#F1F2F4] bg-[#FCFCFD] px-2.5 py-2">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12.5px] font-bold text-[#171717]">{rm.room}</span>
                        <span className="shrink-0 text-[11px] font-medium text-[#A1A1A1]">{rm.meta}</span>
                      </div>
                      <div className="mt-0.5 text-[11.5px] font-medium text-[#737373]">{rm.who}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-[12.5px] font-medium text-[#A1A1A1]">No accommodation with this supplier</span>
              )}
            </Panel>
          </div>

          <div className="overflow-x-auto">
            <div style={{ minWidth: 'fit-content' }}>
              <div
                className="grid border-b border-[#EDEFF2] bg-[#FBFBFC]"
                style={{ gridTemplateColumns: v.gridCols }}
              >
                {v.headers.map((h) => (
                  <div
                    key={h.label}
                    className={cn(
                      HEADER_CELL,
                      h.align === 'c' && 'justify-center text-center',
                      h.align === 'r' && 'justify-end text-right',
                    )}
                  >
                    {h.label}
                  </div>
                ))}
              </div>
              {v.rows.map((r) => (
                <div
                  key={r.lineId}
                  className={cn(
                    'grid items-stretch transition-colors [&:last-child>div]:border-b-0',
                    r.isExtra ? 'bg-[#FCFCFD] hover:bg-[#F8F9FB]' : 'bg-white hover:bg-[#FAFBFC]',
                  )}
                  style={{ gridTemplateColumns: v.gridCols }}
                >
                  <div className={cn(BODY_CELL, 'whitespace-nowrap text-[12.5px] text-[#737373]')}>{r.date}</div>
                  <div className={BODY_CELL}>
                    <span
                      className={cn(
                        'truncate rounded-full px-2 py-[2px] text-[10.5px] font-bold uppercase tracking-[0.3px]',
                        r.isExtra ? 'bg-[#EFF6FF] text-[#0369A1]' : 'bg-[#F4F4F5] text-[#94A3B8]',
                      )}
                    >
                      {r.typeLabel}
                    </span>
                  </div>
                  <div
                    className={BODY_CELL}
                    style={
                      r.isExtra
                        ? { paddingLeft: 30, boxShadow: 'inset 16px 0 0 -15px #CBD5E1' }
                        : undefined
                    }
                  >
                    <span className="truncate font-semibold" title={r.service}>
                      {r.service}
                    </span>
                  </div>
                  <div className={cn(BODY_CELL, 'text-[12.5px] text-[#737373]')}>
                    <span className="truncate" title={r.detail}>
                      {r.detail}
                    </span>
                  </div>
                  <div className={cn(BODY_CELL, 'justify-center whitespace-nowrap text-center text-[12.5px]')}>
                    {r.pax}
                  </div>
                  {v.showValue ? (
                    <div className={cn(BODY_CELL, 'justify-end whitespace-nowrap text-right font-semibold tabular-nums')}>
                      {r.value}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <SectionShell icon={StickyNote} title="Supplier notes">
            {v.supplierNotes.length ? (
              <div className="mb-2.5 flex flex-col gap-2">
                {v.supplierNotes.map((n) => (
                  <div key={n.key} className="border-l-2 border-[#E5E7EB] py-px pl-2.5">
                    <div className="text-[11px] font-semibold text-[#A1A1A1]">{n.label}</div>
                    <div className="mt-0.5 text-[12.5px] leading-relaxed text-[#525252]">{n.text}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              value={supplierNoteFor(v)}
              onChange={(e) =>
                setSupplierNoteDrafts((prev) => ({ ...prev, [v.entityId]: e.target.value }))
              }
              rows={2}
              placeholder="Add a note for the supplier — printed on the voucher…"
              className="w-full resize-y rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-2 text-[12.5px] leading-relaxed text-[#171717] outline-none"
            />
          </SectionShell>

          {v.hasDiscount ? (
            <div className="border-t border-[#F5E4CF] bg-[#FFFBF5] px-5 py-4">
              <div className="flex items-center gap-2">
                <Tag className="h-3.5 w-3.5 shrink-0 text-[#C2410C]" />
                <span className="text-[12.5px] font-bold text-[#C2410C]">Adjusted cost · negotiated discount</span>
              </div>
              <div className="mt-2.5 overflow-hidden rounded-[10px] border border-[#F3E0C8] bg-white">
                {v.discountRows.map((d) => (
                  <div
                    key={d.key}
                    className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-[#F7EEE2] px-3.5 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#171717]">
                      {d.label}
                    </span>
                    <div className="flex shrink-0 items-center gap-2.5">
                      <span className="text-[12.5px] font-medium tabular-nums text-[#A1A1A1] line-through">
                        {d.from}
                      </span>
                      <ArrowRight className="h-3 w-3 text-[#C2410C]" />
                      <span className="text-[13px] font-bold tabular-nums text-[#171717]">{d.to}</span>
                      {d.tag ? (
                        <span className="rounded-full bg-[#FEF3E2] px-2 py-[2px] text-[10.5px] font-bold text-[#C2410C]">
                          {d.tag}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2.5 text-[11.5px] font-medium text-[#A1A1A1]">{v.discountNote}</p>
            </div>
          ) : null}

          {v.issued ? (
            <SectionShell icon={MessageSquareReply} title="Supplier response" tone="#FCFDFC">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className="inline-flex h-5 items-center rounded-full px-[9px] text-[11px] font-bold"
                  style={{ background: v.responsePill.bg, color: v.responsePill.fg }}
                >
                  {v.responsePill.label}
                </span>
                <span className="text-[11.5px] text-[#94A3B8]">{v.responseHint}</span>
              </div>
              {v.responseSummary ? (
                <div className="mt-2.5">
                  <div className="text-[12.5px] font-semibold text-[#171717]">{v.responseSummary}</div>
                  <div className="mt-1.5 flex flex-col gap-1">
                    {v.responseRejected.map((r) => (
                      <div
                        key={r.key}
                        className="rounded-lg border border-[#FEE2E2] bg-[#FEF7F7] px-2.5 py-1.5 text-[12px] font-medium text-[#B91C1C]"
                      >
                        Rejected — left on the itinerary · {r.text}
                      </div>
                    ))}
                  </div>
                  {v.depositGuardCount ? (
                    <div className="mt-1.5 text-[12px] font-semibold text-[#B45309]">
                      {v.depositGuardCount} line{v.depositGuardCount === 1 ? '' : 's'} held back — deposit already
                      paid
                    </div>
                  ) : null}
                  <div className="mb-2.5 mt-2 text-[11.5px] text-[#A1A1A1]">
                    Hold status only — the itinerary&apos;s own status is unchanged by a supplier response.
                  </div>
                  {canRecordOnBehalf ? (
                    <GhostButton
                      onClick={() => flashResult(clearVoucherReply(v.entityId), () => 'Recorded reply cleared')}
                      small
                    >
                      Clear recorded reply
                    </GhostButton>
                  ) : null}
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-3">
                  <span className="min-w-[240px] flex-1 text-[12.5px] font-medium leading-relaxed text-[#525252]">
                    {v.responseAwaitText}
                  </span>
                  {canRecordOnBehalf ? (
                    <GhostButton onClick={() => setRecordCard(v)} small>
                      Record a reply received by email
                    </GhostButton>
                  ) : null}
                </div>
              )}
            </SectionShell>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-[#EDEFF2] bg-[#FAFAFB] px-5 py-3.5">
            <div className="min-w-0">
              <div className={SECTION_LABEL}>Payment terms</div>
              <div className="mt-1 text-[12.5px] font-medium text-[#525252]">{v.depositRule}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className={SECTION_LABEL}>Deposit</div>
              <div className="mt-1 flex items-baseline justify-end gap-2.5">
                <span className="text-[15px] font-bold tabular-nums text-[#931115]">{v.deposit}</span>
                <span className="text-[11.5px] font-medium text-[#A1A1A1]">{v.depositDue}</span>
              </div>
            </div>
          </footer>
        </section>
      ))}

      <Dialog open={!!previewCard} onOpenChange={(v) => !v && setPreviewCard(null)}>
        <DialogContent className="max-h-[85vh] max-w-[760px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preview — nothing has been sent</DialogTitle>
            <DialogDescription>
              Exactly what the supplier will see once you send. No confirmation action is possible from here.
            </DialogDescription>
          </DialogHeader>
          {previewCard ? <VoucherRecipientBody card={previewCard} bookingRef={bookingRef} readOnly /> : null}
        </DialogContent>
      </Dialog>

      <VoucherIssueDialog
        open={!!issueCard}
        card={issueCard}
        step={issueStep}
        noteDraft={issueCard ? supplierNoteFor(issueCard) : undefined}
        onClose={() => {
          setIssueCard(null)
          setIssueStep('review')
        }}
        onContinue={() => setIssueStep('send')}
        onOpenGuests={onOpenGuests}
        onOpenPreview={() => {
          if (issueCard) setPreviewCard(issueCard)
        }}
        onSend={(recipientEmails, note, supplierBookingRef) => {
          if (!issueCard) return
          const result = issueVoucher(issueCard.entityId, { recipientEmails, note, supplierBookingRef })
          setIssueCard(null)
          setIssueStep('review')
          flashResult(result, () => `Voucher emailed to ${recipientEmails.join(', ')}`)
        }}
      />

      <Dialog open={!!recordCard} onOpenChange={(v) => !v && setRecordCard(null)}>
        <DialogContent className="max-h-[85vh] max-w-[760px] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Record the supplier&apos;s reply — {recordCard?.supplier}</DialogTitle>
            <DialogDescription>
              For a reply that came in by phone or ordinary email. Same outcome as a link submit (BR-38).
            </DialogDescription>
          </DialogHeader>
          {recordCard ? (
            <VoucherRecipientBody
              card={recordCard}
              bookingRef={bookingRef}
              readOnly={false}
              submitLabel="Record reply"
              courtesyNameField
              onSubmit={(ticks, reasons, courtesyName) => {
                const result = submitVoucherAnswers(recordCard.entityId, {
                  lines: lineInputsFor(recordCard),
                  ticks,
                  reasons,
                  via: 'staff',
                  courtesyName,
                })
                setRecordCard(null)
                flashResult(result, (guardCount) =>
                  guardCount
                    ? `Reply recorded — ${guardCount} line${guardCount === 1 ? '' : 's'} held back for you (deposit already paid)`
                    : 'Reply recorded',
                )
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Panel({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[#EEF0F3] bg-white px-3.5 py-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className={SECTION_LABEL}>{title}</span>
        {count ? (
          <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#F4F4F5] px-1 text-[10px] font-bold text-[#94A3B8]">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

function SectionShell({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: ComponentType<{ className?: string }>
  title: string
  tone?: string
  children: ReactNode
}) {
  return (
    <div className="border-t border-[#EDEFF2] px-5 py-4" style={tone ? { background: tone } : undefined}>
      <div className="mb-2.5 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#A1A1A1]" />
        <span className={SECTION_LABEL}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function GhostButton({
  children,
  onClick,
  small,
  icon: Icon,
}: {
  children: ReactNode
  onClick: () => void
  small?: boolean
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white font-semibold text-[#525252] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]',
        small ? 'h-8 px-3 text-[12.5px]' : 'h-[34px] px-3.5 text-[13px]',
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" /> : null}
      {children}
    </button>
  )
}

function GhostLink({
  to,
  children,
  newTab,
  icon: Icon,
}: {
  to: string
  children: ReactNode
  newTab?: boolean
  icon?: ComponentType<{ className?: string }>
}) {
  return (
    <Link
      to={to}
      {...(newTab ? { target: '_blank', rel: 'noreferrer' } : {})}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-[13px] font-semibold text-[#525252] hover:border-[#D4D4D8] hover:bg-[#FAFAFA]"
    >
      {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-[#94A3B8]" /> : null}
      {children}
    </Link>
  )
}
