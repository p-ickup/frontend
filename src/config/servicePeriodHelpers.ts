import {
  SERVICE_PERIODS,
  type DateRange,
  type ServicePeriod,
  type TripDirection,
} from '@/config/servicePeriods'

export interface BufferedPeriod {
  start: string
  end: string
  deadline: string
  name: string
}

export function getServicePeriods(): ServicePeriod[] {
  return SERVICE_PERIODS
}

export function getBufferedPeriods(): BufferedPeriod[] {
  return SERVICE_PERIODS.map((period) => ({
    start: period.buffered.start,
    end: period.buffered.end,
    deadline: period.deadline,
    name: period.name,
  }))
}

function parseCalendarDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function isDateInRange(date: string, range?: DateRange): boolean {
  if (!date || !range) {
    return false
  }

  const target = parseCalendarDate(date)
  const start = parseCalendarDate(range.start)
  const end = parseCalendarDate(range.end)

  return target >= start && target <= end
}

export function expandDateRangeToMMDD(range: DateRange): string[] {
  const dates: string[] = []
  const cursor = parseCalendarDate(range.start)
  const end = parseCalendarDate(range.end)

  while (cursor <= end) {
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const day = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${month}-${day}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function getDerivedCoveredDates(): {
  outbound: string[]
  inbound: string[]
} {
  const outbound = new Set<string>()
  const inbound = new Set<string>()

  for (const period of SERVICE_PERIODS) {
    if (period.subsidized.outbound) {
      for (const date of expandDateRangeToMMDD(period.subsidized.outbound)) {
        outbound.add(date)
      }
    }
    if (period.subsidized.inbound) {
      for (const date of expandDateRangeToMMDD(period.subsidized.inbound)) {
        inbound.add(date)
      }
    }
  }

  return {
    outbound: Array.from(outbound).sort(),
    inbound: Array.from(inbound).sort(),
  }
}

export function isDateCovered(date: string, toAirport: boolean): boolean {
  if (!date) {
    return false
  }

  const [, month, day] = date.split('-')
  const mmdd = `${month}-${day}`
  const { outbound, inbound } = getDerivedCoveredDates()

  return toAirport ? outbound.includes(mmdd) : inbound.includes(mmdd)
}

export function getPeriodForBufferedDate(
  date: string,
): ServicePeriod | undefined {
  if (!date) {
    return undefined
  }

  return SERVICE_PERIODS.find((period) => isDateInRange(date, period.buffered))
}

export function getAllowedDirectionsForPeriodAndDate(
  date: string,
  period: ServicePeriod,
): TripDirection[] {
  const directions: TripDirection[] = []

  if (
    period.allowedDirections.includes('outbound') &&
    isDateInRange(date, period.subsidized.outbound)
  ) {
    directions.push('outbound')
  }

  if (
    period.allowedDirections.includes('inbound') &&
    isDateInRange(date, period.subsidized.inbound)
  ) {
    directions.push('inbound')
  }

  return directions
}

export function getAllowedDirectionsForDate(date: string): TripDirection[] {
  if (!date) {
    return []
  }

  const directions = new Set<TripDirection>()

  for (const period of SERVICE_PERIODS) {
    for (const direction of getAllowedDirectionsForPeriodAndDate(
      date,
      period,
    )) {
      directions.add(direction)
    }
  }

  return ['outbound', 'inbound'].filter((direction) =>
    directions.has(direction as TripDirection),
  ) as TripDirection[]
}

export function isDirectionAllowedForDate(
  date: string,
  toAirport: boolean,
): boolean {
  const direction: TripDirection = toAirport ? 'outbound' : 'inbound'
  return getAllowedDirectionsForDate(date).includes(direction)
}

export function isInSubsidizedWindow(
  date: string,
  toAirport: boolean,
): boolean {
  return isDateCovered(date, toAirport)
}

export function isFlightPastDeadline(
  flightDate: string,
  now: Date = new Date(),
): {
  isPastDeadline: boolean
  periodName?: string
  deadline?: Date
} {
  if (!flightDate) {
    return { isPastDeadline: false }
  }

  const period = getPeriodForBufferedDate(flightDate)
  if (!period) {
    return { isPastDeadline: false }
  }

  const deadlineDate = new Date(period.deadline)

  return {
    isPastDeadline: now > deadlineDate,
    periodName: period.name,
    deadline: deadlineDate,
  }
}

export function formatDeadlineForDisplay(deadline: string): string {
  const deadlineDate = new Date(deadline)
  const weekday = deadlineDate.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
  })
  const datePart = deadlineDate.toLocaleDateString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
  const timePart = deadlineDate.toLocaleTimeString('en-US', {
    timeZone: 'America/Los_Angeles',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${weekday}, ${datePart} at ${timePart} PT`
}

function formatShortDateRange(range: DateRange): string {
  const start = parseCalendarDate(range.start)
  const end = parseCalendarDate(range.end)
  const startMonth = start.toLocaleDateString('en-US', { month: 'long' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'long' })
  const startDay = start.getDate()
  const endDay = end.getDate()

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}`
  }

  return `${startMonth} ${startDay}-${endMonth} ${endDay}`
}

export function formatSubsidizedWindowsForDisplay(
  period: ServicePeriod,
): string[] {
  const lines: string[] = []

  if (period.subsidized.outbound) {
    lines.push(
      `Departures: ${formatShortDateRange(period.subsidized.outbound)}`,
    )
  }

  if (period.subsidized.inbound) {
    lines.push(`Returns: ${formatShortDateRange(period.subsidized.inbound)}`)
  }

  return lines
}
