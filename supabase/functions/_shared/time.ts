// Flight and ride dates/times in the database are Pacific wall-clock values, but the edge runtime
// runs in UTC, so `new Date('2026-10-21 08:00')` would be 7-8 hours off. Use these instead.

const TIME_ZONE = 'America/Los_Angeles'

function wallClockParts(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    utcMs: Date.UTC(
      Number(get('year')),
      Number(get('month')) - 1,
      Number(get('day')),
      Number(get('hour')),
      Number(get('minute')),
      Number(get('second')),
    ),
  }
}

/** Today's date (YYYY-MM-DD) in Pacific time. */
export function pacificToday(now = new Date()): string {
  return wallClockParts(now).date
}

/** The instant of a Pacific date (YYYY-MM-DD) and time (HH:MM[:SS]), DST-aware. */
export function pacificDateTime(date: string, time: string): Date {
  const [hour = '00', minute = '00', second = '00'] = time.split(':')
  const asUtc = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
    Number(hour),
    Number(minute),
    Number(second.slice(0, 2)),
  )
  const offsetAt = (ms: number) => wallClockParts(new Date(ms)).utcMs - ms
  // Second pass uses the offset at the result itself, which differs on DST change days
  const guess = asUtc - offsetAt(asUtc)
  return new Date(asUtc - offsetAt(guess))
}
