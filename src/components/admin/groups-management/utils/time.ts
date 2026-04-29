import type { Group, Rider } from '../types'

export const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + (minutes || 0)
}

export const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins
    .toString()
    .padStart(2, '0')}`
}

export const roundToNearest5Minutes = (timeStr: string): string => {
  if (!timeStr) return '00:00'

  const timeOnly = timeStr.split(':').slice(0, 2).join(':')
  const minutes = timeToMinutes(timeOnly)
  const roundedMinutes = Math.round(minutes / 5) * 5
  const wrappedMinutes = roundedMinutes % (24 * 60)

  return minutesToTime(wrappedMinutes)
}

export const formatTime = (timeStr: string): string => {
  const [hours, minutes] = timeStr.split(':').map(Number)
  const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
  const ampm = hours < 12 ? 'AM' : 'PM'
  const minStr = minutes ? `:${minutes.toString().padStart(2, '0')}` : ''
  return `${hour12}${minStr} ${ampm}`
}

export const formatTimeRange = (timeRange: string): string => {
  const [startTime, endTime] = timeRange.split(' - ').map((time) => time.trim())
  if (!startTime || !endTime) return timeRange

  return `${formatTime(startTime)} - ${formatTime(endTime)} PT`
}

export const calculateTimeMidpoint = (timeRange: string): string => {
  const [startTime, endTime] = timeRange.split(' - ').map((time) => time.trim())
  if (!startTime || !endTime) return startTime || '00:00'

  const startMinutes = timeToMinutes(startTime)
  let endMinutes = timeToMinutes(endTime)

  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60
  }

  const midpointMinutes = Math.floor((startMinutes + endMinutes) / 2)
  const actualMidpoint = midpointMinutes % (24 * 60)

  return roundToNearest5Minutes(minutesToTime(actualMidpoint))
}

export const calculateGroupTimeRange = (
  riders: Array<Pick<Rider, 'time_range'>>,
): string => {
  if (riders.length === 0) return ''
  if (riders.length === 1) return riders[0].time_range

  let latestStart = ''
  let earliestEnd = ''

  for (const rider of riders) {
    const [startTime, endTime] = rider.time_range
      .split(' - ')
      .map((time) => time.trim())

    if (!startTime || !endTime) continue

    const startMinutes = timeToMinutes(startTime)
    const endMinutes = timeToMinutes(endTime)

    if (!latestStart || startMinutes > timeToMinutes(latestStart)) {
      latestStart = startTime
    }

    if (!earliestEnd || endMinutes < timeToMinutes(earliestEnd)) {
      earliestEnd = endTime
    }
  }

  if (!latestStart || !earliestEnd) {
    return riders[0]?.time_range || ''
  }

  const latestStartMinutes = timeToMinutes(latestStart)
  const earliestEndMinutes = timeToMinutes(earliestEnd)

  const hasCrossMidnight = riders.some((rider) => {
    const [start, end] = rider.time_range
      .split(' - ')
      .map((time) => time.trim())
    if (!start || !end) return false
    return timeToMinutes(end) < timeToMinutes(start)
  })

  if (latestStartMinutes > earliestEndMinutes) {
    if (hasCrossMidnight) {
      return `${latestStart} - ${earliestEnd}`
    }

    return riders[0]?.time_range || ''
  }

  return `${latestStart} - ${earliestEnd}`
}

export const validateTimeCompatibility = (
  group: Pick<Group, 'date' | 'riders'>,
  rider: Pick<Rider, 'date' | 'time_range'>,
): boolean => {
  const calculatedGroupTimeRange = calculateGroupTimeRange(group.riders)
  const groupTimes = calculatedGroupTimeRange
    .split(' - ')
    .map((time) => time.trim())
  const riderTimes = rider.time_range.split(' - ').map((time) => time.trim())

  if (groupTimes.length !== 2 || riderTimes.length !== 2) {
    return false
  }

  if (group.date !== rider.date) {
    return false
  }

  const [groupStart, groupEnd] = groupTimes
  const [riderStart, riderEnd] = riderTimes

  return riderStart <= groupEnd && riderEnd >= groupStart
}

export const matchDatetimeFromEarliest = (
  riders: Array<Pick<Rider, 'date' | 'time_range'>>,
): { date: string; time: string } | null => {
  if (riders.length === 0) return null

  let latestStart = ''
  let earliestEnd = ''
  let groupDate = ''

  for (const rider of riders) {
    const [startTime, endTime] = rider.time_range
      .split(' - ')
      .map((time) => time.trim())
    if (!startTime || !endTime) continue

    if (!latestStart || startTime > latestStart) {
      latestStart = startTime
      groupDate = rider.date
    }
    if (!earliestEnd || endTime < earliestEnd) {
      earliestEnd = endTime
    }
  }

  if (!latestStart || !earliestEnd || latestStart > earliestEnd) {
    return null
  }

  return {
    date: groupDate,
    time: latestStart,
  }
}
