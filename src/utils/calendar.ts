export interface CalendarCell {
  day: number | null
  date: Date | null
  iso: string | null // yyyy-mm-dd in LOCAL time (matches how deliveryDate is stored)
}

function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 6-row (42 cell) month grid, Sunday-first (Su Mo Tu We Th Fr Sa). */
export function getMonthGrid(year: number, month: number): CalendarCell[] {
  const days: CalendarCell[] = []
  const startingDay = new Date(year, month, 1).getDay() // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  for (let i = 0; i < startingDay; i++) {
    days.push({ day: null, date: null, iso: null })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(year, month, i)
    days.push({ day: i, date, iso: localISO(date) })
  }
  while (days.length < 42) {
    days.push({ day: null, date: null, iso: null })
  }
  return days
}
