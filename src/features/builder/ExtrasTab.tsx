import { Plus, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ExtraCatalogItem } from '@/shared/lib/catalogs'
import { cn, formatUsd } from '@/shared/lib/utils'

export type SelectedExtra = {
  id: string
  title: string
  price: number
  mandatory?: boolean
  custom?: boolean
  qty?: number
}

type ExtrasTabProps = {
  selected: SelectedExtra[]
  catalog: ExtraCatalogItem[]
  extraIds: string[]
  onAdd: (id: string) => void
  onRemove: (extra: SelectedExtra) => void
  onCustom: () => void
  /** Optional hint under “Available extras” (e.g. activity linkage). */
  availableHint?: string
  emptyAvailableMessage?: string
  className?: string
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#A1A1A1]">{children}</p>
  )
}

function ExtraRow({
  title,
  price,
  mandatory,
  onRemove,
}: {
  title: string
  price: number
  mandatory?: boolean
  onRemove?: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-lg border px-3 py-2',
        mandatory ? 'border-[#E5E7EB] bg-[#F3F4F6]' : 'border-[#E5E7EB] bg-white',
      )}
    >
      <div>
        <div className="text-[13px] font-semibold text-[#171717]">{title}</div>
        {mandatory ? (
          <div className="text-[11px] font-semibold text-[#737373]">Mandatory</div>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[13px] font-semibold">{formatUsd(price)}</span>
        {onRemove ? (
          <button type="button" onClick={onRemove} className="text-[#931115]" aria-label="Remove extra">
            <Trash2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Shared Extras tab: Mandatory first, then selected optionals, then available extras to add.
 */
export function ExtrasTab({
  selected,
  catalog,
  extraIds,
  onAdd,
  onRemove,
  onCustom,
  availableHint,
  emptyAvailableMessage = 'No more extras available.',
  className,
}: ExtrasTabProps) {
  const mandatoryCatalog = catalog.filter((c) => c.mandatory)
  const mandatorySelected = selected.filter((e) => e.mandatory && !e.custom)
  const mandatoryIds = new Set([
    ...mandatoryCatalog.map((c) => c.id),
    ...mandatorySelected.map((e) => e.id),
  ])

  // Prefer catalog definitions for mandatory rows; fall back to selected objects.
  const mandatoryRows: SelectedExtra[] = [
    ...mandatoryCatalog.map((c) => {
      const sel = selected.find((e) => e.id === c.id)
      return {
        id: c.id,
        title: c.title,
        price: sel ? sel.price * (sel.qty || 1) : c.price,
        mandatory: true,
      }
    }),
    ...mandatorySelected.filter((e) => !mandatoryCatalog.some((c) => c.id === e.id)),
  ]

  const optionalSelected = selected.filter((e) => !mandatoryIds.has(e.id) && !e.mandatory)
  const available = catalog.filter((c) => !c.mandatory && !extraIds.includes(c.id))

  return (
    <div className={cn('space-y-4', className)}>
      {mandatoryRows.length > 0 ? (
        <div>
          <SectionLabel>Mandatory</SectionLabel>
          <div className="space-y-1.5">
            {mandatoryRows.map((ex) => (
              <ExtraRow key={ex.id} title={ex.title} price={ex.price} mandatory />
            ))}
          </div>
        </div>
      ) : null}

      <div>
        {optionalSelected.length > 0 ? (
          <>
            <SectionLabel>Selected</SectionLabel>
            <div className="space-y-1.5">
              {optionalSelected.map((ex) => (
                <ExtraRow
                  key={ex.id}
                  title={ex.title}
                  price={ex.price * (ex.qty || 1)}
                  onRemove={() => onRemove(ex)}
                />
              ))}
            </div>
          </>
        ) : mandatoryRows.length === 0 ? (
          <p className="text-[12.5px] text-[#A1A1A1]">No extras selected.</p>
        ) : null}
      </div>

      <div>
        <SectionLabel>Available extras</SectionLabel>
        {availableHint ? (
          <p className="mb-2 text-[12px] text-[#94A3B8]">{availableHint}</p>
        ) : null}
        <div className="space-y-1.5">
          {available.length === 0 ? (
            <p className="text-[12.5px] text-[#A1A1A1]">{emptyAvailableMessage}</p>
          ) : (
            available.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onAdd(c.id)}
                className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-left hover:bg-[#F9FAFB]"
              >
                <span className="text-[13px] font-semibold">{c.title}</span>
                <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[#525252]">
                  {formatUsd(c.price)}
                  <Plus className="size-3.5 text-[#931115]" />
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onCustom}
        className="text-[12px] font-medium text-[#0369A1] hover:underline"
      >
        Add Custom Extra
      </button>
    </div>
  )
}
