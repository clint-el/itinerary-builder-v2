import { useState, type DragEvent } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HOLD_STATUS_STYLE } from './builderUtils'
import { formatDay, formatUsd } from '@/shared/lib/utils'
import type { Hold } from '@/shared/lib/types'
import { DatePickerGridInput } from '@/shared/ui/date-picker'

export function HoldModal({
  open,
  onClose,
  onSubmit,
  defaultPrice,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (hold: Omit<Hold, 'id'>) => void
  defaultPrice: number
}) {
  const [ref, setRef] = useState('')
  const [comment, setComment] = useState('')
  const [selDate, setSelDate] = useState('')

  function reset() {
    setRef('')
    setComment('')
    setSelDate('')
  }

  function putOnHold() {
    if (!selDate) return
    onSubmit({
      status: 'Requested',
      price: defaultPrice,
      date: formatDay(selDate),
      ref,
      comment,
    })
    reset()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Put on hold</DialogTitle>
          <DialogDescription>Add an expiration date for your hold</DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label>Expiration date</Label>
          <DatePickerGridInput
            value={selDate}
            onChange={setSelDate}
            placeholder="Select expiration date"
            className="bg-white"
          />
        </div>

        <div className="grid gap-3 pt-2">
          <div className="grid gap-1.5">
            <Label>Reference</Label>
            <Input placeholder="Type Reference Number" value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>Comment</Label>
            <textarea
              placeholder="Type any comment here"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="h-16 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[13px] outline-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!selDate} onClick={putOnHold} className="bg-[#931115] hover:bg-[#7a0e12]">
            Put on hold
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomExtraModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  onSubmit: (extra: {
    title: string
    serviceType: string
    chargeType: string
    timeUnit: string
    qty: number
    units: number
    price: number
    dateFrom: string
    dateTo: string
  }) => void
}) {
  const [title, setTitle] = useState('')
  const [serviceType, setServiceType] = useState('Others')
  const [chargeType, setChargeType] = useState('Unit')
  const [timeUnit, setTimeUnit] = useState('None')
  const [qty, setQty] = useState(1)
  const [units, setUnits] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sell, setSell] = useState('')

  const valid = !!(title.trim() && serviceType && chargeType && timeUnit && dateFrom)

  function reset() {
    setTitle('')
    setServiceType('Others')
    setChargeType('Unit')
    setTimeUnit('None')
    setQty(1)
    setUnits('')
    setDateFrom('')
    setDateTo('')
    setSell('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          reset()
          onClose()
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add custom extra</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Service type</Label>
              <Select
                value={serviceType}
                onValueChange={setServiceType}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {['Accommodation', 'Activity', 'Others', 'Transport', 'Flight', 'Fee'].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Charge type</Label>
              <Select
                value={chargeType}
                onValueChange={setChargeType}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {['Person', 'Unit'].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-1.5">
              <Label>Time unit</Label>
              <Select
                value={timeUnit}
                onValueChange={setTimeUnit}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                {['None', 'Night', 'Day', 'Stay'].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Qty</Label>
              <div className="flex h-9 items-center gap-1 rounded-md border px-1">
                <button type="button" className="px-2" onClick={() => setQty((q) => Math.max(1, q - 1))}>
                  −
                </button>
                <span className="flex-1 text-center text-sm font-semibold">{qty}</span>
                <button type="button" className="px-2" onClick={() => setQty((q) => q + 1)}>
                  +
                </button>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Units</Label>
              <Input value={units} onChange={(e) => setUnits(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>From</Label>
              <DatePickerGridInput
                value={dateFrom}
                onChange={setDateFrom}
                className="bg-white"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>To</Label>
              <DatePickerGridInput
                value={dateTo}
                onChange={setDateTo}
                referenceValue={dateFrom}
                className="bg-white"
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Sell price</Label>
            <Input value={sell} onChange={(e) => setSell(e.target.value)} placeholder="25" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            className="bg-[#931115] hover:bg-[#7a0e12]"
            onClick={() => {
              if (!valid) return
              onSubmit({
                title: title.trim(),
                serviceType,
                chargeType,
                timeUnit,
                qty,
                units: Number(units) || 1,
                price: String(sell).trim() ? Number(sell) : 25,
                dateFrom,
                dateTo,
              })
              reset()
              onClose()
            }}
          >
            Add extra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ActivityTypeModal({
  open,
  onClose,
  types,
  defaultStart,
  defaultEnd,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  types: { name: string; rate: number; includes: string; excludes: string }[]
  defaultStart: string
  defaultEnd: string
  onSubmit: (payload: { name: string; rate: number; start: string; end: string }) => void
}) {
  const [actType, setActType] = useState('')
  const [actStart, setActStart] = useState(defaultStart)
  const [actEnd, setActEnd] = useState(defaultEnd)
  const selected = types.find((t) => t.name === actType)
  const valid = !!(actType && actStart)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add activity</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Activity type</Label>
            <Select
              value={actType || undefined}
              onValueChange={setActType}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Select…" />
              </SelectTrigger>
              <SelectContent>
              {types.map((t) => (
                <SelectItem key={t.name} value={t.name}>
                  {t.name}
                </SelectItem>
              ))}
              </SelectContent>
            </Select>
          </div>
          {selected ? (
            <div className="space-y-2 rounded-lg border bg-[#FAFAFB] p-3 text-[12.5px] text-[#525252]">
              <div>
                <div className="mb-0.5 font-semibold text-[#171717]">Includes</div>
                {selected.includes}
              </div>
              <div>
                <div className="mb-0.5 font-semibold text-[#171717]">Excludes</div>
                {selected.excludes}
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Start</Label>
              <DatePickerGridInput
                value={actStart}
                onChange={setActStart}
                className="bg-white"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>End</Label>
              <DatePickerGridInput
                value={actEnd}
                onChange={setActEnd}
                referenceValue={actStart}
                className="bg-white"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid}
            className="bg-[#931115] hover:bg-[#7a0e12]"
            onClick={() => {
              if (!valid) return
              const t = selected || { name: actType, rate: 60 }
              onSubmit({ name: t.name, rate: t.rate, start: actStart, end: actEnd })
              setActType('')
              onClose()
            }}
          >
            Add activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function HoldsList({
  holds,
  onConfirm,
  onRelease,
  onAdd,
}: {
  holds: Hold[]
  onConfirm: (id: string) => void
  onRelease: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12.5px] font-bold uppercase tracking-wide text-[#525252]">Supplier holds</h4>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="size-3.5" />
          Add hold
        </Button>
      </div>
      {holds.length === 0 ? (
        <p className="text-[12.5px] text-[#A1A1A1]">No holds yet.</p>
      ) : (
        holds.map((h) => {
          const st = HOLD_STATUS_STYLE[h.status]
          return (
            <div
              key={h.id}
              className="overflow-hidden rounded-lg border"
              style={{ borderColor: st.borderColor, background: st.bodyBg }}
            >
              <div
                className="flex items-center justify-between px-3 py-2 text-[12px] font-bold"
                style={{ background: st.headerBg, color: st.headerFg }}
              >
                <span>{h.status}</span>
                <span>{formatUsd(h.price)}</span>
              </div>
              <div className="space-y-1.5 px-3 py-2.5 text-[12.5px] text-[#525252]">
                <div>
                  {h.status === 'Requested' ? 'Requested ' : ''}
                  {h.date}
                  {h.ref ? ` · ${h.ref}` : ''}
                </div>
                {h.comment ? <div className="text-[#737373]">{h.comment}</div> : null}
                <div className="flex gap-2 pt-1">
                  {h.status === 'Requested' ? (
                    <Button size="sm" variant="outline" onClick={() => onConfirm(h.id)}>
                      Confirm hold
                    </Button>
                  ) : null}
                  {h.status === 'Held' ? (
                    <Button size="sm" variant="outline" onClick={() => onRelease(h.id)}>
                      Release
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}

export function GuestChip({
  name,
  meta,
  lead,
  resLabel,
  resBg,
  resFg,
  bg,
  bd,
  draggable,
  onDragStart,
  onRemove,
}: {
  name: string
  meta?: string
  lead?: boolean
  resLabel: string
  resBg: string
  resFg: string
  bg: string
  bd: string
  draggable?: boolean
  onDragStart?: (e: DragEvent) => void
  onRemove?: () => void
}) {
  return (
    <span
      draggable={draggable}
      onDragStart={onDragStart}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1"
      style={{ background: bg, borderColor: bd }}
    >
      <span className="flex flex-col leading-tight">
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-semibold text-[#171717]">{name}</span>
          <span
            className="inline-flex h-[15px] items-center rounded px-1 text-[9px] font-bold"
            style={{ background: resBg, color: resFg }}
          >
            {resLabel}
          </span>
          {lead ? (
            <span className="inline-flex h-[15px] items-center rounded bg-[#931115] px-1 text-[9px] font-bold text-white">
              LEAD
            </span>
          ) : null}
        </span>
        {meta ? <span className="text-[10.5px] text-[#A1A1A1]">{meta}</span> : null}
      </span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="text-[#A1A1A1] hover:text-[#931115]">
          <X className="size-3" />
        </button>
      ) : null}
    </span>
  )
}
