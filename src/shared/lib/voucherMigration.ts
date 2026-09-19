import { payableEntityFromSupplierName } from './payableEntities'
import type { Itinerary, VoucherLineAnswer, VoucherMeta, SupplierVoucherStatus } from './types'

/** One-time migration: re-key voucher maps from supplier display name → payableEntityId. */
export function migrateItineraryVoucherKeys(it: Itinerary): Itinerary {
  if (!it.voucherMeta && !it.supplierVouchers) return it
  const meta = it.voucherMeta || {}
  const vouchers = it.supplierVouchers || {}
  const keys = new Set([...Object.keys(meta), ...Object.keys(vouchers)])
  if (!keys.size) return it

  const needsMigration = [...keys].some((k) => !k.startsWith('pe-'))
  if (!needsMigration) return it

  const nextMeta: Record<string, VoucherMeta> = { ...meta }
  const nextVouchers: Record<string, SupplierVoucherStatus> = { ...vouchers }
  const nextAnswers: Record<string, VoucherLineAnswer> = { ...(it.voucherLineAnswers || {}) }

  for (const oldKey of keys) {
    if (oldKey.startsWith('pe-')) continue
    const entity = payableEntityFromSupplierName(oldKey)
    const entityId = entity.id

    if (meta[oldKey]) {
      const existing = nextMeta[entityId]
      nextMeta[entityId] = existing
        ? { ...existing, ...meta[oldKey], tokens: [...(existing.tokens || []), ...(meta[oldKey].tokens || [])] }
        : meta[oldKey]
      delete nextMeta[oldKey]
    }
    if (vouchers[oldKey]) {
      nextVouchers[entityId] = vouchers[oldKey]
      delete nextVouchers[oldKey]
    }
  }

  return {
    ...it,
    voucherMeta: nextMeta,
    supplierVouchers: nextVouchers,
    voucherLineAnswers: nextAnswers,
  }
}
