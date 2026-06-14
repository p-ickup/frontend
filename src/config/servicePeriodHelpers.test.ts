/** @jest-environment node */

import {
  COVERED_DATES_INBOUND,
  COVERED_DATES_OUTBOUND,
} from '@/config/subsidyConfig'
import { SERVICE_PERIODS, type ServicePeriod } from '@/config/servicePeriods'
import {
  expandDateRangeToMMDD,
  formatDeadlineForDisplay,
  formatSubsidizedWindowsForDisplay,
  getAllowedDirectionsForDate,
  getAllowedDirectionsForPeriodAndDate,
  getBufferedPeriods,
  getDerivedCoveredDates,
  getPeriodForBufferedDate,
  getServicePeriods,
  isDateCovered,
  isDateInRange,
  isDirectionAllowedForDate,
  isFlightPastDeadline,
  isInSubsidizedWindow,
} from '@/config/servicePeriodHelpers'

const springPeriod = SERVICE_PERIODS.find(
  (period) => period.id === 'spring-2026',
)!
const summerPeriod = SERVICE_PERIODS.find(
  (period) => period.id === 'summer-2026',
)!
const winterOutboundPeriod = SERVICE_PERIODS.find(
  (period) => period.id === 'winter-2025-outbound',
)!
const winterReturnPeriod = SERVICE_PERIODS.find(
  (period) => period.id === 'winter-2026-return',
)!

const overlapFixturePeriod: ServicePeriod = {
  id: 'overlap-fixture',
  name: 'Overlap Fixture',
  allowedDirections: ['outbound', 'inbound'],
  subsidized: {
    outbound: { start: '2026-04-10', end: '2026-04-12' },
    inbound: { start: '2026-04-11', end: '2026-04-14' },
  },
  buffered: { start: '2026-04-08', end: '2026-04-16' },
  deadline: '2026-04-08T23:59:59-07:00',
}

describe('getServicePeriods', () => {
  it('exposes all canonical breaks including split winter rows', () => {
    expect(getServicePeriods().map((period) => period.id)).toEqual([
      'thanksgiving-2025',
      'winter-2025-outbound',
      'winter-2026-return',
      'spring-2026',
      'summer-2026',
    ])
  })
})

describe('getBufferedPeriods', () => {
  it('mirrors buffered windows and deadlines from servicePeriods', () => {
    expect(getBufferedPeriods()).toEqual([
      {
        start: '2025-11-16',
        end: '2025-12-01',
        deadline: '2025-11-14T23:59:59-08:00',
        name: 'Thanksgiving Break',
      },
      {
        start: '2025-12-02',
        end: '2025-12-18',
        deadline: '2025-12-03T23:59:59-08:00',
        name: 'Winter Break (Outbound)',
      },
      {
        start: '2026-01-12',
        end: '2026-01-26',
        deadline: '2026-01-09T23:59:59-08:00',
        name: 'Winter Break (Return)',
      },
      {
        start: '2026-03-08',
        end: '2026-03-26',
        deadline: '2026-03-06T23:59:59-08:00',
        name: 'Spring Break',
      },
      {
        start: '2026-05-07',
        end: '2026-05-21',
        deadline: '2026-05-06T23:59:59-07:00',
        name: 'Summer Break',
      },
    ])
  })
})

describe('isDateInRange', () => {
  it('treats range boundaries as inclusive', () => {
    expect(isDateInRange('2026-03-13', springPeriod.subsidized.outbound)).toBe(
      true,
    )
    expect(isDateInRange('2026-03-15', springPeriod.subsidized.outbound)).toBe(
      true,
    )
    expect(isDateInRange('2026-03-12', springPeriod.subsidized.outbound)).toBe(
      false,
    )
  })

  it('returns false for missing date or range', () => {
    expect(isDateInRange('', springPeriod.subsidized.outbound)).toBe(false)
    expect(isDateInRange('2026-03-14', undefined)).toBe(false)
  })
})

describe('expandDateRangeToMMDD', () => {
  it('expands contiguous ranges with zero-padded MM-DD values', () => {
    expect(
      expandDateRangeToMMDD({ start: '2026-05-12', end: '2026-05-14' }),
    ).toEqual(['05-12', '05-13', '05-14'])
  })
})

