import {
  buildLedgerOptionRows,
  buildLedgerScheduleGroups,
  categoryGridFromGroups,
  itineraryTitle,
  quoteValidUntil,
} from '@/features/quote-doc/quoteLedgerModel'
import { resolveQuoteText } from '@/features/quote-doc/quoteTextModel'
import { buildIncludesRows, buildPaymentSnapshot } from '@/features/quote-doc/quotePackagedModel'
import { linesForRateBasis } from '@/features/quote-doc/quoteRateBasisModel'
import {
  buildDepositSummary,
  buildPriceGroups,
  buildSummaryPricing,
  linesFromQuoteGroups,
  linesFromServices,
  type SummaryLine,
} from '@/features/summary/summaryModel'
import { itineraryCommercialFp } from '@/shared/lib/lifecycleRules'
import { partyGuests } from '@/shared/lib/helpers'
import type {
  AddedService,
  GuestDetail,
  Itinerary,
  QuoteDocument,
  QuoteGroup,
  QuotePresentation,
  QuoteRateBasis,
  QuoteTextContent,
} from '@/shared/lib/types'

export function nextQuoteSeq(existing: QuoteDocument[]): number {
  return existing.length + 1
}

export function isQuoteStale(quote: QuoteDocument, currentFp: string): boolean {
  return quote.fingerprint !== currentFp
}

