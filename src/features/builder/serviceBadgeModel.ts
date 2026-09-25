import { lineStatusOf, supplierStatusOf } from '@/shared/lib/lifecycleRules'
import type { AddedService, Hold, SupplierStatus } from '@/shared/lib/types'

export type ServiceListBadge = {
  label: string
  className: string
}

const CHIP = {
  neutral: 'bg-[#F3F4F6] text-[#525252]',
  amber: 'bg-[#FEF3C7] text-[#92400E]',
  blue: 'bg-[#E0F2FE] text-[#0369A1]',
  green: 'bg-[#DCFCE7] text-[#15803D]',
  red: 'bg-[#FEE2E2] text-[#B91C1C]',
  indigo: 'bg-[#EEF2FF] text-[#4338CA]',
} as const

function holdsFrom(service: AddedService): Hold[] {
  const raw = service.draft?.holds
  return Array.isArray(raw) ? (raw as Hold[]) : []
}

type HoldPhase = 'none' | 'requested' | 'held' | 'expired'

export function holdPhaseForHolds(holds: Hold[]): HoldPhase {
  const open = holds.filter((h) => h.status !== 'Released')
  if (open.length === 0) return 'none'
  if (open.some((h) => h.status === 'Expired')) return 'expired'
  if (open.some((h) => h.status === 'Held')) return 'held'
  if (open.some((h) => h.status === 'Requested')) return 'requested'
  return 'none'
}

function holdBadge(phase: HoldPhase): ServiceListBadge {
  switch (phase) {
    case 'expired':
      return { label: 'Hold expired', className: CHIP.red }
    case 'held':
      return { label: 'On hold', className: CHIP.blue }
    case 'requested':
      return { label: 'Hold requested', className: CHIP.amber }
    default:
      return { label: 'No hold yet', className: CHIP.neutral }
  }
}

function supplierPhaseBadge(status: SupplierStatus): ServiceListBadge | null {
  if (status === 'Waiting') return { label: 'Awaiting supplier reply', className: CHIP.indigo }
  if (status === 'Booked') return { label: 'Booked with supplier', className: CHIP.green }
  if (status === 'Rejected') return { label: 'Supplier declined', className: CHIP.red }
  return null
}

/** Badge on builder service cards — holds pre-voucher, supplier status once engaged. */
export function serviceListBadge(service: AddedService): ServiceListBadge | null {
  if (lineStatusOf(service) === 'Cancelled') return null

  const supplier = supplierStatusOf(service)
  const supplierBadge = supplierPhaseBadge(supplier)
  if (supplierBadge) return supplierBadge

  if (service.tab === 'accommodation') {
    return holdBadge(holdPhaseForHolds(holdsFrom(service)))
  }

  return null
}
