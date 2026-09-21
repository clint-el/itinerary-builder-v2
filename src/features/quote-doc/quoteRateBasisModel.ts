import type { QuoteRateBasis, QuoteRateBasisSelection } from '@/shared/lib/types'
import type { SummaryLine } from '@/features/summary/summaryModel'

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
