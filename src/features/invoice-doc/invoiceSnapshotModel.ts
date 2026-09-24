import {
  buildLedgerOptionRows,
  buildLedgerScheduleGroups,
  categoryGridFromGroups,
  fmtLedgerUsd,
  documentCoverTitle,
  paxPriceSplit,
} from '@/features/quote-doc/quoteLedgerModel'
import {
  layoutModeFromPresentation,
  resolveInvoiceDocumentOptions,
} from '@/features/quote-doc/documentOptionsModel'
import {
  buildIncludesRows,
  buildPackagedCategoryRows,
  buildPaymentSnapshot,
  isPackagedPresentation,
  resolvePackagedCategoryRows,
} from '@/features/quote-doc/quotePackagedModel'
import { resolveQuoteText } from '@/features/quote-doc/quoteTextModel'
import { linesForRateBasis } from '@/features/quote-doc/quoteRateBasisModel'
import { buildRolledUpRows } from '@/features/invoice-doc/invoiceRolledUpModel'
import {
  buildDepositSummary,
  buildPaymentHistory,
  buildPriceGroups,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
  type DepositSummary,
} from '@/features/summary/summaryModel'
import { resolveInvoiceAddresseeProfile } from '@/features/invoice-doc/invoiceAddresseeModel'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import { partyGuests } from '@/shared/lib/helpers'
import type {
  AddedService,
  GuestDetail,
  InvoiceDocument,
  InvoiceLifecycleStage,
  InvoicePaymentPosition,
  InvoiceRenderingDepth,
  InvoiceRevisionEntry,
  Itinerary,
  PaxPriceSplit,
  QuoteGroup,
  QuotePresentation,
  QuoteTextContent,
} from '@/shared/lib/types'
import type { QuoteRenderModel } from '@/features/quote-doc/quoteSnapshotModel'

export function invoiceNumberFor(itinerary: Itinerary): string {
  return `${itinerary.reference}-INV`
}

export function isInvoiceStale(invoice: InvoiceDocument, currentFp: string): boolean {
  return invoice.fingerprint !== currentFp
}

/** Deposit due now, or balance payment due when the invoice is full-stage. */
export function paymentDueNowAmount(pos: InvoicePaymentPosition): number {
  return pos.amountDueImmediately > 0 ? pos.amountDueImmediately : pos.futureAmountDue ?? 0
}

/**
 * Map booking ledger (totalUsd / balanceUsd) onto invoice sell so payment position
 * reconciles: sell total = deposit paid + deposit due + balance payment due.
 */
export function clientPaymentsOnSell(
  itinerary: Pick<Itinerary, 'totalUsd' | 'balanceUsd'>,
  sellTotal: number,
): { paid: number; balance: number } {
  const bookingTotal = itinerary.totalUsd ?? sellTotal
  const bookingBalance = itinerary.balanceUsd ?? bookingTotal
  const paidOnBooking = Math.max(0, Math.round((bookingTotal - bookingBalance) * 100) / 100)

  if (bookingTotal <= 0) {
    return { paid: 0, balance: Math.round(sellTotal * 100) / 100 }
  }

  if (Math.abs(bookingTotal - sellTotal) < 0.01) {
    return {
      paid: paidOnBooking,
      balance: Math.round(bookingBalance * 100) / 100,
    }
  }

  const paid = Math.min(
    sellTotal,
    Math.round((paidOnBooking / bookingTotal) * sellTotal * 100) / 100,
  )
  const balance = Math.round((sellTotal - paid) * 100) / 100
  return { paid, balance }
}

