import { describe, expect, it } from 'vitest'
import {
  deriveInvoiceLifecycleStage,
  deriveRenderingDepth,
  effectiveLayoutMode,
  invoiceCoverKindLabel,
  invoiceDocumentOptionsSummary,
  isB2cChannel,
  isTravelCounsellorsAgency,
  layoutModeFromPresentation,
  presentationFromLayoutMode,
  quotationCoverKindLabel,
  resolveInvoiceDocumentOptions,
  resolveQuoteDocumentOptions,
} from '@/features/quote-doc/documentOptionsModel'

describe('documentOptionsModel', () => {
  it('maps layout mode to presentation with B2C derived from empty agency', () => {
    expect(presentationFromLayoutMode('itemised', { agency: 'Black Tomato' })).toBe('B2B_ITEMISED')
    expect(presentationFromLayoutMode('packaged', { agency: 'Black Tomato' })).toBe('B2B_PACKAGED')
    expect(presentationFromLayoutMode('packaged', { agency: '' })).toBe('B2C_PACKAGED')
  })

  it('detects Travel Counsellors from agency name', () => {
    expect(isTravelCounsellorsAgency({ agency: 'Travel Counsellors UK' })).toBe(true)
    expect(isTravelCounsellorsAgency({ agency: 'Zoo Groups' })).toBe(false)
  })

  it('derives lifecycle stage from payment position', () => {
    expect(
      deriveInvoiceLifecycleStage({ paymentStatus: 'UNPAID', totalUsd: 10000, balanceUsd: 10000 }),
    ).toBe('deposit')
    expect(
      deriveInvoiceLifecycleStage({ paymentStatus: 'DEPOSIT_PAID', totalUsd: 10000, balanceUsd: 7000 }),
    ).toBe('full')
    expect(
      deriveInvoiceLifecycleStage({ paymentStatus: 'FULLY_PAID', totalUsd: 10000, balanceUsd: 0 }),
    ).toBe('full')
  })

  it('forces rolled-up rendering for Travel Counsellors', () => {
    expect(deriveRenderingDepth(true)).toBe('rolled_up')
    expect(deriveRenderingDepth(false)).toBe('full')
  })

  it('round-trips presentation to layout mode', () => {
    expect(layoutModeFromPresentation('B2B_ITEMISED')).toBe('itemised')
    expect(layoutModeFromPresentation('B2C_PACKAGED')).toBe('packaged')
  })

  it('always includes terms and auto-derives invoice options', () => {
    const options = resolveInvoiceDocumentOptions(
      { agency: 'Travel Counsellors', paymentStatus: 'UNPAID', totalUsd: 5000, balanceUsd: 5000 },
      { layoutMode: 'itemised' },
    )
    expect(options.showTerms).toBe(true)
    expect(options.travelCounsellors).toBe(true)
    expect(options.renderingDepth).toBe('rolled_up')
    expect(options.lifecycleStage).toBe('deposit')
  })

  it('treats known agencies as B2B channels', () => {
    expect(isB2cChannel({ agency: 'CPS' })).toBe(false)
    expect(isB2cChannel({ agency: '' })).toBe(true)
  })

  it('locks Travel Counsellors to itemised B2B even when packaged is requested', () => {
    expect(effectiveLayoutMode({ agency: 'Travel Counsellors UK' }, 'packaged')).toBe('itemised')
    const options = resolveInvoiceDocumentOptions(
      { agency: 'Travel Counsellors UK', paymentStatus: 'UNPAID', totalUsd: 5000, balanceUsd: 5000 },
      { layoutMode: 'packaged' },
    )
    expect(options.layoutMode).toBe('itemised')
    expect(options.presentation).toBe('B2B_ITEMISED')
    expect(options.renderingDepth).toBe('rolled_up')
    expect(invoiceDocumentOptionsSummary(options)).toBe('Travel Counsellors · Rolled up · Deposit')
  })

  it('locks Travel Counsellors quotes to itemised B2B', () => {
    const options = resolveQuoteDocumentOptions({ agency: 'Travel Counsellors' }, { layoutMode: 'packaged' })
    expect(options.presentation).toBe('B2B_ITEMISED')
  })

  it('uses dedicated cover labels for Travel Counsellors documents', () => {
    expect(invoiceCoverKindLabel(true)).toBe('Travel Counsellors Invoice')
    expect(invoiceCoverKindLabel(false)).toBe('Safari Invoice')
    expect(quotationCoverKindLabel(true, false)).toBe('Travel Counsellors Quotation')
    expect(quotationCoverKindLabel(false, true)).toBe('Packaged quotation')
  })
})
