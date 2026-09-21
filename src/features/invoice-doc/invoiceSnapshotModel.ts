import {
  buildLedgerOptionRows,
  buildLedgerScheduleGroups,
  categoryGridFromGroups,
  fmtLedgerUsd,
  itineraryTitle,
} from '@/features/quote-doc/quoteLedgerModel'
import { linesForRateBasis } from '@/features/quote-doc/quoteRateBasisModel'
import {
  buildDepositSummary,
  buildPaymentHistory,
  buildPriceGroups,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
  type DepositSummary,
} from '@/features/summary/summaryModel'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import { partyGuests } from '@/shared/lib/helpers'
import type {
  AddedService,
  GuestDetail,
  InvoiceDocument,
  InvoiceLifecycleStage,
  InvoicePaymentPosition,
  InvoiceRevisionEntry,
  Itinerary,
  QuoteGroup,
} from '@/shared/lib/types'

export function invoiceNumberFor(itinerary: Itinerary): string {
  return `${itinerary.reference}-INV`
}

export function isInvoiceStale(invoice: InvoiceDocument, currentFp: string): boolean {
  return invoice.fingerprint !== currentFp
}

export function buildPaymentPosition(
  itinerary: Itinerary,
  sellTotal: number,
  deposits: DepositSummary,
  stage: InvoiceLifecycleStage,
  arrivalIso?: string,
): InvoicePaymentPosition {
  const totalUsd = itinerary.totalUsd ?? sellTotal
  const balanceUsd = itinerary.balanceUsd ?? totalUsd
  const paid = Math.max(0, Math.round((totalUsd - balanceUsd) * 100) / 100)
  const balance = Math.round(balanceUsd * 100) / 100

  if (stage === 'full') {
    return {
      total: sellTotal,
      paid,
      balance,
      amountDueImmediately: Math.max(0, balance),
    }
  }

  const history = buildPaymentHistory(sellTotal, arrivalIso)
  const nextUnpaid = history.rows.find((row) => row.status !== 'Paid')
  const depositStillDue = Math.max(0, deposits.depositTotalNum - paid)
  const amountDueImmediately =
    balance <= 0 ? 0 : depositStillDue > 0 ? Math.min(balance, depositStillDue) : balance
  const futureAmountDue = Math.max(0, balance - amountDueImmediately)

  return {
    total: sellTotal,
    paid,
    balance,
    amountDueImmediately,
    futureAmountDue: futureAmountDue > 0 ? futureAmountDue : undefined,
    futureDueDate: futureAmountDue > 0 ? history.finalDue : nextUnpaid?.date,
  }
}

function revisionSummary(before: InvoiceDocument | undefined, next: InvoiceDocument): string {
  if (!before) {
    return `Invoice created · ${fmtLedgerUsd(next.sellTotal)} · ${next.lifecycleStage}`
  }
  const totalPart =
    before.sellTotal !== next.sellTotal
      ? `total ${fmtLedgerUsd(before.sellTotal)} → ${fmtLedgerUsd(next.sellTotal)}`
      : `total ${fmtLedgerUsd(next.sellTotal)}`
  const stagePart =
    before.lifecycleStage !== next.lifecycleStage
      ? ` · stage ${before.lifecycleStage} → ${next.lifecycleStage}`
      : ''
  return `Lines updated · ${totalPart}${stagePart}`
}

