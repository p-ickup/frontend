/** @jest-environment node */

import { canEditFlight, isFlightPastDeadline } from '@/utils/flightValidation'

describe('isFlightPastDeadline (flightValidation parity)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('allows spring flights before the Mar 6 deadline', () => {
    jest.setSystemTime(new Date('2026-03-05T12:00:00-08:00'))

    expect(isFlightPastDeadline('2026-03-14')).toEqual({
      isPastDeadline: false,
      periodName: 'Spring Break',
      deadline: new Date('2026-03-06T23:59:59-08:00'),
    })
  })

  it('blocks spring flights after the Mar 6 deadline', () => {
    jest.setSystemTime(new Date('2026-03-07T12:00:00-08:00'))

    const result = isFlightPastDeadline('2026-03-14')

    expect(result.isPastDeadline).toBe(true)
    expect(result.periodName).toBe('Spring Break')
  })

  it('uses distinct winter outbound and return deadlines', () => {
    jest.setSystemTime(new Date('2025-12-04T12:00:00-08:00'))
    expect(isFlightPastDeadline('2025-12-10').isPastDeadline).toBe(true)

    jest.setSystemTime(new Date('2026-01-08T12:00:00-08:00'))
    expect(isFlightPastDeadline('2026-01-18').isPastDeadline).toBe(false)

    jest.setSystemTime(new Date('2026-01-10T12:00:00-08:00'))
    expect(isFlightPastDeadline('2026-01-18').isPastDeadline).toBe(true)
  })

  it('does not enforce deadlines outside buffered windows', () => {
    jest.setSystemTime(new Date('2026-06-01T12:00:00-07:00'))

    expect(isFlightPastDeadline('2026-02-01')).toEqual({
      isPastDeadline: false,
    })
    expect(isFlightPastDeadline('')).toEqual({ isPastDeadline: false })
  })
})

describe('canEditFlight (flightValidation parity)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('returns true before deadline and false after', () => {
    jest.setSystemTime(new Date('2026-05-05T12:00:00-07:00'))
    expect(canEditFlight('2026-05-15')).toBe(true)

    jest.setSystemTime(new Date('2026-05-07T08:00:00-07:00'))
    expect(canEditFlight('2026-05-15')).toBe(false)
  })

  it('returns true for dates outside service periods', () => {
    jest.setSystemTime(new Date('2026-06-01T12:00:00-07:00'))
    expect(canEditFlight('2026-02-01')).toBe(true)
  })
})