describe('getDerivedCoveredDates', () => {
  it('derives outbound and inbound lists from subsidized ranges', () => {
    const { outbound, inbound } = getDerivedCoveredDates()

    expect(outbound).toContain('11-25')
    expect(outbound).toContain('12-10')
    expect(outbound).toContain('03-14')
    expect(outbound).toContain('05-12')
    expect(outbound).toContain('05-19')

    expect(inbound).toContain('11-30')
    expect(inbound).toContain('01-18')
    expect(inbound).toContain('03-21')
  })

  it('normalizes summer dates to zero-padded MM-DD (fixes legacy 5/12 style)', () => {
    const { outbound } = getDerivedCoveredDates()

    for (const legacyDate of COVERED_DATES_OUTBOUND) {
      const normalized = legacyDate.includes('/')
        ? legacyDate.replace('/', '-').replace(/^(\d)-/, '0$1-')
        : legacyDate

      if (normalized.startsWith('05-')) {
        expect(outbound).toContain(
          normalized.length === 4 ? `0${normalized}` : normalized,
        )
      }
    }

    expect(outbound).toContain('05-12')
    expect(outbound).not.toContain('5/12')
  })

  it('matches legacy subsidyConfig lists after normalization', () => {
    const { outbound, inbound } = getDerivedCoveredDates()
    const normalize = (value: string) =>
      value.includes('/')
        ? value
            .split('/')
            .map((part, index) => (index === 0 ? part.padStart(2, '0') : part))
            .join('-')
        : value

    for (const date of COVERED_DATES_OUTBOUND) {
      expect(outbound).toContain(normalize(date))
    }

    for (const date of COVERED_DATES_INBOUND) {
      if (date === '06-30') {
        continue
      }
      expect(inbound).toContain(date)
    }
  })
})

describe('isDateCovered / isInSubsidizedWindow', () => {
  it.each([
    ['2025-11-25', true, true],
    ['2025-11-25', false, false],
    ['2025-11-30', true, false],
    ['2025-11-30', false, true],
    ['2025-12-10', true, true],
    ['2025-12-10', false, false],
    ['2026-01-18', true, false],
    ['2026-01-18', false, true],
    ['2026-03-14', true, true],
    ['2026-03-14', false, false],
    ['2026-03-21', true, false],
    ['2026-03-21', false, true],
    ['2026-05-15', true, true],
    ['2026-05-15', false, false],
    ['2026-06-15', true, false],
    ['2026-06-15', false, false],
  ])('date %s toAirport=%s covered=%s', (date, toAirport, expected) => {
    expect(isDateCovered(date, toAirport)).toBe(expected)
    expect(isInSubsidizedWindow(date, toAirport)).toBe(expected)
  })
})

describe('getPeriodForBufferedDate', () => {
  it('maps dates to the buffered period that contains them', () => {
    expect(getPeriodForBufferedDate('2025-11-25')?.id).toBe('thanksgiving-2025')
    expect(getPeriodForBufferedDate('2025-12-10')?.id).toBe(
      'winter-2025-outbound',
    )
    expect(getPeriodForBufferedDate('2026-01-18')?.id).toBe(
      'winter-2026-return',
    )
    expect(getPeriodForBufferedDate('2026-03-14')?.id).toBe('spring-2026')
    expect(getPeriodForBufferedDate('2026-05-15')?.id).toBe('summer-2026')
  })

  it('returns undefined for dates outside all buffered windows', () => {
    expect(getPeriodForBufferedDate('2026-02-01')).toBeUndefined()
    expect(getPeriodForBufferedDate('')).toBeUndefined()
  })

  it('leaves the long winter gap outside all buffered windows', () => {
    expect(getPeriodForBufferedDate('2025-12-20')).toBeUndefined()
    expect(getPeriodForBufferedDate('2026-01-05')).toBeUndefined()
  })
})

describe('getAllowedDirectionsForPeriodAndDate', () => {
  it('enables outbound only on spring departure days', () => {
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-03-14', springPeriod),
    ).toEqual(['outbound'])
  })

  it('enables inbound only on spring return days', () => {
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-03-21', springPeriod),
    ).toEqual(['inbound'])
  })

  it('returns no directions in spring gap days inside buffered window', () => {
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-03-18', springPeriod),
    ).toEqual([])
  })

  it('supports overlapping outbound and inbound ranges', () => {
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-04-10', overlapFixturePeriod),
    ).toEqual(['outbound'])
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-04-11', overlapFixturePeriod),
    ).toEqual(['outbound', 'inbound'])
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-04-14', overlapFixturePeriod),
    ).toEqual(['inbound'])
  })

  it('respects single-direction winter rows', () => {
    expect(
      getAllowedDirectionsForPeriodAndDate('2025-12-10', winterOutboundPeriod),
    ).toEqual(['outbound'])
    expect(
      getAllowedDirectionsForPeriodAndDate('2025-12-10', winterReturnPeriod),
    ).toEqual([])
    expect(
      getAllowedDirectionsForPeriodAndDate('2026-01-18', winterReturnPeriod),
    ).toEqual(['inbound'])
  })
})

describe('getAllowedDirectionsForDate', () => {
  it.each([
    ['2026-03-14', ['outbound']],
    ['2026-03-21', ['inbound']],
    ['2026-03-18', []],
    ['2026-05-15', ['outbound']],
    ['2025-11-25', ['outbound']],
    ['2025-11-30', ['inbound']],
    ['2025-12-10', ['outbound']],
    ['2026-01-18', ['inbound']],
  ])('date %s allows %j', (date, expected) => {
    expect(getAllowedDirectionsForDate(date)).toEqual(expected)
  })
})

