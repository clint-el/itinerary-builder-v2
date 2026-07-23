import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, MapPin, Search } from 'lucide-react'
import { LOCATION_TREE } from '@/shared/lib/catalogs'
import { cn } from '@/shared/lib/utils'

type LocNode = {
  id: string
  name: string
  kind: string
  children?: LocNode[]
}

type LocRow = {
  id: string
  indent: number
  name: string
  kind: string
  hasChildren: boolean
  expanded: boolean
}

function flatten(nodes: LocNode[], out: LocNode[] = []): LocNode[] {
  for (const n of nodes) {
    out.push(n)
    if (n.children) flatten(n.children, out)
  }
  return out
}

function buildRows(expanded: Record<string, boolean>, search: string): LocRow[] {
  const q = search.trim().toLowerCase()
  if (q) {
    return flatten(LOCATION_TREE as LocNode[])
      .filter((n) => n.name.toLowerCase().includes(q))
      .map((n) => ({
        id: n.id,
        indent: 0,
        name: n.name,
        kind: n.kind,
        hasChildren: false,
        expanded: false,
      }))
  }
  const rows: LocRow[] = []
  const walk = (nodes: LocNode[], indent: number) => {
    for (const n of nodes) {
      const hasKids = !!(n.children && n.children.length)
      const exp = !!expanded[n.id]
      rows.push({
        id: n.id,
        indent,
        name: n.name,
        kind: n.kind,
        hasChildren: hasKids,
        expanded: exp,
      })
      if (hasKids && exp) walk(n.children!, indent + 1)
    }
  }
  walk(LOCATION_TREE as LocNode[], 0)
  return rows
}

export function LocationDropdown({
  value,
  onChange,
  placeholder = 'Select location',
  clearSupplierOnPick = false,
  onClearSupplier,
}: {
  value: string
  onChange: (name: string) => void
  placeholder?: string
  clearSupplierOnPick?: boolean
  onClearSupplier?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ kenya: true })
  const rootRef = useRef<HTMLDivElement>(null)

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

  const rows = buildRows(expanded, search)

  function pick(name: string) {
    onChange(name)
    if (clearSupplierOnPick) onClearSupplier?.()
    setOpen(false)
    setSearch('')
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setSearch('')
        }}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-[#E5E7EB] bg-white px-2.5"
      >
        <MapPin className="size-3.5 shrink-0 text-[#A1A1A1]" />
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-left text-[13.5px] font-medium',
            value ? 'text-[#171717]' : 'text-[#A1A1A1]',
          )}
        >
          {value || placeholder}
        </span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-[#A1A1A1] transition-transform', open && 'rotate-180')}
        />
      </button>
      {open ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-lg">
          <div className="relative border-b border-[#F1F1F3] p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-[#A1A1A1]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="h-8 w-full rounded-lg border border-[#E5E7EB] py-0 pl-8 pr-2.5 text-[13px] outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => pick('All')}
            className="flex w-full items-center gap-2 border-b border-[#F1F1F3] px-3.5 py-2.5 text-left text-[13px] font-semibold text-[#171717] hover:bg-[#F9FAFB]"
          >
            All locations
          </button>
          <div className="max-h-56 overflow-y-auto">
            {rows.map((row) => (
              <div
                key={row.id + row.name + row.indent}
                className="flex items-center gap-2 border-b border-[#F1F1F3] last:border-0"
                style={{ paddingLeft: 14 + row.indent * 20, paddingRight: 14, paddingTop: 9, paddingBottom: 9 }}
              >
                {row.hasChildren ? (
                  <button
                    type="button"
                    onClick={() => setExpanded((prev) => ({ ...prev, [row.id]: !prev[row.id] }))}
                    className="flex size-5 items-center justify-center text-[#A1A1A1]"
                  >
                    <ChevronRight
                      className={cn('size-3.5 transition-transform', row.expanded && 'rotate-90')}
                    />
                  </button>
                ) : (
                  <span className="size-5" />
                )}
                <button
                  type="button"
                  onClick={() => pick(row.name)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="truncate text-[13px] font-semibold text-[#171717]">{row.name}</div>
                  <div className="text-[11px] text-[#A1A1A1]">{row.kind}</div>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
