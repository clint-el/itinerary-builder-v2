import { STATUS_META } from '@/shared/lib/catalogs'
import type { ItineraryStatus } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

export function StatusChip({
  status,
  className,
  pulsing,
}: {
  status: ItineraryStatus
  className?: string
  pulsing?: boolean
}) {
  const meta = STATUS_META[status] ?? STATUS_META.DRAFT
  return (
    <span
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-bold',
        className,
      )}
      style={{ background: meta.bg, color: meta.fg }}
    >
      {pulsing || status === 'TRAVEL_IN_PROGRESS' ? (
        <span className="size-1.5 shrink-0 rounded-full bg-[#22C55E]" />
      ) : (
        <span className="size-[7px] shrink-0 rounded-full" style={{ background: meta.dot }} />
      )}
      {meta.label}
    </span>
  )
}
