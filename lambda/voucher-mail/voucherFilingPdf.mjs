import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const MARGIN = 50
const LINE = 14

function wrap(text, maxChars) {
  const words = text.split(/\s+/)
  const lines = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (next.length > maxChars) {
      if (cur) lines.push(cur)
      cur = w
    } else {
      cur = next
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

export async function buildVoucherFilingPdfBase64(copy) {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  let page = doc.addPage([595, 842])
  let y = 842 - MARGIN

  function draw(line, opts = {}) {
    const size = opts.size ?? 11
    const f = opts.bold ? bold : font
    if (y < MARGIN + LINE) {
      page = doc.addPage([595, 842])
      y = 842 - MARGIN
    }
    page.drawText(line, { x: MARGIN, y, size, font: f, color: rgb(0.1, 0.1, 0.1) })
    y -= LINE
  }

  draw('Cheli & Peacock — voucher filing copy', { bold: true, size: 13 })
  y -= 4
  draw(copy.supplier, { bold: true, size: 12 })
  draw(`${copy.voucherRef} · ${copy.dateRange}`)
  draw(`Booking ${copy.bookingRef} · ${copy.partyMix} · Lead ${copy.leadGuest}`)
  if (copy.agency) draw(`Agency: ${copy.agency}`)
  draw(`Total payable (cost): ${copy.total}`)
  y -= 6

  draw('Guest requirements', { bold: true })
  for (const g of copy.guestLines || []) {
    for (const line of wrap(`${g.name} (${g.role}): ${g.dietary || '—'}`, 90)) draw(line)
    if (g.additional?.trim()) {
      for (const line of wrap(`Additional: ${g.additional}`, 90)) draw(line)
    }
  }
  y -= 4

  if (copy.plannerNote?.trim()) {
    draw('Note from planner', { bold: true })
    for (const line of wrap(copy.plannerNote.trim(), 90)) draw(line)
    y -= 4
  }

  draw('Services', { bold: true })
  for (const s of copy.serviceLines || []) {
    for (const line of wrap(`${s.date} · ${s.service} · ${s.detail} · ${s.pax} · ${s.value}`, 95)) {
      draw(line)
    }
  }
  y -= 4
  draw(`Deposit amount: ${copy.deposit}`, { bold: true })
  draw('Payment terms', { bold: true })
  const termRows =
    copy.paymentTermRows?.length > 0
      ? copy.paymentTermRows
      : [{ name: '—', travelDates: '—', deposit: copy.depositRule, balanceDue: '' }]
  for (const row of termRows) {
    for (const line of wrap(
      `${row.name} · ${row.travelDates} · ${row.deposit} · ${row.balanceDue}`.replace(/ · $/, ''),
      95,
    )) {
      draw(line)
    }
  }

  const bytes = await doc.save()
  return Buffer.from(bytes).toString('base64')
}

export function voucherFilingFilename(voucherRef) {
  const safe = voucherRef.replace(/[^\w\-./ ]+/g, '_').replace(/\s+/g, '-')
  return `voucher-filing-${safe}.pdf`
}
