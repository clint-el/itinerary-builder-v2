import { PAYMENT_META } from '@/shared/lib/catalogs'
import type { PaymentStatus } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

export function PaymentChip({
  status,
  className,
}: {
  status: PaymentStatus
  className?: string
}) {
  const meta = PAYMENT_META[status] ?? PAYMENT_META.UNPAID
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center whitespace-nowrap rounded-md px-2 text-[11.5px] font-bold',
        className,
      )}
      style={{ background: meta.bg, color: meta.fg }}
    >
      {meta.label}
    </span>
  )
}
