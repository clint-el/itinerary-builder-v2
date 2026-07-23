import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/shared/lib/utils'
import { CalendarIcon } from 'lucide-react'
import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { useCallback, useMemo, useState } from 'react'

import { DatePicker } from './DatePicker'
import { MONTHS_SHORT } from './labels'
import { formatDateDDMMMYYYY, parseISODate, toISODateString } from './utils'

interface DatePickerGridInputFooterContext {
  close: () => void
  open: boolean
}

export interface DatePickerGridInputProps
  extends Omit<ComponentPropsWithoutRef<'button'>, 'children' | 'onChange' | 'value'> {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  popoverContentClassName?: string
  hasError?: boolean
  isDateDisabled?: (date: Date) => boolean
  referenceValue?: string
  closeOnSelect?: boolean
  footer?: ReactNode | ((context: DatePickerGridInputFooterContext) => ReactNode)
}

export function DatePickerGridInput({
  value,
  onChange,
  placeholder = 'Select date',
  className,
  popoverContentClassName,
  id,
  disabled,
  hasError,
  isDateDisabled,
  referenceValue,
  closeOnSelect = true,
  footer,
  'aria-invalid': ariaInvalid,
  ...buttonProps
}: DatePickerGridInputProps) {
  const [open, setOpen] = useState(false)
  const dateValue = useMemo(() => (value ? parseISODate(value) : null), [value])
  const referenceDate = useMemo(
    () => (referenceValue ? parseISODate(referenceValue) : null),
    [referenceValue],
  )
  const close = useCallback(() => setOpen(false), [])
  const isInvalid = hasError || ariaInvalid === true || ariaInvalid === 'true'

  const handleSelect = useCallback(
    (date: Date) => {
      onChange?.(toISODateString(date))
      if (closeOnSelect) setOpen(false)
    },
    [closeOnSelect, onChange],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          {...buttonProps}
          type="button"
          id={id}
          disabled={disabled}
          aria-invalid={isInvalid ? 'true' : ariaInvalid}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]',
            'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            dateValue ? 'text-neutral-900' : 'text-muted-foreground',
            isInvalid && 'border-destructive bg-destructive/5 ring-1 ring-destructive/20',
            open && !isInvalid && 'border-[3px] border-red-200',
            className,
          )}
        >
          <span className="truncate">
            {dateValue ? formatDateDDMMMYYYY(dateValue, [...MONTHS_SHORT]) : placeholder}
          </span>
          <CalendarIcon
            className={cn(
              'ml-auto size-4 shrink-0 text-neutral-400',
              isInvalid && 'text-destructive',
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className={cn(
          'flex w-auto flex-col gap-4 border-none bg-white p-3 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-1px_rgba(0,0,0,0.06)]',
          popoverContentClassName,
        )}
      >
        <DatePicker
          value={dateValue}
          onChange={handleSelect}
          isDateDisabled={isDateDisabled}
          referenceDate={referenceDate}
        />
        {footer ? (
          <div className="w-full">{typeof footer === 'function' ? footer({ close, open }) : footer}</div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
