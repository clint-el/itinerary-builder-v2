import { ledgerService } from '@/features/quote-doc/quoteLedgerModel'
import type { SummaryLine } from '@/features/summary/summaryModel'
import type { InvoiceRolledUpRow } from '@/shared/lib/types'

/** BR-I56: Travel Counsellors head-office commission rate on qualifying services. This is a
 *  demo-scope simplification — there is no per-service "qualifying" flag anywhere else in the
 *  data model, so every priced (non-zero, non-complimentary) line qualifies. A production
 *  commission engine would likely need a configurable qualifying-service flag per agency
 *  contract; noted as an assumption, not built here. */
const TC_COMMISSION_RATE = 0.06

function lineGross(l: SummaryLine) {
  return l.rack - (l.discount?.sellDelta || 0)
}

function lineNet(l: SummaryLine) {
  return l.net - (l.discount?.costDelta || 0)
}

/** BR-I57/OD-17 — rolls the full line-level itemised breakdown up to one row per service
 *  description (Description, Gross Price, Commission where applicable, Net Amount), collapsing
 *  date/qty/duration/unit-price granularity. Grouped by supplier + service description so the
 *  same room/route/service across multiple dates collapses into a single row.
 *
 *  Commission modelling (a judgment call, not a settled spec detail — see report):
 *  - Standard (non-TC): Commission = Gross Price − Net Amount, reusing this app's existing
 *    rack/net fields as the agent-facing commission figure. There is no separate commission-rate
 *    field in the data model, so this is the closest existing concept to "commission" available.
 *  - Travel Counsellors (BR-I56): Commission = 6% of Gross Price on qualifying (priced) lines,
 *    and Net Amount = Gross − Commission, overriding the standard net/rack economics so the
 *    underlying supplier cost is not exposed on the TC document — consistent with the "protect
 *    head-office commission economics" intent noted against TC-case quotes (Quote BRD OD-08).
 *  - Commission is omitted (not shown as 0.00) for zero-priced/complimentary lines, since
 *    commission does not apply there. */
export function buildRolledUpRows(lines: SummaryLine[], travelCounsellors = false): InvoiceRolledUpRow[] {
  const byKey = new Map<string, { description: string; gross: number; net: number }>()

  for (const line of lines) {
    const service = ledgerService(line)
    const description = line.supplier && service !== line.supplier ? `${line.supplier} — ${service}` : line.supplier || service || 'Service'
    const gross = lineGross(line)
    const net = travelCounsellors ? gross * (1 - TC_COMMISSION_RATE) : lineNet(line)
    const existing = byKey.get(description)
    if (existing) {
      existing.gross += gross
      existing.net += net
    } else {
      byKey.set(description, { description, gross, net })
    }
  }

  return [...byKey.values()]
    .sort((a, b) => a.description.localeCompare(b.description))
    .map((row) => {
      const grossPrice = Math.round(row.gross * 100) / 100
      const netAmount = Math.round(row.net * 100) / 100
      const commission = Math.round((grossPrice - netAmount) * 100) / 100
      return {
        description: row.description,
        grossPrice,
        commission: commission > 0.004 ? commission : undefined,
        netAmount,
      }
    })
}
