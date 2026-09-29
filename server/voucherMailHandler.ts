import type { IncomingMessage, ServerResponse } from 'node:http'
import { sendVoucherMail } from './sendVoucherMail.js'
import type { VoucherMailVariant } from './voucherEmailTemplate.js'

export type { VoucherMailVariant }

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
  let payload: VoucherMailApiBody
  try {
    payload = await readJsonBody(req)
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const result = await sendVoucherMail(payload, env)
  sendJson(res, result.status, result.body)
}
