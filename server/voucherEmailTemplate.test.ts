import { describe, expect, it } from 'vitest'
import { buildVoucherEmailContent } from './voucherEmailTemplate.js'

describe('buildVoucherEmailContent', () => {
  it('builds absolute confirmation URLs from APP_ORIGIN', () => {
    const { html, text } = buildVoucherEmailContent({
      body: 'Please confirm the services for CPS5678 / V01.',
      linkUrl: '/voucher-link/CPS5678/pe-elewana?t=abc',
      pdfUrl: '/voucher-doc/CPS5678/pe-elewana',
      supplierName: 'Elewana',
      variant: 'issue',
      appOrigin: 'https://master.d32z4rqkhd384i.amplifyapp.com',
    })

    expect(html).toContain('https://master.d32z4rqkhd384i.amplifyapp.com/voucher-link/CPS5678/pe-elewana?t=abc')
    expect(text).toContain('https://master.d32z4rqkhd384i.amplifyapp.com/voucher-link/CPS5678/pe-elewana?t=abc')
    expect(html).toContain('Dear Elewana reservations team')
  })

  it('includes planner note when provided', () => {
    const { html } = buildVoucherEmailContent({
      body: 'Please confirm.',
      linkUrl: '/voucher-link/x/y?t=1',
      pdfUrl: '/voucher-doc/x/y',
      note: 'Late arrival after 18:00',
      variant: 'issue',
      appOrigin: 'https://example.com',
    })

    expect(html).toContain('Late arrival after 18:00')
    expect(html).toContain('Note from your planner')
  })
})
