import { fmtLedgerDateShort, ledgerService } from '@/features/quote-doc/quoteLedgerModel'
import type { QuoteIncludesRow, QuotePaymentSnapshot, QuotePresentation } from '@/shared/lib/types'
import type { Itinerary } from '@/shared/lib/types'
import type { SummaryLine } from '@/features/summary/summaryModel'

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
  return presentation === 'B2B_PACKAGED' ? 'Packaged' : 'Itemised'
}
