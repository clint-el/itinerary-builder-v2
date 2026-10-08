import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { PROMOTIONS } from '@/shared/lib/catalogs'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/shared/lib/utils'

/** Outline action in brand red (Auto-assign, Duplicate, Remove). */
export const brandOutlineActionClassName =
  'border-[#931115] text-[#931115] hover:bg-[#931115]/5 hover:text-[#931115]'

/** Full-width dashed "Add room" / "Add vehicle" button. */
export const addItemButtonClassName =
  'h-9 w-full justify-center gap-1.5 border-dashed border-border bg-muted/30 text-sm font-semibold text-[#931115] shadow-none hover:bg-muted/40 hover:text-[#931115] disabled:border-border disabled:bg-muted/20 disabled:text-muted-foreground'

export const leadBadgeClassName =
  'inline-flex h-4 items-center rounded-[4px] bg-[#931115] px-1 text-[9px] font-bold uppercase leading-none text-white'

export function residencyBadgeClassName(label: string) {
  if (label === 'C') return 'rounded px-1 text-[10px] font-bold leading-none bg-blue-100 text-blue-700'
  if (label === 'NR') return 'rounded px-1 text-[10px] font-bold leading-none bg-amber-100 text-amber-800'
  return 'text-[10px] font-bold leading-none text-emerald-600'
}

export function FieldGroup({
  label,
  required,
  hint,
  className,
  labelAddon,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  className?: string
  labelAddon?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-center gap-2">
        <Label>
          {label}
          {required ? <span className="text-destructive">*</span> : null}
        </Label>
        {labelAddon}
      </div>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SupplierServiceCard({
  location,
  supplier,
  service,
  hasLocation,
  hasSupplier,
  children,
}: {
  location: ReactNode
  supplier: ReactNode
  service?: ReactNode
  hasLocation: boolean
  hasSupplier: boolean
  /** Extra fields rendered after Service (e.g. Activity type). */
  children?: ReactNode
}) {
  return (
    <Card className="bg-muted/40 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">
            Supplier &amp; service
          </h3>
          <p className="text-xs text-muted-foreground">
            {service ? 'Pick location, supplier, and service' : 'Pick location and supplier'}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldGroup label="Location" required>
            {location}
          </FieldGroup>
          <FieldGroup
            label="Supplier"
            required
            hint={hasLocation ? undefined : 'Pick a location first'}
            className={service ? 'sm:row-span-2 sm:self-start' : undefined}
          >
            {supplier}
          </FieldGroup>
          {service ? (
            <FieldGroup label="Service" hint={hasSupplier ? undefined : 'Pick a supplier first'}>
              {service}
            </FieldGroup>
          ) : null}
          {children}
        </div>
      </CardContent>
    </Card>
  )
}

export function LineTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: T; label: string; count?: number }[]
  value: T
  onChange: (key: T) => void
}) {
  return (
    <div role="tablist" className="flex w-full justify-start gap-1 border-b">
      {tabs.map((tab) => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count != null && tab.count > 0 ? (
              <Badge
                variant="secondary"
                className="h-4 min-w-4 justify-center rounded-full border-0 bg-info-bg px-1.5 py-0 text-[10px] font-semibold leading-4 text-text-info-bold"
              >
                {tab.count}
              </Badge>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function SectionHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function EmptyStateCard({ children, compact }: { children: ReactNode; compact?: boolean }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent
        className={cn(
          'text-center text-muted-foreground',
          compact ? 'p-4 text-xs' : 'p-6 text-sm',
        )}
      >
        {children}
      </CardContent>
    </Card>
  )
}

export function ItemIndex({ n }: { n: number }) {
  return (
    <Badge variant="outline" className="size-5 shrink-0 justify-center rounded-md p-0 text-[11px]">
      {n}
    </Badge>
  )
}

export function PaxCount({ assigned, cap }: { assigned: number; cap: number | null }) {
  const over = cap != null && assigned > cap
  return (
    <span className={cn('text-xs font-semibold', over ? 'text-destructive' : 'text-text-success')}>
      {assigned} / {cap ?? '—'} PAX
    </span>
  )
}

/** Compact guest pill used on flight, activity and other items. */
export function GuestBadge({
  label,
  lead,
  onRemove,
}: {
  label: string
  lead?: boolean
  onRemove?: () => void
}) {
  return (
    <Badge variant="secondary" className="gap-1 rounded-md font-medium">
      {label}
      {lead ? <span className="text-[10px] uppercase">Lead</span> : null}
      {onRemove ? (
        <button
          type="button"
          className="inline-flex"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
        >
          <X className="size-3" />
        </button>
      ) : null}
    </Badge>
  )
}

export function SpecialOffersList({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <div role="radiogroup" aria-label="Special offers" className="flex flex-col gap-3">
      {PROMOTIONS.map((p) => {
        const selected = selectedId === p.id
        return (
          <div
            key={p.id}
            role="radio"
            aria-checked={selected}
            tabIndex={0}
            onClick={() => onSelect(selected ? null : p.id)}
            onKeyDown={(e) => {
              if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault()
                onSelect(selected ? null : p.id)
              }
            }}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 outline-none transition-colors',
              selected ? 'border-link bg-info-bg' : 'border-border bg-background',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2',
                selected ? 'border-link' : 'border-muted-foreground/50',
              )}
            >
              {selected ? <span className="size-2 rounded-full bg-link" /> : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{p.title}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.desc}
                {p.active ? (
                  <>
                    {' '}
                    <span className="font-semibold text-text-success">Active</span>
                  </>
                ) : null}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function LineNotesTab({
  serviceNotes,
  notes,
  onNotesChange,
  placeholder = 'Anything the ops team should know about this service…',
}: {
  serviceNotes: string
  notes: string
  onNotesChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2">
        <h4 className="text-sm font-semibold text-foreground">Service notes</h4>
        <p className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          {serviceNotes}
        </p>
      </div>
      <div className="grid gap-2">
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-semibold text-foreground">Internal notes</h4>
          <span className="text-xs text-muted-foreground">Not shown to the client.</span>
        </div>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
        />
      </div>
    </div>
  )
}
