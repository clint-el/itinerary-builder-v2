import { useEffect, useRef, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { CATALOG } from '@/shared/lib/catalogs'
import type { CatalogItem, ServiceTab } from '@/shared/lib/types'
import { cn } from '@/shared/lib/utils'

export function SupplierPicker({
  tab,
  value,
  onPick,
  disabled,
}: {
  tab: ServiceTab
  value: string
  onPick: (item: CatalogItem) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const catalog = CATALOG[tab]
  const q = search.toLowerCase()
  const results = catalog.filter((item) => item.name.toLowerCase().includes(q))

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#A1A1A1]" />
        <input
          disabled={disabled}
          placeholder="Search by Supplier"
          value={open ? search : value}
          onFocus={() => {
            setOpen(true)
            setSearch('')
          }}
          onChange={(e) => {
            setSearch(e.target.value)
            setOpen(true)
          }}
          className={cn(
            'h-9 w-full rounded-md border border-[#E5E7EB] py-0 pl-8 pr-2.5 text-[13.5px] font-medium text-[#171717] outline-none',
            disabled ? 'bg-[#F3F4F6]' : 'bg-white',
          )}
        />
      </div>
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="p-3.5 text-center text-[12.5px] text-[#A1A1A1]">No suppliers found.</div>
          ) : (
            results.map((sp) => (
              <button
                key={sp.name}
                type="button"
                onClick={() => {
                  onPick(sp)
                  setOpen(false)
                  setSearch('')
                }}
                className="flex w-full items-start gap-2 border-b border-[#F1F1F3] px-3 py-2.5 text-left last:border-0 hover:bg-[#F9FAFB]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold text-[#171717]">{sp.name}</span>
                    {sp.starred ? <Star className="size-3.5 shrink-0 fill-[#F59E0B] text-[#F59E0B]" /> : null}
                  </div>
                  <div className="mt-0.5 text-[11.5px] text-[#737373]">
                    {sp.group} · {sp.headOffice}
                  </div>
                  <div className="text-[11px] text-[#A1A1A1]">{sp.location}</div>
                </div>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
