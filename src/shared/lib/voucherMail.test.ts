import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendVoucherEmail, voucherFromAddress } from './voucherMail'

describe('voucherMail', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_VOUCHER_MAIL', 'resend')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('voucherFromAddress uses elewanaportal sender', () => {
    expect(voucherFromAddress()).toBe('vouchers@elewanaportal.com')
  })

  it('returns sent when API succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          messageId: 'msg-abc',
          deliveryStatus: 'sent',
          sentAt: '2026-01-01T00:00:00.000Z',
        }),
      }),
    )

    const result = await sendVoucherEmail({
      from: voucherFromAddress(),
      cc: ['planner@chelipeacock.com'],
      replyTo: 'planner@chelipeacock.com',
      to: ['supplier@example.com'],
      subject: 'Confirmation request — Elewana — CPS5678 / V01',
      body: 'Please confirm.',
      linkUrl: '/voucher-link/id/pe?t=token',
      pdfUrl: '/voucher-doc/id/pe',
    })

    expect(result.deliveryStatus).toBe('sent')
    expect(result.messageId).toBe('msg-abc')
    expect(fetch).toHaveBeenCalledWith(
      '/api/voucher-mail',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('returns failed when API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => ({ error: 'Resend rejected', sentAt: '2026-01-01T00:00:00.000Z' }),
      }),
    )

    const result = await sendVoucherEmail({
      from: voucherFromAddress(),
      cc: [],
      replyTo: 'planner@chelipeacock.com',
      to: ['supplier@example.com'],
      subject: 'Confirmation request (resent) — CPS5678 / V01',
      body: 'Refresh.',
      linkUrl: '/voucher-link/id/pe?t=token',
      pdfUrl: '/voucher-doc/id/pe',
      variant: 'resend',
    })

    expect(result.deliveryStatus).toBe('failed')
    expect(result.error).toContain('Resend rejected')
  })

  it('uses stub when VITE_VOUCHER_MAIL=stub', async () => {
    vi.stubEnv('VITE_VOUCHER_MAIL', 'stub')
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await sendVoucherEmail({
      from: voucherFromAddress(),
      cc: [],
      replyTo: 'x@y.com',
      to: ['a@b.com'],
      subject: 'Test',
      body: 'Body',
      linkUrl: '/l',
      pdfUrl: '/p',
    })

    expect(result.deliveryStatus).toBe('sent')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
