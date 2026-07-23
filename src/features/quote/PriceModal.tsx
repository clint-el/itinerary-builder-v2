import type { QuoteGroup } from '@/shared/lib/types'
import { cn, formatUsd } from '@/shared/lib/utils'

function parseMoney(raw?: string) {
  return Number(String(raw || '0').replace(/[^0-9.-]/g, '')) || 0
}

interface PriceModalProps {
  open: boolean
  onClose: () => void
  groups: QuoteGroup[]
  marginPct?: number
}

export function PriceModal({ open, onClose, groups, marginPct = 0 }: PriceModalProps) {
  if (!open) return null

  const rows: {
    date: string
    supplier: string
    service: string
    qty: string
    nights: string
    alloc: string
    discount: string
    subtotal: string
    discountNeg?: boolean
  }[] = []

  for (const g of groups) {
    for (const sv of g.services) {
      const discountExtra = (sv.extras || []).find((ex) => ex.isDiscount)
      rows.push({
        date: (sv.dates || '—').split(' - ')[0] || '—',
        supplier: g.name,
        service: sv.sub ? `${sv.title} ${sv.sub}` : sv.title,
        qty: sv.qty || '1',
        nights: sv.nights || '—',
        alloc: sv.alloc || '—',
        discount: discountExtra?.amount || '—',
        subtotal: sv.subtotal,
        discountNeg: !!discountExtra,
      })
      for (const ex of sv.extras || []) {
        if (ex.isDiscount) continue
        rows.push({
          date: (ex.dates || sv.dates || '—').split(' - ')[0] || '—',
          supplier: g.name,
          service: ex.label,
          qty: ex.qty || '1',
          nights: '—',
          alloc: ex.alloc || sv.alloc || '—',
          discount: '—',
          subtotal: ex.amount || '$0.00',
        })
      }
    }
  }

  const total = groups.reduce(
    (sum, g) => sum + g.services.reduce((s, sv) => s + parseMoney(sv.subtotal), 0),
    0,
  )

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[calc(100vh-48px)] w-[980px] max-w-full flex-col overflow-hidden rounded-[14px] bg-white shadow-[0_10px_40px_rgba(0,0,0,0.1)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Price Breakdown"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[#E5E7EB] px-6 py-5">
          <h2 className="m-0 text-lg font-bold text-[#171717]">Price Breakdown</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-md border-0 bg-transparent text-[#A1A1A1] hover:bg-[#F3F4F6]"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="min-w-[900px]">
            <div className="sticky top-0 grid grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.6fr)_44px_56px_92px_108px_104px] gap-3 border-b border-[#E5E7EB] bg-[#F9FAFB] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.3px] text-[#A1A1A1]">
              <div>Date</div>
              <div>Supplier</div>
              <div>Service</div>
              <div className="text-center">Qty</div>
              <div className="text-center">Nights</div>
              <div>Allocation</div>
              <div className="text-right">Discount</div>
              <div className="text-right">SubTotal</div>
            </div>
            {rows.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-[#A1A1A1]">No services on this quote yet.</div>
            ) : (
              rows.map((row, i) => (
                <div
                  key={`${row.supplier}-${row.service}-${i}`}
                  className={cn(
                    'grid grid-cols-[110px_minmax(0,1.4fr)_minmax(0,1.6fr)_44px_56px_92px_108px_104px] items-center gap-3 px-6 py-3',
                    i < rows.length - 1 && 'border-b border-[#F1F1F3]',
                  )}
                >
                  <div className="text-[13px] text-[#525252]">{row.date}</div>
                  <div className="truncate text-sm text-[#171717]">{row.supplier}</div>
                  <div className="truncate text-sm text-[#171717]">{row.service}</div>
                  <div className="text-center text-sm text-[#171717]">{row.qty}</div>
                  <div
                    className={cn(
                      'text-center text-sm',
                      row.nights === '—' ? 'text-[#A1A1A1]' : 'text-[#171717]',
                    )}
                  >
                    {row.nights}
                  </div>
                  <div className="text-[13px] text-[#525252]">{row.alloc}</div>
                  <div
                    className={cn(
                      'text-right text-[13px]',
                      row.discountNeg ? 'font-semibold text-[#931115]' : 'text-[#A1A1A1]',
                    )}
                  >
                    {row.discount}
                  </div>
                  <div className="text-right text-sm font-semibold text-[#171717]">{row.subtotal}</div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 border-t border-[#E5E7EB] px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#A1A1A1]">Margin</span>
            <span className="text-sm font-bold text-[#067A55]">{marginPct}%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-[#A1A1A1]">Total, $</span>
            <span className="text-lg font-bold text-[#171717]">{formatUsd(total)}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-[38px] rounded-lg border-0 bg-[#931115] px-5 text-sm font-semibold text-white"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
