export type VoucherFilingPaymentTermRow = {
  name: string
  travelDates: string
  deposit: string
  balanceDue: string
}

/** Plain-text filing copy sent as a PDF attachment with the voucher email. */
export type VoucherFilingCopy = {
  supplier: string
  bookingRef: string
  voucherRef: string
  dateRange: string
  leadGuest: string
  partyMix: string
  agency: string
  total: string
  plannerNote?: string
  guestLines: { name: string; role: string; dietary: string; additional: string }[]
  serviceLines: { date: string; service: string; detail: string; pax: string; value: string }[]
  deposit: string
  depositRule: string
  paymentTermRows: VoucherFilingPaymentTermRow[]
}

export function voucherFilingFilename(voucherRef: string): string {
  const safe = voucherRef.replace(/[^\w\-./ ]+/g, '_').replace(/\s+/g, '-')
  return `voucher-filing-${safe}.pdf`
}

/** Build attachment payload from a live voucher card at issue time. */
export function buildVoucherFilingCopyFromCard(
  card: {
    supplier: string
    ref: string
    dateRange: string
    leadGuest: string
    partyMix: string
    agency: string
    total: string
    deposit: string
    depositRule: string
    paymentTermRows: VoucherFilingPaymentTermRow[]
    note?: string
    guestRoster: { name: string; role: string; dietaryText: string; additionalText: string }[]
    rows: { date: string; service: string; detail: string; pax: string; value: string }[]
  },
  bookingRef: string,
): VoucherFilingCopy {
  return {
    supplier: card.supplier,
    bookingRef,
    voucherRef: card.ref,
    dateRange: card.dateRange,
    leadGuest: card.leadGuest,
    partyMix: card.partyMix,
    agency: card.agency,
    total: card.total,
    plannerNote: card.note,
    guestLines: card.guestRoster.map((g) => ({
      name: g.name,
      role: g.role,
      dietary: g.dietaryText,
      additional: g.additionalText,
    })),
    serviceLines: card.rows.map((r) => ({
      date: r.date,
      service: r.service,
      detail: r.detail,
      pax: r.pax,
      value: r.value,
    })),
    deposit: card.deposit,
    depositRule: card.depositRule,
    paymentTermRows: card.paymentTermRows,
  }
}
