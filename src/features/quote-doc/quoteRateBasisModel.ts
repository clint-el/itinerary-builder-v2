import { buildSummaryPricing, type SummaryLine } from '@/features/summary/summaryModel'
import type { QuotePresentation, QuoteRateBasis, QuoteRateBasisSelection } from '@/shared/lib/types'
import { isPackagedPresentation } from '@/features/quote-doc/quotePackagedModel'

export function rateBasisTag(basis: QuoteRateBasis): string {
  return basis === 'rack' ? 'All prices in USD' : 'All prices in USD net'
}

export function rateBasisLabel(basis: QuoteRateBasis): string {
  return basis === 'rack' ? 'Rack' : 'Nett'
}

export function rateBasisSelectionLabel(selection: QuoteRateBasisSelection): string {
  if (selection === 'both') return 'Both'
  return rateBasisLabel(selection)
}

/** Remap line amounts so ledger pricing helpers use the chosen rate basis. */
export function linesForRateBasis(lines: SummaryLine[], rateBasis: QuoteRateBasis): SummaryLine[] {
  if (rateBasis === 'rack') return lines
  return lines.map((line) => ({
    ...line,
    rack: line.net ?? 0,
    discount: line.discount
      ? {
          ...line.discount,
          sellDelta: line.discount.costDelta ?? 0,
        }
      : undefined,
  }))
}

/** Discount row amounts on PDFs always reflect sell (rack) reductions, including on nett documents. */
export function rackDiscountAmounts(rawLines: SummaryLine[]): { label: string; amount: number }[] {
  return buildSummaryPricing(rawLines, 1).discounts.map((d) => ({
    label: d.label,
    amount: Math.abs(Number.parseFloat(d.sellDelta.replace(/[^0-9.-]/g, '')) || 0),
  }))
}

export function quoteDocumentRateBasis(
  presentation: QuotePresentation,
  selected: QuoteRateBasis,
): QuoteRateBasis {
  return isPackagedPresentation(presentation) ? 'rack' : selected
}

export function invoiceDocumentRateBasis(presentation: QuotePresentation): QuoteRateBasis {
  return isPackagedPresentation(presentation) ? 'rack' : 'nett'
}
