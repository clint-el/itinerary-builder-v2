import { fmtLedgerDateShort, ledgerService } from '@/features/quote-doc/quoteLedgerModel'
import { buildPriceGroups, type SummaryLine } from '@/features/summary/summaryModel'
import type {
  Itinerary,
  QuoteIncludesRow,
  QuotePackagedCategoryRow,
  QuotePaymentSnapshot,
  QuotePresentation,
} from '@/shared/lib/types'

export function buildIncludesRows(lines: SummaryLine[]): QuoteIncludesRow[] {
  return [...lines]
    .sort((a, b) => {
      const dateCmp = (a.date || '').localeCompare(b.date || '')
      if (dateCmp !== 0) return dateCmp
      return (a.supplier || '').localeCompare(b.supplier || '')
    })
    .map((line, index) => {
      const serviceText = ledgerService(line)
      const description = serviceText && serviceText !== line.supplier
        ? `${line.supplier} — ${serviceText}`
        : line.supplier || serviceText || 'Service'
      return {
        lineId: line.lineId || `${line.serviceId}-${index}`,
        date: fmtLedgerDateShort(line.date),
        supplier: line.supplier,
        description,
      }
    })
}

export function buildPackagedCategoryRows(lines: SummaryLine[]): QuotePackagedCategoryRow[] {
  return buildPriceGroups(lines).map((group) => ({
    description: group.name,
    grossPrice:
      Math.round(group.lines.reduce((sum, line) => sum + (line.rack || 0), 0) * 100) / 100,
    netAmount:
      Math.round(group.lines.reduce((sum, line) => sum + (line.net || 0), 0) * 100) / 100,
  }))
}

export function resolvePackagedCategoryRows(input: {
  packagedCategoryRows?: QuotePackagedCategoryRow[]
  categoryTotals?: { name: string; amount: number }[]
}): QuotePackagedCategoryRow[] {
  if (input.packagedCategoryRows?.length) return input.packagedCategoryRows
  return (input.categoryTotals ?? []).map((cat) => ({
    description: cat.name,
    grossPrice: cat.amount,
    netAmount: cat.amount,
  }))
}

export function buildPaymentSnapshot(itinerary: Itinerary, sellTotal: number): QuotePaymentSnapshot {
  const totalUsd = itinerary.totalUsd || 0
  const balanceUsd = itinerary.balanceUsd ?? totalUsd
  return {
    totalTripCost: sellTotal,
    amountPaid: Math.max(0, Math.round((totalUsd - balanceUsd) * 100) / 100),
    balanceDue: Math.round(balanceUsd * 100) / 100,
  }
}

export function presentationLabel(presentation: QuotePresentation): string {
  if (presentation === 'B2B_ITEMISED') return 'Itemised'
  return 'Packaged'
}

/** BR-Q24/BR-I03: itemised is B2B-only — there is no B2C_ITEMISED value, so "packaged" is
 *  simply "not itemised" across both B2B and B2C presentations. */
export function isPackagedPresentation(presentation: QuotePresentation): boolean {
  return presentation !== 'B2B_ITEMISED'
}

export function isB2C(presentation: QuotePresentation): boolean {
  return presentation === 'B2C_PACKAGED'
}