export function buildQuoteSnapshot(input: {
  itinerary: Itinerary
  services: AddedService[]
  quoteGroups: QuoteGroup[]
  guestDetails: GuestDetail[]
  seq: number
  generatedBy: string
  rateBasis?: QuoteRateBasis
  presentation?: QuotePresentation
  quoteText?: QuoteTextContent
  showTerms?: boolean
  priceMode?: 'total' | 'pp'
}): QuoteDocument {
  const { itinerary, services, quoteGroups, guestDetails, seq, generatedBy } = input
  const rateBasis = input.rateBasis ?? 'nett'
  const presentation = input.presentation ?? 'B2B_ITEMISED'
  const quoteText = resolveQuoteText(itinerary.quoteTextDraft, input.quoteText)
  const showTerms = input.showTerms ?? true
  const priceMode = input.priceMode ?? 'pp'
  const guests = partyGuests(itinerary, guestDetails)
  const rawLines =
    services.length > 0 ? linesFromServices(services, guests) : linesFromQuoteGroups(quoteGroups)
  const lines = linesForRateBasis(rawLines, rateBasis)
  const totalGuests =
    guests.length || (itinerary.adults || 0) + (itinerary.children || 0) + (itinerary.infants || 0)
  const priceGroups = buildPriceGroups(lines)
  const scheduleGroups = buildLedgerScheduleGroups(lines)
  const pricing = buildSummaryPricing(lines, totalGuests)
  const deposits = buildDepositSummary(lines, pricing.sellNumber)
  const optionRows = buildLedgerOptionRows(lines, services)
  const categoryTotals = categoryGridFromGroups(priceGroups)
  const grossSell = lines.reduce((sum, l) => sum + (l.rack || 0), 0)
  const generatedAt = new Date().toISOString()
  const validUntil = quoteValidUntil(generatedAt.slice(0, 10))
  const coverTitle = itinerary.title?.trim() || itineraryTitle(itinerary)
  const fingerprint = itineraryCommercialFp(services)
  const includesRows = buildIncludesRows(lines)
  const paymentSnapshot = buildPaymentSnapshot(itinerary, pricing.sellNumber)

  const docLines = scheduleGroups.flatMap((group) =>
    group.rows.map((row, i) => ({
      lineId: `${group.name}-${i}-${row.date}-${row.supplier}`,
      type: (lines.find((l) => l.supplier === row.supplier)?.type ?? 'other') as QuoteDocument['lines'][0]['type'],
      date: row.date,
      supplier: row.supplier,
      service: row.service,
      pax: row.pax,
      qty: row.qty,
      amount: row.amount,
      category: group.name,
    })),
  )

  return {
    id: `quote-${itinerary.id}-${seq}`,
    itineraryId: itinerary.id,
    seq,
    versionLabel: `v${seq}`,
    docNumber: `Q${seq}`,
    fingerprint,
    generatedAt,
    generatedBy,
    rateBasis,
    presentation,
    validUntil,
    sellTotal: pricing.sellNumber,
    coverTitle,
    reference: itinerary.reference,
    lines: docLines,
    categoryTotals,
    scheduleGroups,
    pricingSummary: {
      grossSell,
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
    quoteText,
    showTerms,
    priceMode,
  }
}

export type QuoteRenderModel = {
  mode: 'draft' | 'frozen'
  stale: boolean
  presentation: QuotePresentation
  docNumber?: string
  versionLabel: string
  refLabel: string
  coverTitle: string
  reference: string
  validUntil: string
  sellTotal: number
  grossSell: number
  scheduleGroups: QuoteDocument['scheduleGroups']
  categoryTotals: QuoteDocument['categoryTotals']
  pricingSummary: QuoteDocument['pricingSummary']
  optionRows: QuoteDocument['optionRows']
  depositTotal: number
  depositBalance: number
  depositPctOfSell: number
  rateBasis: QuoteRateBasis
  includesRows: QuoteDocument['includesRows']
  paymentSnapshot: QuoteDocument['paymentSnapshot']
  generatedAt?: string
  generatedBy?: string
  quoteText: QuoteTextContent
  showTerms: boolean
  priceMode: 'total' | 'pp'
}

function baseRenderFields(quote: QuoteDocument, stale: boolean): QuoteRenderModel {
  return {
    mode: 'frozen',
    stale,
    presentation: quote.presentation ?? 'B2B_ITEMISED',
    docNumber: quote.docNumber,
    versionLabel: quote.versionLabel,
    refLabel: `${quote.reference} · ${quote.versionLabel}`,
    coverTitle: quote.coverTitle,
    reference: quote.reference,
    validUntil: quote.validUntil,
    sellTotal: quote.sellTotal,
    grossSell: quote.pricingSummary.grossSell,
    scheduleGroups: quote.scheduleGroups,
    categoryTotals: quote.categoryTotals,
    pricingSummary: quote.pricingSummary,
    optionRows: quote.optionRows,
    depositTotal: quote.depositTotal,
    depositBalance: quote.depositBalance,
    depositPctOfSell: quote.depositPctOfSell,
    rateBasis: quote.rateBasis,
    includesRows: quote.includesRows ?? buildIncludesRowsFromDocLines(quote),
    paymentSnapshot:
      quote.paymentSnapshot ?? {
        totalTripCost: quote.sellTotal,
        amountPaid: 0,
        balanceDue: quote.sellTotal,
      },
    generatedAt: quote.generatedAt,
    generatedBy: quote.generatedBy,
    quoteText: resolveQuoteText(undefined, quote.quoteText),
    showTerms: quote.showTerms ?? true,
    priceMode: quote.priceMode ?? 'pp',
  }
}

function buildIncludesRowsFromDocLines(quote: QuoteDocument) {
  return quote.lines.map((line) => ({
    lineId: line.lineId,
    date: line.date,
    supplier: line.supplier,
    description: line.service ? `${line.supplier} — ${line.service}` : line.supplier,
  }))
}

export function renderModelFromSnapshot(quote: QuoteDocument, stale: boolean): QuoteRenderModel {
  return baseRenderFields(quote, stale)
}

export function summaryLinesFromQuote(quote: QuoteDocument): SummaryLine[] {
  return quote.lines.map((line) => ({
    type: line.type,
    serviceId: line.lineId,
    lineId: line.lineId,
    date: line.date,
    supplier: line.supplier,
    net: line.amount,
    rack: line.amount,
    hold: 'none',
    chargePer: 'unit',
  }))
}

export function renderModelFromLive(input: {
  itinerary: Itinerary
  services: AddedService[]
  quoteGroups: QuoteGroup[]
  guestDetails: GuestDetail[]
  presentation?: QuotePresentation
  rateBasis?: QuoteRateBasis
  quoteText?: QuoteTextContent
  showTerms?: boolean
  priceMode?: 'total' | 'pp'
}): QuoteRenderModel {
  const snap = buildQuoteSnapshot({
    ...input,
    seq: 0,
    generatedBy: 'preview',
    presentation: input.presentation ?? 'B2B_ITEMISED',
    rateBasis: input.rateBasis ?? 'nett',
    quoteText: input.quoteText,
    showTerms: input.showTerms,
    priceMode: input.priceMode,
  })
  return {
    mode: 'draft',
    stale: false,
    presentation: snap.presentation,
    versionLabel: 'draft',
    refLabel: `${input.itinerary.reference} · draft`,
    coverTitle: snap.coverTitle,
    reference: snap.reference,
    validUntil: snap.validUntil,
    sellTotal: snap.sellTotal,
    grossSell: snap.pricingSummary.grossSell,
    scheduleGroups: snap.scheduleGroups,
    categoryTotals: snap.categoryTotals,
    pricingSummary: snap.pricingSummary,
    optionRows: snap.optionRows,
    depositTotal: snap.depositTotal,
    depositBalance: snap.depositBalance,
    depositPctOfSell: snap.depositPctOfSell,
    rateBasis: snap.rateBasis,
    includesRows: snap.includesRows,
    paymentSnapshot: snap.paymentSnapshot,
    quoteText: snap.quoteText!,
    showTerms: snap.showTerms ?? true,
    priceMode: snap.priceMode ?? 'pp',
  }
}
