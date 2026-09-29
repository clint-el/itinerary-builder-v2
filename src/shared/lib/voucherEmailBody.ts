/** Ordinal date for supplier voucher email copy, e.g. 12th Aug 2027 */
export function fmtVoucherEmailDate(iso: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const suffix =
    d % 10 === 1 && d !== 11 ? 'st' : d % 10 === 2 && d !== 12 ? 'nd' : d % 10 === 3 && d !== 13 ? 'rd' : 'th'
  return `${d}${suffix} ${months[m - 1]} ${y}`
}

export function fmtVoucherEmailDateRange(from: string, to: string): string {
  if (!from && !to) return ''
  if (!to || from === to) return fmtVoucherEmailDate(from)
  return `${fmtVoucherEmailDate(from)} - ${fmtVoucherEmailDate(to)}`
}

export function buildVoucherConfirmEmailBody(input: {
  voucherRef: string
  serviceDateFrom: string
  serviceDateTo: string
  tripTitle?: string
}): string {
  const dates = fmtVoucherEmailDateRange(input.serviceDateFrom, input.serviceDateTo)
  const datePart = dates ? ` ${dates}` : ''
  const titlePart = input.tripTitle?.trim() ? ` (${input.tripTitle.trim()})` : ''
  return `Please confirm the services for ${input.voucherRef}${datePart}${titlePart}.`
}
