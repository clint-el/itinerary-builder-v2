import {
  documentLayoutLabel,
  type DocumentLayoutMode,
} from '@/features/quote-doc/documentOptionsModel'
import { cn } from '@/shared/lib/utils'

const MODES: DocumentLayoutMode[] = ['itemised', 'packaged']

export function DocumentLayoutPicker({
  value,
  onChange,
  contextLine,
  lockedMode,
}: {
  value: DocumentLayoutMode
  onChange: (mode: DocumentLayoutMode) => void
  contextLine?: string
  /** When set, layout is fixed (Travel Counsellors — itemised rolled-up only). */
  lockedMode?: DocumentLayoutMode
}) {
  if (lockedMode) {
    return (
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Layout</p>
        <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5">
          <div className="text-[12px] font-semibold text-[#931115]">Travel Counsellors · Itemised</div>
          <p className="mt-1 text-[11px] leading-relaxed text-[#737373]">
            Rolled-up schedule with head-office commission. Packaged layout is not available for TC
            bookings.
          </p>
        </div>
        {contextLine ? (
          <p className="mt-2 text-[11px] leading-relaxed text-[#737373]">{contextLine}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">Layout</p>
      <div className="flex rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-0.5">
        {MODES.map((mode) => {
          const active = value === mode
          return (
            <button
              key={mode}
              type="button"
              onClick={() => onChange(mode)}
              className={cn(
                'h-[32px] flex-1 rounded-md text-[12px] font-semibold transition-colors',
                active ? 'bg-white text-[#931115] shadow-sm' : 'text-[#525252] hover:text-[#171717]',
              )}
            >
              {documentLayoutLabel(mode)}
            </button>
          )
        })}
      </div>
      {contextLine ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[#737373]">{contextLine}</p>
      ) : null}
    </div>
  )
}
