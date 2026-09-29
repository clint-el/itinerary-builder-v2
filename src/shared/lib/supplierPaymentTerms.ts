import { fmtLedgerDateShort } from '@/features/quote-doc/quoteLedgerModel'

/** Shape returned by supplier master (paymentTerms[]). */
export type SupplierPaymentTermRecord = {
  id?: string
  name: string
  travelDatesFrom: string
  travelDatesTo: string
  depositPercent: number
  balanceDueDays: number
  isActive?: boolean
}

export type SupplierPaymentTermRow = {
  name: string
  travelDates: string
  deposit: string
  balanceDue: string
}

type SupplierTermCatalogEntry = {
  match: string | RegExp
  terms: SupplierPaymentTermRecord[]
}

/** Demo catalog — replace with supplier API / cache in production. */
const SUPPLIER_PAYMENT_TERM_CATALOG: SupplierTermCatalogEntry[] = [
  {
    match: /four seasons|serengeti/i,
    terms: [
      {
        name: 'Standard',
        travelDatesFrom: '2026-01-01',
        travelDatesTo: '2028-12-31',
        depositPercent: 50,
        balanceDueDays: 14,
        isActive: true,
      },
    ],
  },
  {
    match: /andbeyond|suyian/i,
    terms: [
      {
        name: 'Groups',
        travelDatesFrom: '2027-01-11',
        travelDatesTo: '2028-01-10',
        depositPercent: 30,
        balanceDueDays: 90,
        isActive: true,
      },
    ],
  },
  {
    match: /elewana/i,
    terms: [
      {
        name: 'Standard',
        travelDatesFrom: '2026-01-01',
        travelDatesTo: '2029-12-31',
        depositPercent: 25,
        balanceDueDays: 45,
        isActive: true,
      },
    ],
  },
  {
    match: /hemingways/i,
    terms: [
      {
        name: 'Standard',
        travelDatesFrom: '2026-01-01',
        travelDatesTo: '2029-12-31',
        depositPercent: 30,
        balanceDueDays: 30,
        isActive: true,
      },
    ],
  },
  {
    match: /airkenya|auric/i,
    terms: [
      {
        name: 'Full prepayment',
        travelDatesFrom: '2026-01-01',
        travelDatesTo: '2029-12-31',
        depositPercent: 100,
        balanceDueDays: 0,
        isActive: true,
      },
    ],
  },
]

function catalogForSupplier(supplierName: string): SupplierPaymentTermRecord[] {
  for (const entry of SUPPLIER_PAYMENT_TERM_CATALOG) {
    const hit =
      typeof entry.match === 'string'
        ? supplierName.toLowerCase().includes(entry.match.toLowerCase())
        : entry.match.test(supplierName)
    if (hit) return entry.terms
  }
  return []
}

function termOverlapsTravel(term: SupplierPaymentTermRecord, travelFrom: string, travelTo: string): boolean {
  const from = travelFrom || travelTo
  const to = travelTo || travelFrom
  if (!from) return true
  const tripStart = from
  const tripEnd = to || from
  return term.travelDatesFrom <= tripEnd && term.travelDatesTo >= tripStart
}

function formatTravelWindow(from: string, to: string): string {
  if (from && to && from !== to) {
    return `${fmtLedgerDateShort(from)} – ${fmtLedgerDateShort(to)}`
  }
  if (from) return `${fmtLedgerDateShort(from)} onwards`
  return 'All travel dates'
}

function formatBalanceDue(days: number): string {
  if (!days) return 'On confirmation'
  return `${days} days before arrival`
}

function formatDeposit(pct: number): string {
  if (pct >= 100) return '100% at booking'
  return `${pct}% on confirmation`
}

function recordToRow(term: SupplierPaymentTermRecord): SupplierPaymentTermRow {
  return {
    name: term.name,
    travelDates: formatTravelWindow(term.travelDatesFrom, term.travelDatesTo),
    deposit: formatDeposit(term.depositPercent),
    balanceDue: formatBalanceDue(term.balanceDueDays),
  }
}

function fallbackFromLegacyRule(legacy?: { pct: number; days: number }): SupplierPaymentTermRow[] {
  const pct = legacy?.pct ?? 50
  const days = legacy?.days ?? 14
  return [
    {
      name: 'Contract default',
      travelDates: 'All travel dates',
      deposit: formatDeposit(pct),
      balanceDue: formatBalanceDue(days),
    },
  ]
}

/** Terms that apply to this supplier for the trip window (active terms only when flagged). */
export function paymentTermsForSupplier(
  supplierName: string,
  travelFrom: string,
  travelTo: string,
  legacy?: { pct: number; days: number },
): SupplierPaymentTermRow[] {
  const catalog = catalogForSupplier(supplierName)
  const active = catalog.filter((t) => t.isActive !== false)
  const pool = active.length ? active : catalog
  const matched = pool.filter((t) => termOverlapsTravel(t, travelFrom, travelTo))
  if (matched.length) return matched.map(recordToRow)
  if (pool.length) return pool.map(recordToRow)
  return fallbackFromLegacyRule(legacy)
}

function primaryRecord(
  supplierName: string,
  travelFrom: string,
  travelTo: string,
): SupplierPaymentTermRecord | undefined {
  const catalog = catalogForSupplier(supplierName)
  const pool = catalog.filter((t) => t.isActive !== false).length ? catalog.filter((t) => t.isActive !== false) : catalog
  const matched = pool.filter((t) => termOverlapsTravel(t, travelFrom, travelTo))
  return matched[0] ?? pool[0]
}

/** Primary term drives deposit amount / due date on the voucher footer. */
export function primaryPaymentTermPercent(
  supplierName: string,
  travelFrom: string,
  travelTo: string,
  legacyPct: number,
): number {
  return primaryRecord(supplierName, travelFrom, travelTo)?.depositPercent ?? legacyPct
}

export function primaryPaymentTermBalanceDays(
  supplierName: string,
  travelFrom: string,
  travelTo: string,
  legacyDays: number,
): number {
  return primaryRecord(supplierName, travelFrom, travelTo)?.balanceDueDays ?? legacyDays
}
