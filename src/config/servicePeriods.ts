export type TripDirection = 'outbound' | 'inbound'

export interface DateRange {
  start: string
  end: string
}

export interface ServicePeriod {
  id: string
  name: string
  allowedDirections: TripDirection[]
  subsidized: {
    outbound?: DateRange
    inbound?: DateRange
  }
  buffered: DateRange
  deadline: string
}

/**
 * Canonical service-period config. Edit this file when break dates or deadlines change.
 */
export const SERVICE_PERIODS: ServicePeriod[] = [
  {
    id: 'thanksgiving-2025',
    name: 'Thanksgiving Break',
    allowedDirections: ['outbound', 'inbound'],
    subsidized: {
      outbound: { start: '2025-11-21', end: '2025-11-26' },
      inbound: { start: '2025-11-29', end: '2025-12-01' },
    },
    buffered: { start: '2025-11-16', end: '2025-12-01' },
    deadline: '2025-11-14T23:59:59-08:00',
  },
  {
    id: 'winter-2025-outbound',
    name: 'Winter Break (Outbound)',
    allowedDirections: ['outbound'],
    subsidized: {
      outbound: { start: '2025-12-09', end: '2025-12-13' },
    },
    buffered: { start: '2025-12-02', end: '2025-12-18' },
    deadline: '2025-12-03T23:59:59-08:00',
  },
  {
    id: 'winter-2026-return',
    name: 'Winter Break (Return)',
    allowedDirections: ['inbound'],
    subsidized: {
      inbound: { start: '2026-01-17', end: '2026-01-21' },
    },
    buffered: { start: '2026-01-12', end: '2026-01-26' },
    deadline: '2026-01-09T23:59:59-08:00',
  },
  {
    id: 'spring-2026',
    name: 'Spring Break',
    allowedDirections: ['outbound', 'inbound'],
    subsidized: {
      outbound: { start: '2026-03-13', end: '2026-03-15' },
      inbound: { start: '2026-03-20', end: '2026-03-22' },
    },
    buffered: { start: '2026-03-08', end: '2026-03-26' },
    deadline: '2026-03-06T23:59:59-08:00',
  },
  {
    id: 'summer-2026',
    name: 'Summer Break',
    allowedDirections: ['outbound'],
    subsidized: {
      outbound: { start: '2026-05-12', end: '2026-05-19' },
    },
    buffered: { start: '2026-05-07', end: '2026-05-21' },
    deadline: '2026-05-06T23:59:59-07:00',
  },
]
