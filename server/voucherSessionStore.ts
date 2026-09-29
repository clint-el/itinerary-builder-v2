import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export type StoredVoucherSession = {
  itineraryId: string
  entityId: string
  meta: Record<string, unknown>
  updatedAt: string
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataPath = join(root, '.data', 'voucher-sessions.json')

function sessionKey(itineraryId: string, entityId: string): string {
  return `${itineraryId}#${entityId}`
}

function readAll(): Record<string, StoredVoucherSession> {
  try {
    const raw = readFileSync(dataPath, 'utf8')
    return JSON.parse(raw) as Record<string, StoredVoucherSession>
  } catch {
    return {}
  }
}

function writeAll(data: Record<string, StoredVoucherSession>) {
  mkdirSync(dirname(dataPath), { recursive: true })
  writeFileSync(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

export function putVoucherSession(session: StoredVoucherSession): void {
  const all = readAll()
  all[sessionKey(session.itineraryId, session.entityId)] = session
  writeAll(all)
}

export function getVoucherSession(itineraryId: string, entityId: string): StoredVoucherSession | null {
  return readAll()[sessionKey(itineraryId, entityId)] ?? null
}