export function buildPaymentPosition(
  itinerary: Itinerary,
  sellTotal: number,
  deposits: DepositSummary,
  stage: InvoiceLifecycleStage,
  arrivalIso?: string,
): InvoicePaymentPosition {
  const { paid, balance } = clientPaymentsOnSell(itinerary, sellTotal)

  const history = buildPaymentHistory(sellTotal, arrivalIso)
  const nextUnpaid = history.rows.find((row) => row.status !== 'Paid')

  if (stage === 'full') {
    const dueBalance = Math.max(0, balance)
    return {
      total: sellTotal,
      paid,
      balance,
      amountDueImmediately: 0,
      futureAmountDue: dueBalance > 0 ? dueBalance : undefined,
      futureDueDate: dueBalance > 0 ? history.finalDue : undefined,
    }
  }

  const depositStillDue = Math.max(0, deposits.depositTotalNum - paid)
  const amountDueImmediately =
    balance <= 0 ? 0 : depositStillDue > 0 ? Math.min(balance, depositStillDue) : balance
  const futureAmountDue = Math.max(0, balance - amountDueImmediately)
  const depositDueFromSummary = deposits.depositRows[0]?.due?.replace(/^Due\s+/i, '').trim()
  const depositDueDate =
    amountDueImmediately > 0
      ? (nextUnpaid?.date ?? depositDueFromSummary ?? undefined)
      : undefined

  return {
    total: sellTotal,
    paid,
    balance,
    amountDueImmediately,
    depositDueDate,
    futureAmountDue: futureAmountDue > 0 ? futureAmountDue : undefined,
    futureDueDate: futureAmountDue > 0 ? history.finalDue : undefined,
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
  stage?: InvoiceLifecycleStage
  generatedBy: string
  existing?: InvoiceDocument
  presentation?: QuotePresentation
  /** BR-I57/OD-17 — column depth for B2B_ITEMISED; ignored for packaged presentations. TC
   *  invoices (BR-I56) always render rolled-up regardless of this input. */
  renderingDepth?: InvoiceRenderingDepth
  travelCounsellors?: boolean
  quoteText?: QuoteTextContent
  showTerms?: boolean
}): InvoiceDocument {
  const { itinerary, services, quoteGroups, guestDetails, generatedBy, existing } = input
  const layoutMode = layoutModeFromPresentation(
    input.presentation ?? existing?.presentation ?? 'B2B_ITEMISED',
  )
  const resolved = resolveInvoiceDocumentOptions(itinerary, { layoutMode })
  const presentation = input.presentation ?? existing?.presentation ?? resolved.presentation
  const stage = input.stage ?? resolved.lifecycleStage
  const travelCounsellors = input.travelCounsellors ?? resolved.travelCounsellors
  const renderingDepth: InvoiceRenderingDepth = travelCounsellors
    ? 'rolled_up'
    : (input.renderingDepth ?? resolved.renderingDepth)
  const quoteText = resolveQuoteText(itinerary.quoteTextDraft, input.quoteText ?? existing?.quoteText)
  const showTerms = input.showTerms ?? resolved.showTerms
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
  const invoiceDate = existing?.invoiceDate ?? generatedAt.slice(0, 10)
  const includesRows = buildIncludesRows(lines)
  const paymentSnapshot = buildPaymentSnapshot(itinerary, pricing.sellNumber)
  const coverTitle = documentCoverTitle(itinerary)
  const fingerprint = itineraryCommercialFp(services)
  const totalAdults = guests.filter((g) => g.type === 'adult' || g.type === 'youth').length
  const totalChildren = guests.filter((g) => g.type === 'child' || g.type === 'infant').length
  const paxSplit: PaxPriceSplit = paxPriceSplit(lines, totalAdults, totalChildren)
  const rolledUpRows =
    presentation === 'B2B_ITEMISED' && renderingDepth === 'rolled_up'
      ? buildRolledUpRows(lines, travelCounsellors)
      : undefined
  const packagedCategoryRows = isPackagedPresentation(presentation)
    ? buildPackagedCategoryRows(rawLines)
    : undefined
  const invoiceAddressee = resolveInvoiceAddresseeProfile({
    itinerary,
    guests: guestDetails,
    travelCounsellors,
  })

  const docLines = scheduleGroups.flatMap((group) =>
    group.rows.map((row, i) => ({
      lineId: `${group.name}-${i}-${row.date}-${row.supplier}`,
      type: (lines.find((l) => l.supplier === row.supplier)?.type ?? 'other') as InvoiceDocument['lines'][0]['type'],
      date: row.date,
      supplier: row.supplier,
      service: row.service,
      pax: row.pax,
      qty: row.qty,
      duration: row.duration,
      unitPrice: row.unitPrice,
      amount: row.amount,
      category: group.name,
    })),
  )

  const withoutRevisions = {
    id: existing?.id ?? `invoice-${itinerary.id}`,
    itineraryId: itinerary.id,
    invoiceNumber: existing?.invoiceNumber ?? invoiceNumberFor(itinerary),
    lifecycleStage: stage,
    presentation,
    renderingDepth,
    travelCounsellors,
    fingerprint,
    generatedAt,
    generatedBy,
    invoiceDate,
    coverTitle,
    reference: itinerary.reference,
    sellTotal: pricing.sellNumber,
    lines: docLines,
    categoryTotals,
    packagedCategoryRows,
    scheduleGroups,
    rolledUpRows,
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
    includesRows,
    paymentSnapshot,
    paxPriceSplit: paxSplit,
    quoteText,
    showTerms,
    paymentPosition,
    invoiceAddressee,
    sendHistory: existing?.sendHistory,
    lastSentAt: existing?.lastSentAt,
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
  packagedCategoryRows?: InvoiceDocument['packagedCategoryRows']
  pricingSummary: InvoiceDocument['pricingSummary']
  optionRows: InvoiceDocument['optionRows']
  depositTotal: number
  depositBalance: number
  depositPctOfSell: number
  paymentPosition: InvoicePaymentPosition
  generatedAt?: string
  generatedBy?: string
  revisions: InvoiceRevisionEntry[]
  presentation: QuotePresentation
  renderingDepth: InvoiceRenderingDepth
  travelCounsellors: boolean
  rolledUpRows?: InvoiceDocument['rolledUpRows']
  includesRows: InvoiceDocument['includesRows']
  paymentSnapshot: NonNullable<InvoiceDocument['paymentSnapshot']>
  paxPriceSplit: PaxPriceSplit
  quoteText: QuoteTextContent
  showTerms: boolean
  invoiceAddressee: NonNullable<InvoiceDocument['invoiceAddressee']>
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
    packagedCategoryRows: invoice.packagedCategoryRows,
    pricingSummary: invoice.pricingSummary,
    optionRows: invoice.optionRows,
    depositTotal: invoice.depositTotal,
    depositBalance: invoice.depositBalance,
    depositPctOfSell: invoice.depositPctOfSell,
    paymentPosition: invoice.paymentPosition,
    generatedAt: invoice.generatedAt,
    generatedBy: invoice.generatedBy,
    revisions: invoice.revisions,
    presentation: invoice.presentation ?? 'B2B_ITEMISED',
    renderingDepth: invoice.renderingDepth ?? 'full',
    travelCounsellors: invoice.travelCounsellors ?? false,
    rolledUpRows: invoice.rolledUpRows,
    includesRows: invoice.includesRows ?? [],
    paymentSnapshot:
      invoice.paymentSnapshot ?? {
        totalTripCost: invoice.sellTotal,
        amountPaid: invoice.paymentPosition.paid,
        balanceDue: invoice.paymentPosition.balance,
      },
    // Fallback covers invoices generated before BR-I58 (older localStorage snapshots).
    paxPriceSplit: invoice.paxPriceSplit ?? { totalAdults: 0, totalChildren: 0, totalAdultPrice: 0, totalChildPrice: 0 },
    quoteText: resolveQuoteText(undefined, invoice.quoteText),
    showTerms: invoice.showTerms ?? true,
    invoiceAddressee: invoice.invoiceAddressee ?? {
      type: 'agency',
      legalName: '—',
      addressLines: [],
    },
  }
}

