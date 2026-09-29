import type { IncomingMessage, ServerResponse } from 'node:http'
import { Resend } from 'resend'
import { buildVoucherEmailContent, type VoucherMailVariant } from './voucherEmailTemplate.js'

export interface VoucherMailApiBody {
  cc?: string[]
  replyTo?: string
  to?: string[]
  subject?: string
  body?: string
  linkUrl?: string
  pdfUrl?: string
  note?: string
  supplierName?: string
  variant?: VoucherMailVariant
}

export interface VoucherMailEnv {
  resendApiKey?: string
  appOrigin?: string
  voucherFrom?: string
}

function readJsonBody(req: IncomingMessage): Promise<VoucherMailApiBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? (JSON.parse(raw) as VoucherMailApiBody) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export async function handleVoucherMailPost(
  req: IncomingMessage,
  res: ServerResponse,
  env: VoucherMailEnv,
): Promise<void> {
  if (!env.resendApiKey) {
    sendJson(res, 503, { error: 'RESEND_API_KEY is not configured' })
    return
  }
  if (!env.appOrigin) {
    sendJson(res, 503, { error: 'APP_ORIGIN is not configured' })
    return
  }
  const from = env.voucherFrom?.trim() || 'vouchers@elewanaportal.com'

  let payload: VoucherMailApiBody
  try {
    payload = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const to = (payload.to || []).filter(Boolean)
  if (!to.length) {
    sendJson(res, 400, { error: 'At least one recipient (to) is required' })
    return
  }
  if (!payload.subject?.trim() || !payload.linkUrl?.trim() || !payload.pdfUrl?.trim()) {
    sendJson(res, 400, { error: 'subject, linkUrl, and pdfUrl are required' })
    return
  }

  const variant: VoucherMailVariant = payload.variant === 'resend' ? 'resend' : 'issue'
  const { html, text } = buildVoucherEmailContent({
    body: payload.body || '',
    linkUrl: payload.linkUrl,
    pdfUrl: payload.pdfUrl,
    note: payload.note,
    supplierName: payload.supplierName,
    variant,
    appOrigin: env.appOrigin,
  })

  const resend = new Resend(env.resendApiKey)
  const cc = (payload.cc || []).filter(Boolean)
  const replyTo = payload.replyTo?.trim()

  try {
    const result = await resend.emails.send({
      from,
      to,
      cc: cc.length ? cc : undefined,
      replyTo: replyTo || undefined,
      subject: payload.subject.trim(),
      html,
      text,
    })

    if (result.error) {
      sendJson(res, 502, {
        deliveryStatus: 'failed',
        error: result.error.message,
        sentAt: new Date().toISOString(),
      })
      return
    }

    sendJson(res, 200, {
      messageId: result.data?.id || `resend-${Date.now()}`,
      deliveryStatus: 'sent',
      sentAt: new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Resend request failed'
    sendJson(res, 502, {
      deliveryStatus: 'failed',
      error: message,
      sentAt: new Date().toISOString(),
    })
  }
}
