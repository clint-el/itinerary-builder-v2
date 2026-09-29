import { Resend } from 'resend'
import type { VoucherFilingCopy } from '../src/shared/lib/voucherFilingCopy.js'
import { voucherFilingFilename } from '../src/shared/lib/voucherFilingCopy.js'
import { buildVoucherFilingPdfBase64 } from './voucherFilingPdf.js'
import { buildVoucherEmailContent, type VoucherMailVariant } from './voucherEmailTemplate.js'
import type { VoucherMailApiBody, VoucherMailEnv } from './voucherMailHandler.js'

export type VoucherMailSendResult = {
  status: number
  body: Record<string, unknown>
}

export async function sendVoucherMail(
  payload: VoucherMailApiBody,
  env: VoucherMailEnv,
): Promise<VoucherMailSendResult> {
  if (!env.resendApiKey) {
    return { status: 503, body: { error: 'RESEND_API_KEY is not configured', deliveryStatus: 'failed' } }
  }
  if (!env.appOrigin) {
    return { status: 503, body: { error: 'APP_ORIGIN is not configured', deliveryStatus: 'failed' } }
  }
  const from = env.voucherFrom?.trim() || 'vouchers@elewanaportal.com'

  const to = (payload.to || []).filter(Boolean)
  if (!to.length) {
    return { status: 400, body: { error: 'At least one recipient (to) is required', deliveryStatus: 'failed' } }
  }
  if (!payload.subject?.trim() || !payload.linkUrl?.trim()) {
    return { status: 400, body: { error: 'subject and linkUrl are required', deliveryStatus: 'failed' } }
  }

  const variant: VoucherMailVariant = payload.variant === 'resend' ? 'resend' : 'issue'
  let pdfAttachmentFilename: string | undefined
  let attachments: { filename: string; content: string }[] | undefined
  if (payload.filingCopy) {
    const copy = payload.filingCopy as VoucherFilingCopy
    pdfAttachmentFilename = voucherFilingFilename(copy.voucherRef)
    const content = await buildVoucherFilingPdfBase64(copy)
    attachments = [{ filename: pdfAttachmentFilename, content }]
  }

  const { html, text } = buildVoucherEmailContent({
    body: payload.body || '',
    linkUrl: payload.linkUrl,
    note: payload.note,
    supplierName: payload.supplierName,
    variant,
    appOrigin: env.appOrigin,
    pdfAttachmentFilename,
  })

  const resend = new Resend(env.resendApiKey)
  const cc = (payload.cc || []).filter(Boolean)
  const replyTo = payload.replyTo?.trim()
  const sentAt = new Date().toISOString()

  try {
    const result = await resend.emails.send({
      from,
      to,
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject: payload.subject.trim(),
      html,
      text,
      attachments,
    })

    if (result.error) {
      return {
        status: 502,
        body: { deliveryStatus: 'failed', error: result.error.message, sentAt },
      }
    }

    return {
      status: 200,
      body: {
        messageId: result.data?.id || `resend-${Date.now()}`,
        deliveryStatus: 'sent',
        sentAt,
      },
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend request failed'
    return { status: 502, body: { deliveryStatus: 'failed', error: message, sentAt } }
  }
}
