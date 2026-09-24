import { cn } from '@/shared/lib/utils'

export function DottedTotalRow({
  label,
  amount,
  accent,
}: {
  label: string
  amount: string
  accent?: string
}) {
  return (
    <div className="flex items-baseline gap-2 py-1.5 text-[12.5px]">
      <span className="shrink-0 text-[#525252]">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-[#D4D4D4]" />
      <span className="shrink-0 font-medium" style={accent ? { color: accent } : undefined}>
        {amount}
      </span>
    </div>
  )
}

export function PaxSplitCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#E5E7EB] px-3 py-2.5">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-[#8A8A8A]">{label}</div>
      <div className="mt-0.5 font-['IBM_Plex_Mono'] text-[13px] font-semibold">{value}</div>
    </div>
  )
}

export function paymentDueRowLabel(prefix: string, date?: string) {
  if (!date) return prefix
  return (
    <>
      {prefix}
      {' · '}
      <span className="font-bold normal-case tracking-normal text-[#101010]">{date}</span>
    </>
  )
}

type PaymentPosTone = 'neutral' | 'paid' | 'balance' | 'urgent' | 'future'

const PAYMENT_POS_TONES: Record<PaymentPosTone, { row: string; value: string }> = {
  neutral: { row: 'border-[#E5E7EB] bg-[#FAFAFA]', value: 'text-[#101010]' },
  paid: { row: 'border-[#BBF7D0] bg-[#F0FDF4]', value: 'text-[#15803D]' },
  balance: { row: 'border-[#FDE68A] bg-[#FFFBEB]', value: 'text-[#B45309]' },
  urgent: { row: 'border-[#FECACA] bg-[#FEF2F2]', value: 'text-[#931115]' },
  future: { row: 'border-[#BFDBFE] bg-[#EFF6FF]', value: 'text-[#1D4ED8]' },
}

export function PaymentPosRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: React.ReactNode
  value: string
  tone?: PaymentPosTone
}) {
  const styles = PAYMENT_POS_TONES[tone]
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-lg border px-4 py-3', styles.row)}>
      <div className="text-[9px] font-semibold uppercase tracking-[1px] text-[#8A8A8A]">{label}</div>
      <div className={cn("font-['IBM_Plex_Mono'] text-[15px] font-semibold", styles.value)}>{value}</div>
    </div>
  )
}
