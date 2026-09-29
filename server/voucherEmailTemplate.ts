export type VoucherMailVariant = 'issue' | 'resend'

export interface VoucherEmailTemplateInput {
  body: string
  linkUrl: string
  pdfUrl: string
  note?: string
  supplierName?: string
  variant: VoucherMailVariant
  appOrigin: string
}

function absoluteUrl(relativeOrAbsolute: string, appOrigin: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute
  const base = appOrigin.replace(/\/$/, '')
  const path = relativeOrAbsolute.startsWith('/') ? relativeOrAbsolute : `/${relativeOrAbsolute}`
  return `${base}${path}`
}

export function buildVoucherEmailContent(input: VoucherEmailTemplateInput): { html: string; text: string } {
  const confirmUrl = absoluteUrl(input.linkUrl, input.appOrigin)
  const pdfUrl = absoluteUrl(input.pdfUrl, input.appOrigin)
  const supplier = input.supplierName?.trim() || 'partner'
  const greeting = `Dear ${supplier} reservations team,`

  const lead =
    input.variant === 'resend'
      ? 'Your confirmation link has been refreshed. Please use the button below — earlier links may no longer work.'
      : input.body.trim() || 'Please confirm the services listed in our portal.'

  const noteBlock = input.note?.trim()
    ? `<tr><td style="padding:16px 0 0 0;">
        <div style="border:1px solid #E5E7EB;border-radius:8px;background:#FAFAFB;padding:12px 14px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.3px;color:#A1A1A1;margin-bottom:6px;">Note from your planner</div>
          <div style="font-size:13px;line-height:1.5;color:#525252;">${escapeHtml(input.note.trim())}</div>
        </div>
      </td></tr>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F5F5F5;font-family:Helvetica,Arial,sans-serif;color:#171717;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F5F5;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:12px;padding:28px 24px;">
        <tr><td style="font-size:18px;font-weight:700;color:#931115;padding-bottom:20px;">Cheli &amp; Peacock</td></tr>
        <tr><td style="font-size:14px;line-height:1.55;color:#171717;">${escapeHtml(greeting)}</td></tr>
        <tr><td style="font-size:14px;line-height:1.55;color:#525252;padding-top:12px;">${escapeHtml(lead)}</td></tr>
        <tr><td style="padding:24px 0 8px 0;" align="center">
          <a href="${escapeAttr(confirmUrl)}" style="display:inline-block;background:#931115;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:600;padding:12px 22px;border-radius:8px;">Confirm services</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#737373;padding-top:8px;word-break:break-all;">
          Or open this link:<br /><a href="${escapeAttr(confirmUrl)}" style="color:#931115;">${escapeHtml(confirmUrl)}</a>
        </td></tr>
        ${noteBlock}
        <tr><td style="font-size:12px;line-height:1.5;color:#737373;padding-top:20px;">
          <a href="${escapeAttr(pdfUrl)}" style="color:#931115;">View filing copy (PDF)</a>
        </td></tr>
        <tr><td style="font-size:12px;line-height:1.5;color:#A1A1A1;padding-top:24px;border-top:1px solid #F1F1F3;margin-top:8px;">
          Questions? Reply to this email — your planner is copied. Confirmation links expire after a limited time.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    'Cheli & Peacock',
    '',
    greeting,
    '',
    lead,
    '',
    'Confirm services:',
    confirmUrl,
    '',
    input.note?.trim() ? `Note from your planner:\n${input.note.trim()}\n` : '',
    `Filing copy: ${pdfUrl}`,
    '',
    'Questions? Reply to this email — your planner is copied.',
  ]
    .filter(Boolean)
    .join('\n')

  return { html, text }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/'/g, '&#39;')
}
