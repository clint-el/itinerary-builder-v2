export interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function getCalendarDays(year: number, month: number): CalendarDay[] {
  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const startDow = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const days: CalendarDay[] = [];

  const prevMonthDays = new Date(year, month, 0).getDate();
  for (let i = startDow - 1; i >= 0; i--) {
    const date = new Date(year, month - 1, prevMonthDays - i);
    days.push({
      date,
      day: date.getDate(),
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    days.push({
      date,
      day,
      isCurrentMonth: true,
      isToday: isSameDay(date, today),
    });
  }

  // Keep a stable 6x7 grid to prevent popover repositioning
  // when switching between 5-week and 6-week months.
  const trailing = 42 - days.length;
  for (let day = 1; day <= trailing; day++) {
    const date = new Date(year, month + 1, day);
    days.push({
      date,
      day,
      isCurrentMonth: false,
      isToday: isSameDay(date, today),
    });
  }

  return days;
}

/** Earliest selectable year in calendar dropdowns / navigation. */
export const CALENDAR_MIN_YEAR = 1970;

export function getCalendarMaxYear(referenceDate: Date = new Date()): number {
  return Math.max(referenceDate.getFullYear() + 50, 2100);
}

export function getCalendarYearOptions(
  referenceDate: Date = new Date()
): number[] {
  const max = getCalendarMaxYear(referenceDate);
  const years: number[] = [];

  for (let year = CALENDAR_MIN_YEAR; year <= max; year++) {
    years.push(year);
  }

  return years;
}

export function clampCalendarYear(year: number, maxYear: number): number {
  return Math.min(Math.max(year, CALENDAR_MIN_YEAR), maxYear);
}

export function getRightMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }

  return { year, month: month + 1 };
}

/** Ensures the dual range grid's second month does not exceed {@link getCalendarMaxYear}. */
export function clampRangePickerLeftView(
  year: number,
  month: number,
  maxYear: number
): { year: number; month: number } {
  const nextYear = clampCalendarYear(year, maxYear);
  const right = getRightMonth(nextYear, month);

  if (right.year > maxYear) {
    return { year: maxYear, month: 10 };
  }

  return { year: nextYear, month };
}

export function formatDateDisplay(date: Date, monthsFull: string[]): string {
  return `${date.getDate()} ${monthsFull[date.getMonth()]} ${date.getFullYear()}`;
}

export function formatDateDDMMMYYYY(date: Date, monthsShort: string[]): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = monthsShort[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export function parseISODate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

export function toISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/** Adds calendar days to an ISO date string (`YYYY-MM-DD`). Returns `isoDate` if parsing fails. */
export function addDaysToISODate(isoDate: string, deltaDays: number): string {
  const d = parseISODate(isoDate);
  if (!d) {
    return isoDate;
  }

  d.setDate(d.getDate() + deltaDays);
  return toISODateString(d);
}
