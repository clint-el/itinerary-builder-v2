import { useState } from 'react'
import { Info } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
import type { ServiceOptionInclusions } from './serviceOptions'

/**
 * Compact trigger for Option Included / Excluded copy — icon opens a simple modal
 * so panels stay uncluttered.
 */
export function OptionInclusions({
  option,
  className,
}: {
  option: ServiceOptionInclusions | null | undefined
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!option) return null

  return (
    <>
      <button
        type="button"
        title="Included & excluded"
        aria-label={`Included and excluded — ${option.label}`}
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-[#E5E7EB] bg-white text-[#64748B] transition-colors hover:border-[#CBD5E1] hover:bg-[#F8FAFC] hover:text-[#334155]',
          className,
        )}
      >
        <Info className="size-3.5" strokeWidth={2.25} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md gap-0 p-0">
          <DialogHeader className="border-b border-[#EEF0F2] px-5 py-4">
            <DialogTitle className="text-[15px] font-bold text-[#171717]">
              {option.label}
            </DialogTitle>
            <p className="text-[12.5px] font-medium text-[#A1A1A1]">Included &amp; excluded</p>
          </DialogHeader>
          <div className="space-y-4 px-5 py-4">
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                Included
              </p>
              <p className="text-[13px] leading-relaxed text-[#171717]">{option.included}</p>
            </div>
            <div className="border-t border-[#E2E8F0]" />
            <div>
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">
                Excluded
              </p>
              <p className="text-[13px] leading-relaxed text-[#525252]">{option.excluded}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
