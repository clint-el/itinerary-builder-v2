import { describe, expect, it } from 'vitest'
import { buildVoucherConfirmEmailBody, fmtVoucherEmailDateRange } from './voucherEmailBody'

describe('voucherEmailBody', () => {
  it('formats ordinal service dates in the confirm line', () => {
    expect(fmtVoucherEmailDateRange('2027-08-12', '2027-08-30')).toBe('12th Aug 2027 - 30th Aug 2027')
    expect(
      buildVoucherConfirmEmailBody({
        voucherRef: 'CPS5678-1-1 / V02',
        serviceDateFrom: '2027-08-12',
        serviceDateTo: '2027-08-30',
        tripTitle: 'Delacroix — Grandparents',
      }),
    ).toBe(
      'Please confirm the services for CPS5678-1-1 / V02 12th Aug 2027 - 30th Aug 2027 (Delacroix — Grandparents).',
    )
  })
})
