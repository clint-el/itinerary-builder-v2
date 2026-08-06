import { PAYMENT_META } from '@/shared/lib/catalogs'
import type { PaymentStatus } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

function formatWholeUsd(n: number) {
  return '$' + Math.round(Math.abs(n || 0)).toLocaleString('en-US')
}

/** Secondary line under the payment badge — null when hidden (Unpaid). */
export function paymentBalanceLine(
  status: PaymentStatus,
  balanceUsd = 0,
): { text: string; color: string } | null {
  switch (status) {
    case 'UNPAID':
      return null
    case 'DEPOSIT_PAID':
    case 'PARTIALLY_PAID':
      return { text: `Balance ${formatWholeUsd(balanceUsd)}`, color: '#525252' }
    case 'FULLY_PAID':
      return { text: 'Settled in full', color: '#15803D' }
    case 'OVERPAID':
      return { text: `Credit ${formatWholeUsd(balanceUsd)}`, color: '#525252' }
    case 'REFUND_PENDING':
      if (balanceUsd < 0) {
        return { text: `Credit ${formatWholeUsd(balanceUsd)}`, color: '#525252' }
      }
      if (balanceUsd > 0) {
        return { text: `Balance ${formatWholeUsd(balanceUsd)}`, color: '#525252' }
      }
      return null
    default:
      return null
  }
}

export function PaymentChip({
  status,
  balanceUsd = 0,
  className,
}: {
  status: PaymentStatus
  /** Outstanding balance (negative = credit / overpayment). */
  balanceUsd?: number
  className?: string
}) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.UNPAID
  const line = paymentBalanceLine(status, balanceUsd)

  return (
    <div className={cn('flex min-w-0 flex-col items-start gap-0.5', className)}>
      <span
        className="inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-bold"
        style={{ background: meta.bg, color: meta.fg }}
      >
        {meta.label}
      </span>
      {line ? (
        <span
          className="truncate text-[11px] font-medium leading-tight"
          style={{ color: line.color }}
        >
          {line.text}
        </span>
      ) : null}
    </div>
  )
}
