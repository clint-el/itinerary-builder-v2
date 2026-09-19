import type {
  AddedService,
  Itinerary,
  LifecycleLogEntry,
  PlannerNotification,
  SupplierVoucherStatus,
  VoucherAnswerRecord,
  VoucherLineAnswer,
  VoucherLineInput,
  VoucherMeta,
  VoucherSendRecord,
} from './types'
import { payableEntityIdOf } from './lifecycleRules'

export function appendLifecycleEntry(
  log: LifecycleLogEntry[] | undefined,
  entry: Omit<LifecycleLogEntry, 'id' | 'at'> & { at?: string },
): LifecycleLogEntry[] {
  const at = entry.at || new Date().toISOString()
  return [
    ...(log ?? []),
    {
      id: `ll-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at,
      actor: entry.actor,
      from: entry.from,
      to: entry.to,
      label: entry.label,
      reason: entry.reason,
      category: entry.category,
      entityId: entry.entityId,
      detail: entry.detail,
    },
  ]
}

export function stripEntityLineAnswers(
  answers: Record<string, VoucherLineAnswer>,
  lineIds: string[],
): Record<string, VoucherLineAnswer> {
  const next = { ...answers }
  for (const id of lineIds) delete next[id]
  return next
}

export function revertEntitySupplierStatus(
  services: AddedService[],
  entityId: string,
  lineIds: string[],
): AddedService[] {
  const lineIdSet = new Set(lineIds)
  return services.map((svc) => {
    if (payableEntityIdOf(svc) !== entityId) return svc
    const hasLine = lineIds.some((lid) => lid.startsWith(`${svc.id}#`))
    if (!hasLine) return svc
    if (svc.supplierStatus === 'Booked' || svc.supplierStatus === 'Rejected') {
      return { ...svc, supplierStatus: 'Waiting' as const }
    }
    return svc
  })
}

export function buildAnswerRecord(input: {
  at: string
  actorType: VoucherAnswerRecord['actorType']
  actorEmail?: string
  tokenId?: string
  userAgent?: string
  courtesyName?: string
  lines: VoucherLineInput[]
  ticks: Record<string, boolean>
  reasons: Record<string, string>
  answers: Record<string, VoucherLineAnswer>
}): VoucherAnswerRecord {
  return {
    id: `va-${Date.now()}`,
    at: input.at,
    actorType: input.actorType,
    actorEmail: input.actorEmail,
    tokenId: input.tokenId,
    userAgent: input.userAgent,
    ip: null,
    courtesyName: input.courtesyName,
    lineDecisions: input.lines.map((l) => ({
      lineId: l.lineId,
      outcome: input.answers[l.lineId]?.outcome ?? (input.ticks[l.lineId] !== false ? 'held' : 'rejected'),
      reason: input.reasons[l.lineId],
    })),
  }
}

export function routePlannerNotifications(
  meta: VoucherMeta,
  entityId: string,
  heldCount: number,
  totalLines: number,
  rejectedReasons: string[],
): PlannerNotification[] {
  const at = new Date().toISOString()
  const existing = meta.plannerNotifications || []
  if (heldCount === totalLines) {
    return [
      ...existing,
      {
        id: `pn-${Date.now()}`,
        at,
        kind: 'all_confirmed',
        entityId,
        message: 'Every line confirmed — all planners on this voucher notified.',
      },
    ]
  }
  if (heldCount === 0) {
    return [
      ...existing,
      {
        id: `pn-${Date.now()}`,
        at,
        kind: 'all_rejected',
        entityId,
        message: `Every line rejected — issuing planner notified${rejectedReasons.length ? ` (${rejectedReasons.length} reasons)` : ''}.`,
      },
    ]
  }
  return [
    ...existing,
    {
      id: `pn-${Date.now()}`,
      at,
      kind: 'partial',
      entityId,
      message: `Partial hold — ${heldCount} of ${totalLines} lines held; issuing planner notified.`,
    },
  ]
}

export function nextVoucherSeq(itinerary: Itinerary): number {
  const seqs = Object.values(itinerary.voucherMeta || {})
    .map((m) => m.voucherSeq || 0)
    .filter(Boolean)
  return (seqs.length ? Math.max(...seqs) : 0) + 1
}

export function appendSendRecord(
  meta: VoucherMeta,
  record: VoucherSendRecord,
): VoucherSendRecord[] {
  return [...(meta.sendHistory || []), record]
}

export function resetSupplierVoucherRollup(
  supplierVouchers: Record<string, SupplierVoucherStatus>,
  entityId: string,
): Record<string, SupplierVoucherStatus> {
  return { ...supplierVouchers, [entityId]: 'Raised' }
}
