import type { VoucherMeta } from '@/shared/lib/types'
import { getVoucherMailPublicConfig, shouldUseResendApi } from './voucherMailConfig'

export function voucherSessionApiUrl(mailApiUrl: string): string {
  const trimmed = mailApiUrl.replace(/\/$/, '')
  if (trimmed.endsWith('/api/voucher-mail')) {
    return trimmed.replace(/\/api\/voucher-mail$/, '/api/voucher-session')
  }
  return `${trimmed}/voucher-session`
}

export async function persistVoucherSessionRemote(
  itineraryId: string,
  entityId: string,
  meta: VoucherMeta,
): Promise<void> {
  if (!(await shouldUseResendApi())) return

  const { apiUrl } = await getVoucherMailPublicConfig()
  const url = voucherSessionApiUrl(apiUrl)

  try {
    await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itineraryId, entityId, meta }),
    })
  } catch (err) {
    console.warn('[voucher-session] persist failed', err)
  }
}

export async function fetchVoucherSessionRemote(
  itineraryId: string,
  entityId: string,
  token: string,
): Promise<VoucherMeta | null> {
  if (!(await shouldUseResendApi())) return null

  const { apiUrl } = await getVoucherMailPublicConfig()
  const base = voucherSessionApiUrl(apiUrl)
  const q = new URLSearchParams({ itineraryId, entityId, token })
  const url = `${base}?${q}`

  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { meta?: VoucherMeta }
    return data.meta ?? null
  } catch {
    return null
  }
}
