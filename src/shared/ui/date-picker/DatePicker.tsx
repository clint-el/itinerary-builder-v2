import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/shared/lib/utils'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { MONTHS_SHORT } from './labels'
import { SingleMonthCalendarGrid } from './SingleMonthCalendarGrid'
import {
  CALENDAR_MIN_YEAR,
  clampCalendarYear,
  getCalendarMaxYear,
  getCalendarYearOptions,
} from './utils'

export interface DatePickerProps {
  value?: Date | null
  onChange?: (date: Date) => void
  className?: string
  isDateDisabled?: (date: Date) => boolean
  referenceDate?: Date | null
}

export function DatePicker({
  value,
  onChange,
  className,
  isDateDisabled,
  referenceDate,
}: DatePickerProps) {
  const maxYear = useMemo(() => getCalendarMaxYear(), [])
  const initialDate = value ?? referenceDate ?? new Date()
  const [view, setView] = useState(() => ({
    year: clampCalendarYear(initialDate.getFullYear(), maxYear),
    month: initialDate.getMonth(),
  }))

  useEffect(() => {
    if (!value) return
    setView({
      year: clampCalendarYear(value.getFullYear(), maxYear),
      month: value.getMonth(),
    })
  }, [maxYear, value])

  const yearOptions = useMemo(() => getCalendarYearOptions(), [])

  const goToPrevMonth = useCallback(() => {
    setView(({ year, month }) => {
      if (month > 0) return { year, month: month - 1 }
      if (year > CALENDAR_MIN_YEAR) return { year: year - 1, month: 11 }
      return { year: CALENDAR_MIN_YEAR, month: 0 }
    })
  }, [])

  const goToNextMonth = useCallback(() => {
    setView(({ year, month }) => {
      if (month < 11) return { year, month: month + 1 }
      if (year < maxYear) return { year: year + 1, month: 0 }
      return { year, month: 11 }
    })
  }, [maxYear])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goToPrevMonth}
          aria-label="Previous month"
          className="size-9"
        >
          <ChevronLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2">
          <Select
            value={String(view.month)}
            onValueChange={(nextMonth) =>
              setView((previous) => ({ ...previous, month: Number(nextMonth) }))
            }
          >
            <SelectTrigger className="h-9 w-auto min-w-[90px] gap-2 px-3 shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {MONTHS_SHORT.map((monthLabel, index) => (
                <SelectItem key={monthLabel} value={String(index)}>
                  {monthLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={String(view.year)}
            onValueChange={(nextYear) =>
              setView((previous) => ({
                ...previous,
                year: clampCalendarYear(Number(nextYear), maxYear),
              }))
            }
          >
            <SelectTrigger className="h-9 w-auto min-w-[79px] gap-2 px-3 shadow-none focus-visible:ring-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="max-h-60">
              {yearOptions.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={goToNextMonth}
          aria-label="Next month"
          className="size-9"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <SingleMonthCalendarGrid
        year={view.year}
        month={view.month}
        selectedDate={value ?? null}
        referenceDate={referenceDate ?? null}
        onDayClick={(date) => onChange?.(date)}
        isDateDisabled={isDateDisabled}
      />
    </div>
  )
}
