import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { CalendarIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { DateRangePicker } from './DateRangePicker'
import { MONTHS_SHORT } from './labels'
import { formatDateDDMMMYYYY, parseISODate } from './utils'

export interface DateRangePickerInputProps {
  from?: string
  to?: string
  onChange: (from: string, to: string) => void
  placeholder?: string
  hasError?: boolean
  className?: string
  disabled?: boolean
  id?: string
}

export function DateRangePickerInput({
  from,
  to,
  onChange,
  placeholder = 'Select dates',
  hasError,
  className,
  disabled,
  id,
}: DateRangePickerInputProps) {
  const [open, setOpen] = useState(false)
  const fromDate = useMemo(() => (from ? parseISODate(from) : null), [from])
  const toDate = useMemo(() => (to ? parseISODate(to) : null), [to])

  const label =
    fromDate && toDate
      ? `${formatDateDDMMMYYYY(fromDate, [...MONTHS_SHORT])} – ${formatDateDDMMMYYYY(toDate, [...MONTHS_SHORT])}`
      : fromDate
        ? `${formatDateDDMMMYYYY(fromDate, [...MONTHS_SHORT])} – …`
        : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-xs outline-none',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:opacity-50',
            fromDate ? 'text-neutral-900' : 'text-muted-foreground',
            hasError && 'border-destructive ring-1 ring-destructive/20',
            open && !hasError && 'border-[3px] border-red-200',
            className,
          )}
        >
          <span className="truncate">{label}</span>
          <CalendarIcon className="ml-auto size-4 shrink-0 text-neutral-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border-none bg-white p-3 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-1px_rgba(0,0,0,0.06)]"
      >
        <DateRangePicker
          from={from}
          to={to}
          onConfirm={(nextFrom, nextTo) => {
            onChange(nextFrom, nextTo)
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
