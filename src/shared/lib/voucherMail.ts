/** Demo outbound mail stub — PR-F21/22/26 extension point for real SMTP integration. */

export type VoucherDeliveryStatus = 'queued' | 'sent' | 'failed'

export interface VoucherEmailPayload {
  from: string
  cc: string[]
  replyTo: string
  to: string[]
  subject: string
  body: string
  linkUrl: string
  pdfUrl: string
}

export interface VoucherEmailResult {
  messageId: string
  deliveryStatus: VoucherDeliveryStatus
  sentAt: string
}

const FROM_ADDRESS = 'vouchers@chelipeacock.com'

export function voucherFromAddress(): string {
  return FROM_ADDRESS
}

/** Simulates send — always returns 'sent' in demo. */
export function sendVoucherEmail(payload: VoucherEmailPayload): VoucherEmailResult {
  const sentAt = new Date().toISOString()
  console.info('[voucher-mail stub]', {
    from: payload.from,
    to: payload.to,
    cc: payload.cc,
    replyTo: payload.replyTo,
    subject: payload.subject,
    linkUrl: payload.linkUrl,
  })
  return {
    messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deliveryStatus: 'sent',
    sentAt,
  }
}
