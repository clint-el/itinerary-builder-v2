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

import { MONTHS_FULL, MONTHS_SHORT } from './labels'
import { RangeCalendarGrid } from './RangeCalendarGrid'
import type { CalendarDay } from './utils'
import {
  CALENDAR_MIN_YEAR,
  clampCalendarYear,
  clampRangePickerLeftView,
  getCalendarMaxYear,
  getCalendarYearOptions,
  getRightMonth,
  parseISODate,
  toISODateString,
} from './utils'

export interface DateRangePickerProps {
  from?: string
  to?: string
  onConfirm: (from: string, to: string) => void
  onSelectionChange?: (from: string, to: string) => void
  showConfirm?: boolean
  variant?: 'default' | 'panel'
  title?: string
  className?: string
}

export function DateRangePicker({
  from,
  to,
  onConfirm,
  onSelectionChange,
  showConfirm = true,
  variant = 'default',
  title,
  className,
}: DateRangePickerProps) {
  const maxYear = useMemo(() => getCalendarMaxYear(), [])
  const initialFrom = from ? parseISODate(from) : null
  const initialTo = to ? parseISODate(to) : null
  const initialAnchor = initialFrom ?? initialTo ?? new Date()

  const [view, setView] = useState(() =>
    clampRangePickerLeftView(
      clampCalendarYear(initialAnchor.getFullYear(), maxYear),
      initialAnchor.getMonth(),
      maxYear,
    ),
  )
  const [pendingFrom, setPendingFrom] = useState<Date | null>(initialFrom)
  const [pendingTo, setPendingTo] = useState<Date | null>(initialTo)
  const [hoverDate, setHoverDate] = useState<Date | null>(null)

  useEffect(() => {
    const nextFrom = from ? parseISODate(from) : null
    const nextTo = to ? parseISODate(to) : null
    const anchor = nextFrom ?? nextTo ?? new Date()
    setView(
      clampRangePickerLeftView(
        clampCalendarYear(anchor.getFullYear(), maxYear),
        anchor.getMonth(),
        maxYear,
      ),
    )
    setPendingFrom(nextFrom)
    setPendingTo(nextTo)
    setHoverDate(null)
  }, [from, maxYear, to])

  const right = getRightMonth(view.year, view.month)
  const yearOptions = useMemo(() => getCalendarYearOptions(), [])

  const goToPrevMonth = useCallback(() => {
    setView(({ year, month }) => {
      if (month > 0) return clampRangePickerLeftView(year, month - 1, maxYear)
      if (year > CALENDAR_MIN_YEAR) return clampRangePickerLeftView(year - 1, 11, maxYear)
      return clampRangePickerLeftView(CALENDAR_MIN_YEAR, 0, maxYear)
    })
  }, [maxYear])

  const goToNextMonth = useCallback(() => {
    setView(({ year, month }) => {
      if (month < 11) return clampRangePickerLeftView(year, month + 1, maxYear)
      if (year < maxYear) return clampRangePickerLeftView(year + 1, 0, maxYear)
      return clampRangePickerLeftView(year, month, maxYear)
    })
  }, [maxYear])

  const handleDayClick = useCallback(
    (day: CalendarDay) => {
      if (!pendingFrom || pendingTo !== null) {
        setPendingFrom(day.date)
        setPendingTo(null)
        setHoverDate(null)
        onSelectionChange?.(toISODateString(day.date), '')
        return
      }
      if (day.date >= pendingFrom) {
        setPendingTo(day.date)
        setHoverDate(null)
        onSelectionChange?.(toISODateString(pendingFrom), toISODateString(day.date))
        return
      }
      setPendingFrom(day.date)
      setPendingTo(null)
      setHoverDate(null)
      onSelectionChange?.(toISODateString(day.date), '')
    },
    [onSelectionChange, pendingFrom, pendingTo],
  )

  const handleDayHover = useCallback(
    (day: CalendarDay | null) => {
      if (!pendingFrom || pendingTo !== null) {
        setHoverDate(null)
        return
      }
      setHoverDate(day?.date ?? null)
    },
    [pendingFrom, pendingTo],
  )

  const handleConfirm = useCallback(() => {
    if (pendingFrom && pendingTo) {
      onConfirm(toISODateString(pendingFrom), toISODateString(pendingTo))
    }
  }, [onConfirm, pendingFrom, pendingTo])

  const rightMonthLabel = `${MONTHS_FULL[right.month]} ${right.year}`

  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        variant === 'panel' &&
          'rounded-[6px] bg-white p-3 shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-1px_rgba(0,0,0,0.06)]',
        className,
      )}
    >
      {variant === 'panel' && title ? (
        <p className="text-base font-bold leading-6 text-neutral-900">{title}</p>
      ) : null}

      <div className="flex items-center gap-2">
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

        {variant === 'panel' ? (
          <>
            <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-6">
              {`${MONTHS_FULL[view.month]} ${view.year}`}
            </p>
            <p className="min-w-0 flex-1 text-center text-sm font-semibold leading-6">{rightMonthLabel}</p>
          </>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Select
                value={String(view.month)}
                onValueChange={(nextMonth) =>
                  setView((previous) =>
                    clampRangePickerLeftView(previous.year, Number(nextMonth), maxYear),
                  )
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
                  setView((previous) =>
                    clampRangePickerLeftView(
                      clampCalendarYear(Number(nextYear), maxYear),
                      previous.month,
                      maxYear,
                    ),
                  )
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
            <span className="whitespace-nowrap text-center text-sm font-semibold leading-6">
              {rightMonthLabel}
            </span>
          </div>
        )}

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

      <div className="flex flex-1 gap-4">
        <RangeCalendarGrid
          year={view.year}
          month={view.month}
          pendingFrom={pendingFrom}
          pendingTo={pendingTo}
          hoverDate={hoverDate}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
        />
        <RangeCalendarGrid
          year={right.year}
          month={right.month}
          pendingFrom={pendingFrom}
          pendingTo={pendingTo}
          hoverDate={hoverDate}
          onDayClick={handleDayClick}
          onDayHover={handleDayHover}
        />
      </div>

      {showConfirm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!pendingFrom || !pendingTo}
          onClick={handleConfirm}
          className="h-9 self-start border-[#931115] text-sm font-medium text-[#931115] hover:bg-[#931115]/5 hover:text-[#931115] disabled:opacity-40"
        >
          Confirm
        </Button>
      ) : null}
    </div>
  )
}
