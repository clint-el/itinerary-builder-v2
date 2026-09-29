import type { IncomingMessage, ServerResponse } from 'node:http'
import { getVoucherSession, putVoucherSession, type StoredVoucherSession } from './voucherSessionStore.js'

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

export async function handleVoucherSessionGet(_req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const itineraryId = url.searchParams.get('itineraryId')?.trim()
  const entityId = url.searchParams.get('entityId')?.trim()
  const token = url.searchParams.get('token')?.trim()

  if (!itineraryId || !entityId || !token) {
    sendJson(res, 400, { error: 'itineraryId, entityId, and token are required' })
    return
  }

  const stored = getVoucherSession(itineraryId, entityId)
  if (!stored?.meta) {
    sendJson(res, 404, { error: 'No voucher session found' })
    return
  }

  const tokens = (stored.meta as { tokens?: { token: string }[] }).tokens ?? []
  if (!tokens.some((t) => t.token === token)) {
    sendJson(res, 404, { error: 'Token not found in session' })
    return
  }

  sendJson(res, 200, { meta: stored.meta, updatedAt: stored.updatedAt })
}

export async function handleVoucherSessionPut(req: IncomingMessage, res: ServerResponse): Promise<void> {
  let body: Partial<StoredVoucherSession>
  try {
    body = (await readJsonBody(req)) as Partial<StoredVoucherSession>
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON body' })
    return
  }

  const itineraryId = body.itineraryId?.trim()
  const entityId = body.entityId?.trim()
  if (!itineraryId || !entityId || !body.meta || typeof body.meta !== 'object') {
    sendJson(res, 400, { error: 'itineraryId, entityId, and meta are required' })
    return
  }

  const session: StoredVoucherSession = {
    itineraryId,
    entityId,
    meta: body.meta,
    updatedAt: new Date().toISOString(),
  }
  putVoucherSession(session)
  sendJson(res, 200, { ok: true, updatedAt: session.updatedAt })
}
