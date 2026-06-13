/** @jest-environment node */

import { getAdminDashboardSummary } from '@/lib/server/adminDashboard'

const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

const createQuery = (result: Promise<any> | any) => {
  const promise = Promise.resolve(result)
  const selectFields: unknown[][] = []
  const builder: any = {}

  for (const method of [
    'in',
    'not',
    'order',
    'limit',
    'eq',
    'gte',
    'lte',
    'lt',
  ]) {
    builder[method] = jest.fn(() => builder)
  }
  builder.select = jest.fn((...args: unknown[]) => {
    selectFields.push(args)
    return builder
  })
  builder.maybeSingle = jest.fn(() => promise)
  builder.then = (onFulfilled: any, onRejected: any) =>
    promise.then(onFulfilled, onRejected)

  return { builder, selectFields }
}

describe('getAdminDashboardSummary', () => {
  it('starts independent reads together and returns only displayed values', async () => {
    const lastRunDeferred = deferred<any>()
    const lastRun = createQuery(lastRunDeferred.promise)
    const schedule = createQuery({
      data: {
        scheduled_for: '2026-01-20T18:30:00Z',
        target: 'All',
        internal: 'hidden',
      },
      error: null,
    })
    const unmatched = createQuery({ data: null, count: 3, error: null })
    const flights = createQuery({
      data: [
        {
          flight_id: 101,
          user_id: 'student-1',
          Users: { school: 'Pomona' },
        },
        {
          flight_id: 102,
          user_id: 'student-2',
          Users: [{ school: 'Pomona' }],
        },
        {
          flight_id: 103,
          user_id: 'student-3',
          Users: { school: 'Other' },
        },
      ],
      error: null,
    })
    const matches = createQuery({
      data: [{ flight_id: 101, internal: 'hidden' }],
      error: null,
    })
    const from = jest
      .fn()
      .mockReturnValueOnce(lastRun.builder)
      .mockReturnValueOnce(schedule.builder)
      .mockReturnValueOnce(unmatched.builder)
      .mockReturnValueOnce(flights.builder)
      .mockReturnValueOnce(matches.builder)

    const summaryPromise = getAdminDashboardSummary({
      supabase: { from },
      profile: { school: 'Pomona', admin_scope: 'Pomona' },
      unmatchedStartDate: '2026-01-01',
      unmatchedEndDate: '2026-02-01',
    })

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'AlgorithmStatus',
      'AlgorithmStatus',
      'Flights',
    ])

    lastRunDeferred.resolve({
      data: {
        finished_at: '2026-01-15T18:00:00Z',
        status: 'success',
        target: 'ASPC',
      },
      error: null,
    })

    await expect(summaryPromise).resolves.toEqual({
      school: 'Pomona',
      matchRate: 50,
      matchedRiders: 1,
      totalRiders: 2,
      unmatchedFlightsCount: 3,
      algorithmLastRan: 'Jan 15, 2026 – 10:00 AM PT',
      lastRunStatus: 'Completed (ASPC)',
      nextScheduledRunDate: 'Jan 20, 2026 – 10:30 AM PT',
      nextScheduledRunTarget: 'All',
    })

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      'AlgorithmStatus',
      'AlgorithmStatus',
      'Flights',
      'Flights',
      'Matches',
    ])
    expect(
      [lastRun, schedule, unmatched, flights, matches]
        .flatMap((query) => query.selectFields)
        .every(([fields]) => !String(fields).includes('*')),
    ).toBe(true)
    expect(matches.selectFields).toEqual([['flight_id']])
  })

  it('skips match-rate row reads when no completed run exists', async () => {
    const lastRun = createQuery({ data: null, error: null })
    const schedule = createQuery({ data: null, error: null })
    const unmatched = createQuery({ data: null, count: 0, error: null })
    const from = jest
      .fn()
      .mockReturnValueOnce(lastRun.builder)
      .mockReturnValueOnce(schedule.builder)
      .mockReturnValueOnce(unmatched.builder)

    await expect(
      getAdminDashboardSummary({
        supabase: { from },
        profile: { school: 'Pomona', admin_scope: 'Pomona' },
        unmatchedStartDate: '2026-01-01',
        unmatchedEndDate: '2026-02-01',
      }),
    ).resolves.toMatchObject({
      matchRate: 0,
      matchedRiders: 0,
      totalRiders: 0,
      unmatchedFlightsCount: 0,
      algorithmLastRan: 'Never',
      nextScheduledRunDate: 'N/A',
    })

    expect(from).toHaveBeenCalledTimes(3)
  })
})