export function appendRevision(
  existing: InvoiceDocument,
  next: InvoiceDocument,
  actor: string,
): InvoiceRevisionEntry[] {
  const entry: InvoiceRevisionEntry = {
    id: `inv-rev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: next.generatedAt,
    actor,
    fingerprint: next.fingerprint,
    summary: revisionSummary(existing, next),
  }
  return [...existing.revisions, entry]
}

export function buildInvoiceSnapshot(input: {
  itinerary: Itinerary
  services: AddedService[]
  quoteGroups: QuoteGroup[]
  guestDetails: GuestDetail[]
  stage: InvoiceLifecycleStage
  generatedBy: string
  existing?: InvoiceDocument
}): InvoiceDocument {
  const { itinerary, services, quoteGroups, guestDetails, stage, generatedBy, existing } = input
  const guests = partyGuests(itinerary, guestDetails)
  const rawLines =
    services.length > 0 ? linesFromServices(services, guests) : linesFromQuoteGroups(quoteGroups)
  const lines = linesForRateBasis(rawLines, 'nett')
  const priceGroups = buildPriceGroups(lines)
  const scheduleGroups = buildLedgerScheduleGroups(lines)
  const pricing = buildSummaryPricing(lines, guests.length || (itinerary.adults || 0) + (itinerary.children || 0))
  const deposits = buildDepositSummary(lines, pricing.sellNumber)
  const optionRows = buildLedgerOptionRows(lines, services)
  const categoryTotals = categoryGridFromGroups(priceGroups)
  const arrivalIso =
    lines.map((l) => l.date).filter(Boolean).sort()[0] || itinerary.travelDateFrom || ''
  const paymentPosition = buildPaymentPosition(itinerary, pricing.sellNumber, deposits, stage, arrivalIso)
  const generatedAt = new Date().toISOString()
  const invoiceDate = generatedAt.slice(0, 10)
  const coverTitle = itinerary.title?.trim() || itineraryTitle(itinerary)
  const fingerprint = itineraryCommercialFp(services)

  const docLines = scheduleGroups.flatMap((group) =>
    group.rows.map((row, i) => ({
      lineId: `${group.name}-${i}-${row.date}-${row.supplier}`,
      type: (lines.find((l) => l.supplier === row.supplier)?.type ?? 'other') as InvoiceDocument['lines'][0]['type'],
      date: row.date,
      supplier: row.supplier,
      service: row.service,
      pax: row.pax,
      qty: row.qty,
      amount: row.amount,
      category: group.name,
    })),
  )

  const withoutRevisions = {
    id: existing?.id ?? `invoice-${itinerary.id}`,
    itineraryId: itinerary.id,
    invoiceNumber: existing?.invoiceNumber ?? invoiceNumberFor(itinerary),
    lifecycleStage: stage,
    fingerprint,
    generatedAt,
    generatedBy,
    invoiceDate,
    coverTitle,
    reference: itinerary.reference,
    sellTotal: pricing.sellNumber,
    lines: docLines,
    categoryTotals,
    scheduleGroups,
    pricingSummary: {
      grossSell: lines.reduce((sum, l) => sum + (l.net ?? 0), 0),
      sellTotal: pricing.sellNumber,
      discounts: pricing.discounts.map((d) => ({
        label: d.label,
        amount: Number.parseFloat(d.sellDelta.replace(/[^0-9.-]/g, '')) || 0,
      })),
    },
    optionRows,
    depositTotal: deposits.depositTotalNum,
    depositBalance: deposits.depositBalanceNum,
    depositPctOfSell: deposits.depositPctOfSell,
    paymentPosition,
  }

  return {
    ...withoutRevisions,
    revisions: existing
      ? appendRevision(existing, { ...withoutRevisions, revisions: existing.revisions }, generatedBy)
      : [],
  }
}

export type InvoiceRenderModel = {
  mode: 'draft' | 'frozen'
  stale: boolean
  invoiceNumber: string
  lifecycleStage: InvoiceLifecycleStage
  refLabel: string
  coverTitle: string
  reference: string
  invoiceDate: string
  sellTotal: number
  grossSell: number
  scheduleGroups: InvoiceDocument['scheduleGroups']
  categoryTotals: InvoiceDocument['categoryTotals']
  pricingSummary: InvoiceDocument['pricingSummary']
  optionRows: InvoiceDocument['optionRows']
  depositTotal: number
  depositBalance: number
  depositPctOfSell: number
  paymentPosition: InvoicePaymentPosition
  generatedAt?: string
  generatedBy?: string
  revisions: InvoiceRevisionEntry[]
}

export function renderModelFromSnapshot(invoice: InvoiceDocument, stale: boolean): InvoiceRenderModel {
  return {
    mode: 'frozen',
    stale,
    invoiceNumber: invoice.invoiceNumber,
    lifecycleStage: invoice.lifecycleStage,
    refLabel: `${invoice.reference} · ${invoice.invoiceNumber}`,
    coverTitle: invoice.coverTitle,
    reference: invoice.reference,
    invoiceDate: invoice.invoiceDate,
    sellTotal: invoice.sellTotal,
    grossSell: invoice.pricingSummary.grossSell,
    scheduleGroups: invoice.scheduleGroups,
    categoryTotals: invoice.categoryTotals,
    pricingSummary: invoice.pricingSummary,
    optionRows: invoice.optionRows,
    depositTotal: invoice.depositTotal,
    depositBalance: invoice.depositBalance,
    depositPctOfSell: invoice.depositPctOfSell,
    paymentPosition: invoice.paymentPosition,
    generatedAt: invoice.generatedAt,
    generatedBy: invoice.generatedBy,
    revisions: invoice.revisions,
  }
}

export function renderModelFromLive(input: {
  itinerary: Itinerary
  services: AddedService[]
  quoteGroups: QuoteGroup[]
  guestDetails: GuestDetail[]
  stage?: InvoiceLifecycleStage
}): InvoiceRenderModel {
  const snap = buildInvoiceSnapshot({
    ...input,
    stage: input.stage ?? 'deposit',
    generatedBy: 'preview',
  })
  return {
    mode: 'draft',
    stale: false,
    invoiceNumber: snap.invoiceNumber,
    lifecycleStage: snap.lifecycleStage,
    refLabel: `${input.itinerary.reference} · draft`,
    coverTitle: snap.coverTitle,
    reference: snap.reference,
    invoiceDate: snap.invoiceDate,
    sellTotal: snap.sellTotal,
    grossSell: snap.pricingSummary.grossSell,
    scheduleGroups: snap.scheduleGroups,
    categoryTotals: snap.categoryTotals,
    pricingSummary: snap.pricingSummary,
    optionRows: snap.optionRows,
    depositTotal: snap.depositTotal,
    depositBalance: snap.depositBalance,
    depositPctOfSell: snap.depositPctOfSell,
    paymentPosition: snap.paymentPosition,
    revisions: [],
  }
}

export function lifecycleStageLabel(stage: InvoiceLifecycleStage): string {
  return stage === 'full' ? 'Full' : 'Deposit'
}
