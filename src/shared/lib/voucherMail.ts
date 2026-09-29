/** Outbound voucher mail — Resend via dev API (PR-F21/22/26). */

export type VoucherDeliveryStatus = 'queued' | 'sent' | 'failed'

export type VoucherMailVariant = 'issue' | 'resend'

export interface VoucherEmailPayload {
  from: string
  cc: string[]
  replyTo: string
  to: string[]
  subject: string
  body: string
  linkUrl: string
  pdfUrl: string
  note?: string
  supplierName?: string
  variant?: VoucherMailVariant
}

export interface VoucherEmailResult {
  messageId: string
  deliveryStatus: VoucherDeliveryStatus
  sentAt: string
  error?: string
}

/** Display / sendHistory — actual Resend From comes from server VOUCHER_FROM. */
const FROM_ADDRESS = 'vouchers@elewanaportal.com'

export function voucherFromAddress(): string {
  return FROM_ADDRESS
}

function useResendApi(): boolean {
  const mode = import.meta.env.VITE_VOUCHER_MAIL as string | undefined
  if (mode === 'stub') return false
  if (mode === 'resend') return true
  return import.meta.env.DEV
}

function stubSend(payload: VoucherEmailPayload): VoucherEmailResult {
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

export async function sendVoucherEmail(payload: VoucherEmailPayload): Promise<VoucherEmailResult> {
  if (!useResendApi()) {
    return stubSend(payload)
  }

  const sentAt = new Date().toISOString()
  try {
    const res = await fetch('/api/voucher-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cc: payload.cc,
        replyTo: payload.replyTo,
        to: payload.to,
        subject: payload.subject,
        body: payload.body,
        linkUrl: payload.linkUrl,
        pdfUrl: payload.pdfUrl,
        note: payload.note,
        supplierName: payload.supplierName,
        variant: payload.variant ?? (payload.subject.includes('(resent)') ? 'resend' : 'issue'),
      }),
    })

    const data = (await res.json().catch(() => ({}))) as Partial<VoucherEmailResult> & { error?: string }

    if (!res.ok) {
      return {
        messageId: '',
        deliveryStatus: 'failed',
        sentAt: data.sentAt || sentAt,
        error: data.error || `Mail API returned ${res.status}`,
      }
    }

    return {
      messageId: data.messageId || `resend-${Date.now()}`,
      deliveryStatus: data.deliveryStatus === 'failed' ? 'failed' : 'sent',
      sentAt: data.sentAt || sentAt,
      error: data.error,
    }
  } catch (err) {
    return {
      messageId: '',
      deliveryStatus: 'failed',
      sentAt,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}
