/**
 * AWS Lambda (Function URL) handler for voucher mail on Amplify/static hosting.
 * Deploy with RESEND_API_KEY, APP_ORIGIN, VOUCHER_FROM, optional ALLOWED_ORIGIN.
 * Set Amplify build env VOUCHER_MAIL_API_URL to this function's URL.
 */
import { Resend } from 'resend'

function corsHeaders(origin) {
  const allowed = process.env.ALLOWED_ORIGIN?.trim() || origin || '*'
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function absoluteUrl(relativeOrAbsolute, appOrigin) {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  const base = appOrigin.replace(/\/$/, '')
  const path = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`
  return `${base}${path}`
}

function buildEmail(input) {
  const confirmUrl = absoluteUrl(input.linkUrl, input.appOrigin)
  const pdfUrl = absoluteUrl(input.pdfUrl, input.appOrigin)
  const supplier = input.supplierName?.trim() || 'partner'
  const greeting = `Dear ${supplier} reservations team,`
  const lead =
    input.variant === 'resend'
      ? 'Your confirmation link has been refreshed. Please use the button below — earlier links may no longer work.'
      : input.body?.trim() || 'Please confirm the services listed in our portal.'

  const html = `<!DOCTYPE html><html><body style="font-family:Helvetica,Arial,sans-serif;color:#171717;">
<p style="font-size:18px;font-weight:700;color:#931115;">Cheli &amp; Peacock</p>
<p>${greeting}</p>
<p>${lead}</p>
<p><a href="${confirmUrl}" style="display:inline-block;background:#931115;color:#fff;padding:12px 22px;text-decoration:none;border-radius:8px;">Confirm services</a></p>
<p style="font-size:12px;"><a href="${confirmUrl}">${confirmUrl}</a></p>
${input.note ? `<p><strong>Note from your planner:</strong> ${input.note}</p>` : ''}
<p style="font-size:12px;"><a href="${pdfUrl}">View filing copy (PDF)</a></p>
</body></html>`

  const text = [greeting, '', lead, '', confirmUrl, '', `Filing copy: ${pdfUrl}`].join('\n')
  return { html, text, confirmUrl }
}

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET'
  const origin = event.headers?.origin || event.headers?.Origin

  if (method === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(origin), body: '' }
  }

  if (method !== 'POST') {
    return {
      statusCode: 405,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const env = {
    resendApiKey: process.env.RESEND_API_KEY,
    appOrigin: process.env.APP_ORIGIN,
    from: process.env.VOUCHER_FROM?.trim() || 'vouchers@elewanaportal.com',
  }

  if (!env.resendApiKey || !env.appOrigin) {
    return {
      statusCode: 503,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'RESEND_API_KEY and APP_ORIGIN must be set on the function',
        deliveryStatus: 'failed',
      }),
    }
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON', deliveryStatus: 'failed' }),
    }
  }

  const to = (payload.to || []).filter(Boolean)
  if (!to.length || !payload.subject?.trim() || !payload.linkUrl?.trim() || !payload.pdfUrl?.trim()) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required fields', deliveryStatus: 'failed' }),
    }
  }

  const variant = payload.variant === 'resend' ? 'resend' : 'issue'
  const { html, text } = buildEmail({
    ...payload,
    variant,
    appOrigin: env.appOrigin,
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
    })

    if (result.error) {
      return {
        statusCode: 502,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryStatus: 'failed', error: result.error.message, sentAt }),
      }
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: result.data?.id || `resend-${Date.now()}`,
        deliveryStatus: 'sent',
        sentAt,
      }),
    }
  } catch (err) {
    return {
      statusCode: 502,
      headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deliveryStatus: 'failed',
        error: err instanceof Error ? err.message : 'Send failed',
        sentAt,
      }),
    }
  }
}