describe('isDirectionAllowedForDate', () => {
  it('maps to_airport boolean to outbound/inbound policy', () => {
    expect(isDirectionAllowedForDate('2026-05-15', true)).toBe(true)
    expect(isDirectionAllowedForDate('2026-05-15', false)).toBe(false)
    expect(isDirectionAllowedForDate('2026-03-21', false)).toBe(true)
    expect(isDirectionAllowedForDate('2026-03-21', true)).toBe(false)
    expect(isDirectionAllowedForDate('2026-03-18', true)).toBe(false)
    expect(isDirectionAllowedForDate('2026-03-18', false)).toBe(false)
  })
})

describe('isFlightPastDeadline', () => {
  it('returns not past before the spring deadline', () => {
    const result = isFlightPastDeadline(
      '2026-03-14',
      new Date('2026-03-05T12:00:00-08:00'),
    )

    expect(result).toEqual({
      isPastDeadline: false,
      periodName: 'Spring Break',
      deadline: new Date('2026-03-06T23:59:59-08:00'),
    })
  })

  it('returns past after the spring deadline', () => {
    const result = isFlightPastDeadline(
      '2026-03-14',
      new Date('2026-03-07T12:00:00-08:00'),
    )

    expect(result.isPastDeadline).toBe(true)
    expect(result.periodName).toBe('Spring Break')
  })

  it('applies winter outbound and return deadlines independently', () => {
    const beforeWinterOutboundDeadline = isFlightPastDeadline(
      '2025-12-10',
      new Date('2025-12-03T12:00:00-08:00'),
    )
    const afterWinterOutboundDeadline = isFlightPastDeadline(
      '2025-12-10',
      new Date('2025-12-04T12:00:00-08:00'),
    )
    const beforeWinterReturnDeadline = isFlightPastDeadline(
      '2026-01-18',
      new Date('2026-01-08T12:00:00-08:00'),
    )
    const afterWinterReturnDeadline = isFlightPastDeadline(
      '2026-01-18',
      new Date('2026-01-10T12:00:00-08:00'),
    )

    expect(beforeWinterOutboundDeadline.isPastDeadline).toBe(false)
    expect(beforeWinterOutboundDeadline.periodName).toBe(
      'Winter Break (Outbound)',
    )
    expect(afterWinterOutboundDeadline.isPastDeadline).toBe(true)
    expect(beforeWinterReturnDeadline.isPastDeadline).toBe(false)
    expect(beforeWinterReturnDeadline.periodName).toBe('Winter Break (Return)')
    expect(afterWinterReturnDeadline.isPastDeadline).toBe(true)
  })

  it('uses the summer PDT deadline offset', () => {
    const beforeSummerDeadline = isFlightPastDeadline(
      '2026-05-15',
      new Date('2026-05-06T20:00:00-07:00'),
    )
    const afterSummerDeadline = isFlightPastDeadline(
      '2026-05-15',
      new Date('2026-05-07T08:00:00-07:00'),
    )

    expect(beforeSummerDeadline.isPastDeadline).toBe(false)
    expect(afterSummerDeadline.isPastDeadline).toBe(true)
    expect(afterSummerDeadline.periodName).toBe('Summer Break')
  })

  it('does not enforce deadlines for dates outside buffered windows', () => {
    expect(
      isFlightPastDeadline('2026-02-01', new Date('2026-02-01T12:00:00-08:00')),
    ).toEqual({ isPastDeadline: false })
    expect(isFlightPastDeadline('', new Date())).toEqual({
      isPastDeadline: false,
    })
  })

  it('treats the exact deadline instant as not past', () => {
    const atDeadline = isFlightPastDeadline(
      '2026-03-14',
      new Date('2026-03-06T23:59:59-08:00'),
    )

    expect(atDeadline.isPastDeadline).toBe(false)
  })
})

describe('formatDeadlineForDisplay', () => {
  it('formats summer deadline in PT', () => {
    expect(formatDeadlineForDisplay('2026-05-06T23:59:59-07:00')).toBe(
      'Wednesday, May 6, 2026 at 11:59 PM PT',
    )
  })

  it('formats winter deadline in PT', () => {
    expect(formatDeadlineForDisplay('2025-12-03T23:59:59-08:00')).toBe(
      'Wednesday, December 3, 2025 at 11:59 PM PT',
    )
  })
})

describe('formatSubsidizedWindowsForDisplay', () => {
  it('renders summer departures only', () => {
    expect(formatSubsidizedWindowsForDisplay(summerPeriod)).toEqual([
      'Departures: May 12-19',
    ])
  })

  it('renders spring departures and returns', () => {
    expect(formatSubsidizedWindowsForDisplay(springPeriod)).toEqual([
      'Departures: March 13-15',
      'Returns: March 20-22',
    ])
  })

  it('renders thanksgiving cross-month return range', () => {
    const thanksgiving = SERVICE_PERIODS.find(
      (period) => period.id === 'thanksgiving-2025',
    )!

    expect(formatSubsidizedWindowsForDisplay(thanksgiving)).toEqual([
      'Departures: November 21-26',
      'Returns: November 29-December 1',
    ])
  })
})
