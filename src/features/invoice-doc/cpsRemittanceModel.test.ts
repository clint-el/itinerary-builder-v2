import { describe, expect, it } from 'vitest'
import {
  CPS_BANK_ACCOUNTS,
  CPS_OFFICES,
  CPS_REMITTANCE_PAGE_COUNT,
  remittanceStartPage,
} from '@/features/invoice-doc/cpsRemittanceModel'

describe('cpsRemittanceModel', () => {
  it('includes Kenya, Tanzania, and Rwanda bank accounts', () => {
    expect(CPS_BANK_ACCOUNTS.map((a) => a.country)).toEqual(['Kenya', 'Tanzania', 'Rwanda'])
    expect(CPS_BANK_ACCOUNTS[0]?.swiftCode).toBe('BARCKENX')
    expect(CPS_BANK_ACCOUNTS[1]?.accountName).toContain('T) Ltd.')
    expect(CPS_BANK_ACCOUNTS[2]?.swiftCode).toBe('IMRWRWRWXXX')
  })

  it('includes all three office locations', () => {
    expect(CPS_OFFICES.map((o) => o.country)).toEqual(['Kenya', 'Rwanda', 'Tanzania'])
    expect(CPS_OFFICES.every((o) => o.email === 'info@chelipeacock.com')).toBe(true)
  })

  it('appends two remittance pages after terms on itemised invoices', () => {
    expect(CPS_REMITTANCE_PAGE_COUNT).toBe(2)
    expect(remittanceStartPage(false, true)).toBe(6)
    expect(remittanceStartPage(false, false)).toBe(5)
    expect(remittanceStartPage(true, true)).toBe(5)
    expect(remittanceStartPage(true, false)).toBe(4)
  })
})
