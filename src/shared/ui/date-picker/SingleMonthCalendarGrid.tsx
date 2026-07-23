import { cn } from '@/shared/lib/utils'
import { useMemo } from 'react'

import { WEEKDAYS_SHORT } from './labels'
import type { CalendarDay } from './utils'
import { getCalendarDays, isSameDay } from './utils'

interface SingleMonthCalendarGridProps {
  year: number
  month: number
  selectedDate: Date | null
  referenceDate?: Date | null
  onDayClick: (date: Date) => void
  isDateDisabled?: (date: Date) => boolean
}

export function SingleMonthCalendarGrid({
  year,
  month,
  selectedDate,
  referenceDate,
  onDayClick,
  isDateDisabled,
}: SingleMonthCalendarGridProps) {
  const days = useMemo(() => getCalendarDays(year, month), [year, month])
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = []
    for (let index = 0; index < days.length; index += 7) {
      result.push(days.slice(index, index + 7))
    }
    return result
  }, [days])

  return (
    <div className="flex flex-col gap-px">
      <div className="grid grid-cols-7 gap-px">
        {WEEKDAYS_SHORT.map((label) => (
          <div
            key={label}
            className="flex size-8 items-center justify-center text-xs font-medium leading-5 text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      {weeks.map((week, weekIndex) => (
        <div key={weekIndex} className="grid grid-cols-7 gap-px">
          {week.map((day) => {
            const isSelected = selectedDate ? isSameDay(day.date, selectedDate) : false
            const isReference =
              !isSelected && referenceDate ? isSameDay(day.date, referenceDate) : false
            const isDisabled = isDateDisabled?.(day.date) ?? false

            return (
              <button
                key={day.date.toISOString()}
                type="button"
                onClick={() => {
                  if (!isDisabled) onDayClick(day.date)
                }}
                disabled={isDisabled}
                className={cn(
                  'flex size-8 items-center justify-center rounded-[4px] bg-white text-sm font-medium leading-6 text-neutral-900 transition-colors',
                  isDisabled && 'cursor-not-allowed text-muted-foreground opacity-50',
                  !day.isCurrentMonth && !isDisabled && 'opacity-50 hover:opacity-70',
                  day.isCurrentMonth && !isSelected && !isDisabled && 'hover:bg-[#931115]/10',
                  isSelected && 'bg-[#931115] text-white',
                  isReference && !isDisabled && 'bg-[#931115]/20',
                  day.isToday && !isSelected && !isDisabled && 'ring-1 ring-inset ring-[#931115]/40',
                )}
              >
                {day.day}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