export function renderModelFromLive(input: {
  itinerary: Itinerary
  services: AddedService[]
  quoteGroups: QuoteGroup[]
  guestDetails: GuestDetail[]
  stage?: InvoiceLifecycleStage
  presentation?: QuotePresentation
  renderingDepth?: InvoiceRenderingDepth
  travelCounsellors?: boolean
  quoteText?: QuoteTextContent
  showTerms?: boolean
}): InvoiceRenderModel {
  const snap = buildInvoiceSnapshot({
    ...input,
    generatedBy: 'preview',
  })
  return {
    mode: 'draft',
    stale: false,
    invoiceNumber: snap.invoiceNumber,
    lifecycleStage: snap.lifecycleStage,
    refLabel: input.itinerary.reference,
    coverTitle: snap.coverTitle,
    reference: snap.reference,
    invoiceDate: snap.invoiceDate,
    sellTotal: snap.sellTotal,
    grossSell: snap.pricingSummary.grossSell,
    scheduleGroups: snap.scheduleGroups,
    categoryTotals: snap.categoryTotals,
    packagedCategoryRows: snap.packagedCategoryRows,
    pricingSummary: snap.pricingSummary,
    optionRows: snap.optionRows,
    depositTotal: snap.depositTotal,
    depositBalance: snap.depositBalance,
    depositPctOfSell: snap.depositPctOfSell,
    paymentPosition: snap.paymentPosition,
    revisions: [],
    presentation: snap.presentation ?? 'B2B_ITEMISED',
    renderingDepth: snap.renderingDepth ?? 'full',
    travelCounsellors: snap.travelCounsellors ?? false,
    rolledUpRows: snap.rolledUpRows,
    includesRows: snap.includesRows ?? [],
    paymentSnapshot: snap.paymentSnapshot!,
    paxPriceSplit: snap.paxPriceSplit,
    quoteText: snap.quoteText!,
    showTerms: snap.showTerms ?? true,
    invoiceAddressee: snap.invoiceAddressee!,
  }
}

export function lifecycleStageLabel(stage: InvoiceLifecycleStage): string {
  return stage === 'full' ? 'Full' : 'Deposit'
}

export function invoiceAsQuoteRenderModel(model: InvoiceRenderModel): QuoteRenderModel {
  return {
    mode: model.mode,
    stale: model.stale,
    presentation: model.presentation ?? 'B2B_ITEMISED',
    versionLabel: model.invoiceNumber,
    refLabel: model.refLabel,
    coverTitle: model.coverTitle,
    reference: model.reference,
    validUntil: model.invoiceDate,
    sellTotal: model.sellTotal,
    grossSell: model.grossSell,
    scheduleGroups: model.scheduleGroups,
    categoryTotals: model.categoryTotals,
    packagedCategoryRows: resolvePackagedCategoryRows({
      packagedCategoryRows: model.packagedCategoryRows,
      categoryTotals: model.categoryTotals,
    }),
    pricingSummary: model.pricingSummary,
    optionRows: model.optionRows,
    depositTotal: model.depositTotal,
    depositBalance: model.depositBalance,
    depositPctOfSell: model.depositPctOfSell,
    rateBasis: 'nett',
    includesRows: model.includesRows ?? [],
    paymentSnapshot: model.paymentSnapshot,
    paxPriceSplit: model.paxPriceSplit,
    quoteText: model.quoteText,
    showTerms: model.showTerms,
    priceMode: 'total',
    generatedAt: model.generatedAt,
    generatedBy: model.generatedBy,
    invoiceAddressee: model.invoiceAddressee,
    paymentPosition: model.paymentPosition,
  }
}
