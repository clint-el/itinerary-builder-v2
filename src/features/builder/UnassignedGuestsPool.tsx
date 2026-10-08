import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/shared/lib/utils'
import { GuestChip } from './BuilderModals'
import { guestChipStyle } from './builderUtils'
import type { Guest } from '@/shared/lib/types'

export function UnassignedGuestsPool({
  guests,
  unassignedIds,
  onUnassignDrop,
  dragHint,
  emptyHint,
}: {
  emptyHint?: string
  guests: Guest[]
  unassignedIds: number[]
  onUnassignDrop: (guestId: number) => void
  /** Shown under the chips while guests are waiting to be assigned. */
  dragHint: string
}) {
  const unassigned = guests.filter((g) => unassignedIds.includes(g.id))

  return (
    <Card
      className={cn(
        'shadow-none transition-shadow',
        unassigned.length > 0 ? 'border-amber-200 bg-amber-50/80' : 'bg-muted/30',
      )}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        const gid = Number(e.dataTransfer.getData('text/plain'))
        if (gid) onUnassignDrop(gid)
      }}
    >
      <CardContent className="p-3">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          Unassigned guests ({unassigned.length})
        </p>
        {unassigned.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {unassigned.map((g) => {
              const cs = guestChipStyle(g)
              return (
                <GuestChip
                  key={g.id}
                  name={g.name}
                  meta={cs.meta}
                  lead={cs.lead}
                  resLabel={cs.resLabel}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', String(g.id))}
                />
              )
            })}
          </div>
        ) : guests.length === 0 ? (
          <p className="min-h-10 text-xs text-muted-foreground">
            No travellers on this itinerary yet.
          </p>
        ) : (
          <p className="min-h-10 text-xs text-muted-foreground">
            {emptyHint ?? 'All guests are assigned.'}
          </p>
        )}
        {unassigned.length > 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">{dragHint}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
