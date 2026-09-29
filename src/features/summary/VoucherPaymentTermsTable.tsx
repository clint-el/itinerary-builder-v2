import type { SupplierPaymentTermRow } from '@/shared/lib/supplierPaymentTerms'

export function VoucherPaymentTermsTable({ rows }: { rows: SupplierPaymentTermRow[] }) {
  if (!rows.length) return null
  return (
    <div className="mt-1.5 w-1/2 min-w-[280px] max-w-full overflow-hidden rounded-lg border border-[#E5E7EB]">
      <div className="grid grid-cols-[minmax(72px,0.9fr)_minmax(100px,1.1fr)_minmax(88px,0.85fr)_minmax(100px,1fr)] gap-2 border-b border-[#EFEFEF] bg-[#FAFAFB] px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.35px] text-[#94A3B8]">
        <span>Term</span>
        <span>Travel dates</span>
        <span>Deposit</span>
        <span>Balance due</span>
      </div>
      {rows.map((row, i) => (
        <div
          key={`${row.name}-${i}`}
          className="grid grid-cols-[minmax(72px,0.9fr)_minmax(100px,1.1fr)_minmax(88px,0.85fr)_minmax(100px,1fr)] gap-2 border-b border-[#F3F4F6] px-2.5 py-2 text-[11.5px] last:border-b-0"
        >
          <span className="font-semibold text-[#171717]">{row.name}</span>
          <span className="text-[#525252]">{row.travelDates}</span>
          <span className="text-[#525252]">{row.deposit}</span>
          <span className="text-[#525252]">{row.balanceDue}</span>
        </div>
      ))}
    </div>
  )
}
