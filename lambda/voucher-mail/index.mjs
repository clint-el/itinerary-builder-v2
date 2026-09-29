/**
 * AWS Lambda — voucher mail + shared voucher sessions (DynamoDB).
 * Env: RESEND_API_KEY, APP_ORIGIN, VOUCHER_FROM, ALLOWED_ORIGIN, VOUCHER_SESSIONS_TABLE
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb'
import { Resend } from 'resend'
import { buildVoucherFilingPdfBase64, voucherFilingFilename } from './voucherFilingPdf.mjs'

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE = process.env.VOUCHER_SESSIONS_TABLE?.trim()

function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN?.trim() || origin || '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function jsonResponse(statusCode, origin, body) {
  return {
    statusCode,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function sessionKey(itineraryId, entityId) {
  return `${itineraryId}#${entityId}`
}

async function putSession(itineraryId, entityId, meta) {
  if (!TABLE) return
  const updatedAt = new Date().toISOString()
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        pk: sessionKey(itineraryId, entityId),
        itineraryId,
        entityId,
        meta,
        updatedAt,
      },
    }),
  )
}

async function getSession(itineraryId, entityId) {
  if (!TABLE) return null
  const out = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { pk: sessionKey(itineraryId, entityId) },
    }),
  )
  return out.Item ?? null
}

function absoluteUrl(relativeOrAbsolute, appOrigin) {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  const base = appOrigin.replace(/\/$/, '')
  const path = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`
  return `${base}${path}`
}

function buildEmail(input) {
  const confirmUrl = absoluteUrl(input.linkUrl, input.appOrigin)
  const supplier = input.supplierName?.trim() || 'partner'
  const greeting = `Dear ${supplier} reservations team,`
  const lead =
    input.variant === 'resend'
      ? `${input.body?.trim() || 'Please confirm the services listed in our portal.'} Your confirmation link is below.`
      : input.body?.trim() || 'Please confirm the services listed in our portal.'
  const attachmentLine = input.pdfAttachmentFilename
    ? `<p style="font-size:12px;">Filing copy PDF attached: <strong>${input.pdfAttachmentFilename}</strong></p>`
    : ''

  const html = `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#171717;">
<p style="font-size:18px;font-weight:700;color:#931115;">Cheli &amp; Peacock</p>
<p>${greeting}</p>
<p>${lead}</p>
<p><a href="${confirmUrl}" style="display:inline-block;background:#931115;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;">Confirm services</a></p>
<p style="font-size:12px;"><a href="${confirmUrl}">${confirmUrl}</a></p>
${input.note ? `<p><strong>Note from your planner:</strong> ${input.note}</p>` : ''}
${attachmentLine}
</body></html>`

  const text = [
    greeting,
    '',
    lead,
    '',
    confirmUrl,
    '',
    input.pdfAttachmentFilename ? `Filing copy PDF attached: ${input.pdfAttachmentFilename}` : '',
  ]
    .filter(Boolean)
    .join('\n')
  return { html, text }
}

async function handleSessionGet(event, origin) {
  const qs = event.queryStringParameters || {}
  const itineraryId = qs.itineraryId?.trim()
  const entityId = qs.entityId?.trim()
  if (!itineraryId || !entityId) {
    return jsonResponse(400, origin, { error: 'itineraryId and entityId are required' })
  }

  const stored = await getSession(itineraryId, entityId)
  if (!stored?.meta) {
    return jsonResponse(404, origin, { error: 'No voucher session found' })
  }

  return jsonResponse(200, origin, { meta: stored.meta, updatedAt: stored.updatedAt })
}

async function handleSessionPut(event, origin) {
  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, origin, { error: 'Invalid JSON' })
  }

  const itineraryId = body.itineraryId?.trim()
  const entityId = body.entityId?.trim()
  if (!itineraryId || !entityId || !body.meta) {
    return jsonResponse(400, origin, { error: 'itineraryId, entityId, and meta are required' })
  }

  await putSession(itineraryId, entityId, body.meta)
  return jsonResponse(200, origin, { ok: true })
}

async function handleMail(event, origin) {
  const env = {
    resendApiKey: process.env.RESEND_API_KEY,
    appOrigin: process.env.APP_ORIGIN,
    from: process.env.VOUCHER_FROM?.trim() || 'vouchers@elewanaportal.com',
  }

  if (!env.resendApiKey || !env.appOrigin) {
    return jsonResponse(503, origin, {
      error: 'RESEND_API_KEY and APP_ORIGIN must be set on the function',
      deliveryStatus: 'failed',
    })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return jsonResponse(400, origin, { error: 'Invalid JSON', deliveryStatus: 'failed' })
  }

  const to = (payload.to || []).filter(Boolean)
  if (!to.length || !payload.subject?.trim() || !payload.linkUrl?.trim()) {
    return jsonResponse(400, origin, { error: 'Missing required fields', deliveryStatus: 'failed' })
  }

  const variant = payload.variant === 'resend' ? 'resend' : 'issue'
  let pdfAttachmentFilename
  let attachments
  if (payload.filingCopy) {
    pdfAttachmentFilename = voucherFilingFilename(payload.filingCopy.voucherRef || 'voucher')
    const content = await buildVoucherFilingPdfBase64(payload.filingCopy)
    attachments = [{ filename: pdfAttachmentFilename, content }]
  }

  const { html, text } = buildEmail({
    ...payload,
    variant,
    appOrigin: env.appOrigin,
    pdfAttachmentFilename,
  })

  const resend = new Resend(env.resendApiKey)
  const sentAt = new Date().toISOString()

  try {
    const result = await resend.emails.send({
      from: env.from,
      to,
      cc: (payload.cc || []).filter(Boolean) || undefined,
      replyTo: payload.replyTo?.trim() || undefined,
      subject: payload.subject.trim(),
      html,
      text,
      attachments,
    })

    if (result.error) {
      return jsonResponse(502, origin, { deliveryStatus: 'failed', error: result.error.message, sentAt })
    }

    return jsonResponse(200, origin, {
      messageId: result.data?.id || `resend-${Date.now()}`,
      deliveryStatus: 'sent',
      sentAt,
    })
  } catch (err) {
    return jsonResponse(502, origin, {
      deliveryStatus: 'failed',
      error: err instanceof Error ? err.message : 'Send failed',
      sentAt,
    })
  }
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  const origin = event.headers?.origin || event.headers?.Origin
  const path = event.rawPath || event.requestContext?.http?.path || '/'

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' }
  }

  if (method === 'GET' && path === '/voucher-session') {
    return handleSessionGet(event, origin)
  }
  if (method === 'PUT' && path === '/voucher-session') {
    return handleSessionPut(event, origin)
  }
  if (method === 'POST' && (path === '/' || path === '/voucher-mail')) {
    return handleMail(event, origin)
  }

  return jsonResponse(405, origin, { error: 'Method not allowed' })
}
