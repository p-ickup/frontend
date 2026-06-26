/** @jest-environment node */

import {
  fetchChangeLogEntries,
  fetchGroupsManagementSnapshot,
} from '@/components/admin/groups-management/services/groupsReadService'

type QueryState = {
  table: string
  selectArgs: unknown[]
  operations: Array<{ method: string; args: unknown[] }>
}

const createSupabase = (
  resolver: (state: QueryState) => Promise<any> | any,
) => ({
  from: jest.fn((table: string) => {
    const state: QueryState = { table, selectArgs: [], operations: [] }
    const builder: any = {
      select: (...args: unknown[]) => {
        state.selectArgs = args
        return builder
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve(resolver(state)).then(resolve, reject),
    }

    for (const method of ['gte', 'lte', 'order', 'range', 'in']) {
      builder[method] = (...args: unknown[]) => {
        state.operations.push({ method, args })
        return builder
      }
    }

    return builder
  }),
})

const hasOperation = (
  state: QueryState,
  method: string,
  expectedArgs: unknown[],
) =>
  state.operations.some(
    (operation) =>
      operation.method === method &&
      JSON.stringify(operation.args) === JSON.stringify(expectedArgs),
  )

describe('fetchGroupsManagementSnapshot', () => {
  it('applies the date window and page before hydrating complete groups', async () => {
    const queries: QueryState[] = []
    let matchesRead = 0
    let flightsRead = 0
    const supabase = createSupabase((state) => {
      queries.push(state)

      if (state.table === 'Flights') {
        flightsRead += 1
        if (flightsRead === 1) {
          return {
            data: [
              {
                flight_id: 101,
                user_id: 'student-1',
                airport: 'LAX',
                date: '2026-06-20',
                earliest_time: '08:00:00',
                latest_time: '09:00:00',
                to_airport: true,
                bag_no: 1,
                bag_no_large: 0,
                matching_status: 'matched',
              },
              {
                flight_id: 201,
                user_id: 'student-3',
                airport: 'ONT',
                date: '2026-06-21',
                earliest_time: '10:00:00',
                latest_time: '11:00:00',
                to_airport: false,
                bag_no: 0,
                bag_no_large: 1,
                matching_status: 'unmatched',
              },
            ],
            count: 450,
            error: null,
          }
        }

        return {
          data: [
            {
              flight_id: 102,
              user_id: 'student-2',
              airport: 'LAX',
              date: '2026-06-20',
              earliest_time: '08:15:00',
              latest_time: '09:15:00',
              to_airport: true,
              bag_no: 0,
              bag_no_large: 1,
              matching_status: 'matched',
            },
          ],
          error: null,
        }
      }

      if (state.table === 'Matches') {
        matchesRead += 1
        return matchesRead === 1
          ? { data: [{ ride_id: 77, flight_id: 101 }], error: null }
          : {
              data: [
                {
                  ride_id: 77,
                  flight_id: 101,
                  user_id: 'student-1',
                  date: '2026-06-20',
                  time: '08:30:00',
                  reported_missing_user_ids: null,
                  ready_for_pickup_at: null,
                },
                {
                  ride_id: 77,
                  flight_id: 102,
                  user_id: 'student-2',
                  date: '2026-06-20',
                  time: '08:30:00',
                  reported_missing_user_ids: null,
                  ready_for_pickup_at: null,
                },
              ],
              error: null,
            }
      }

      if (state.table === 'Users') {
        return {
          data: [
            {
              user_id: 'student-1',
              firstname: 'Taylor',
              lastname: 'One',
              phonenumber: '1',
              school: 'Pomona',
              sms_opt_in: false,
            },
            {
              user_id: 'student-2',
              firstname: 'Jordan',
              lastname: 'Two',
              phonenumber: '2',
              school: 'Pomona',
              sms_opt_in: true,
            },
            {
              user_id: 'student-3',
              firstname: 'Casey',
              lastname: 'Three',
              phonenumber: '3',
              school: 'Pomona',
              sms_opt_in: null,
            },
          ],
          error: null,
        }
      }

      return { data: [], error: null }
    })

    const result = await fetchGroupsManagementSnapshot({
      supabase,
      adminScope: 'Pomona',
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
      page: 2,
      pageSize: 200,
    })

    const initialFlightsQuery = queries[0]
    expect(
      hasOperation(initialFlightsQuery, 'gte', ['date', '2026-06-01']),
    ).toBe(true)
    expect(
      hasOperation(initialFlightsQuery, 'lte', ['date', '2026-06-30']),
    ).toBe(true)
    expect(hasOperation(initialFlightsQuery, 'range', [200, 399])).toBe(true)
    expect(initialFlightsQuery.selectArgs[1]).toEqual({ count: 'exact' })
    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 200,
      totalRecords: 450,
      totalPages: 3,
    })
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0].riders.map((rider) => rider.flight_id)).toEqual([
      101, 102,
    ])
    expect(result.groups[0].riders[0]).toEqual(
      expect.objectContaining({ flight_id: 101, sms_opt_in: false }),
    )
    expect(result.groups[0].riders[1]).toEqual(
      expect.objectContaining({ flight_id: 102, sms_opt_in: true }),
    )
    expect(result.unmatchedRiders).toEqual([
      expect.objectContaining({
        flight_id: 201,
        name: 'Casey Three',
        sms_opt_in: null,
      }),
    ])
  })

  it('starts user batches concurrently', async () => {
    let usersStarted = 0
    let releaseFirstBatch!: () => void
    const firstBatch = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve
    })
    const flights = Array.from({ length: 200 }, (_, index) => ({
      flight_id: index + 1,
      user_id: `student-${index + 1}`,
      airport: 'LAX',
      date: '2026-06-20',
      earliest_time: '08:00:00',
      latest_time: '09:00:00',
      to_airport: true,
      matching_status: 'unmatched',
    }))
    const supabase = createSupabase(async (state) => {
      if (state.table === 'Flights') {
        return { data: flights, count: 200, error: null }
      }
      if (state.table === 'Matches') return { data: [], error: null }
      if (state.table === 'Users') {
        usersStarted += 1
        if (usersStarted === 1) await firstBatch
        return { data: [], error: null }
      }
      return { data: [], error: null }
    })

    const snapshotPromise = fetchGroupsManagementSnapshot({
      supabase,
      adminScope: null,
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
    })

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(usersStarted).toBe(2)
    releaseFirstBatch()
    await snapshotPromise
  })

  it('renders a group only on the page containing its in-window anchor flight', async () => {
    let matchesRead = 0
    let flightsRead = 0
    const supabase = createSupabase((state) => {
      if (state.table === 'Flights') {
        flightsRead += 1
        if (flightsRead === 1) {
          return {
            data: [
              {
                flight_id: 102,
                user_id: 'student-2',
                airport: 'LAX',
                date: '2026-06-20',
                earliest_time: '08:15:00',
                latest_time: '09:15:00',
                to_airport: true,
                matching_status: 'matched',
              },
            ],
            count: 2,
            error: null,
          }
        }

        return {
          data: [
            {
              flight_id: 101,
              user_id: 'student-1',
              airport: 'LAX',
              date: '2026-06-20',
              earliest_time: '08:00:00',
              latest_time: '09:00:00',
              to_airport: true,
              matching_status: 'matched',
            },
          ],
          error: null,
        }
      }

      if (state.table === 'Matches') {
        matchesRead += 1
        return matchesRead === 1
          ? { data: [{ ride_id: 77, flight_id: 102 }], error: null }
          : {
              data: [
                { ride_id: 77, flight_id: 101, user_id: 'student-1' },
                { ride_id: 77, flight_id: 102, user_id: 'student-2' },
              ],
              error: null,
            }
      }

      if (state.table === 'Users') {
        return {
          data: [
            { user_id: 'student-1', school: 'Pomona' },
            { user_id: 'student-2', school: 'Pomona' },
          ],
          error: null,
        }
      }

      return { data: [], error: null }
    })

    const result = await fetchGroupsManagementSnapshot({
      supabase,
      adminScope: 'Pomona',
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
      page: 2,
      pageSize: 1,
    })

    expect(result.groups).toEqual([])
    expect(result.unmatchedRiders).toEqual([])
  })

  it('enforces admin scope on unmatched riders and redacts other-school group members', async () => {
    let matchesRead = 0
    const supabase = createSupabase((state) => {
      if (state.table === 'Flights') {
        return {
          data: [
            {
              flight_id: 1,
              user_id: 'pomona-user',
              airport: 'LAX',
              date: '2026-06-20',
              earliest_time: '08:00:00',
              latest_time: '09:00:00',
              to_airport: true,
              matching_status: 'matched',
            },
            {
              flight_id: 2,
              user_id: 'other-user',
              airport: 'LAX',
              date: '2026-06-20',
              earliest_time: '08:00:00',
              latest_time: '09:00:00',
              to_airport: true,
              matching_status: 'matched',
            },
            {
              flight_id: 3,
              user_id: 'other-unmatched',
              airport: 'ONT',
              date: '2026-06-21',
              earliest_time: '10:00:00',
              latest_time: '11:00:00',
              to_airport: false,
              matching_status: 'unmatched',
            },
          ],
          count: 3,
          error: null,
        }
      }
      if (state.table === 'Matches') {
        matchesRead += 1
        return matchesRead === 1
          ? {
              data: [
                { ride_id: 10, flight_id: 1 },
                { ride_id: 10, flight_id: 2 },
              ],
              error: null,
            }
          : {
              data: [
                { ride_id: 10, flight_id: 1, user_id: 'pomona-user' },
                { ride_id: 10, flight_id: 2, user_id: 'other-user' },
              ],
              error: null,
            }
      }
      if (state.table === 'Users') {
        return {
          data: [
            {
              user_id: 'pomona-user',
              firstname: 'Visible',
              lastname: 'Rider',
              school: 'Pomona',
            },
            {
              user_id: 'other-user',
              firstname: 'Hidden',
              lastname: 'Rider',
              school: 'Scripps',
            },
            {
              user_id: 'other-unmatched',
              firstname: 'Filtered',
              lastname: 'Rider',
              school: 'Scripps',
            },
          ],
          error: null,
        }
      }
      return { data: [], error: null }
    })

    const result = await fetchGroupsManagementSnapshot({
      supabase,
      adminScope: 'Pomona',
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
    })

    expect(result.groups[0].riders).toEqual([
      expect.objectContaining({ name: 'Visible Rider' }),
      expect.objectContaining({ name: '[Hidden]', phone: '[Hidden]' }),
    ])
    expect(result.unmatchedRiders).toEqual([])
  })

  it('keeps a representative 200-rider snapshot bounded', async () => {
    const queries: QueryState[] = []
    const flights = Array.from({ length: 200 }, (_, index) => ({
      flight_id: index + 1,
      user_id: `student-${index + 1}`,
      airport: index % 2 === 0 ? 'LAX' : 'ONT',
      date: '2026-06-20',
      earliest_time: '08:00:00',
      latest_time: '09:00:00',
      to_airport: index % 2 === 0,
      bag_no: 1,
      bag_no_large: 1,
      bag_no_personal: 0,
      matching_status: 'matched',
      flight_no: 100 + index,
      airline_iata: 'AA',
      opt_in: true,
      original_unmatched: false,
    }))
    const users = flights.map((flight, index) => ({
      user_id: flight.user_id,
      firstname: `Student${index + 1}`,
      lastname: 'Example',
      phonenumber: '5551234567',
      school: 'Pomona',
    }))
    const matches = flights.map((flight, index) => ({
      ride_id: Math.floor(index / 4) + 1,
      flight_id: flight.flight_id,
      user_id: flight.user_id,
      voucher: 'VOUCHER',
      time: '08:30:00',
      date: flight.date,
      uber_type: 'XL',
      is_subsidized: true,
      subsidized_override: false,
      uber_type_override: false,
      reported_missing_user_ids: null,
      ready_for_pickup_at: null,
    }))
    let matchesRead = 0
    let selectedRows = 0
    const supabase = createSupabase((state) => {
      queries.push(state)
      let data: any[] = []
      if (state.table === 'Flights') data = flights
      if (state.table === 'Matches') {
        matchesRead += 1
        data =
          matchesRead === 1
            ? matches.map(({ ride_id, flight_id }) => ({ ride_id, flight_id }))
            : matches
      }
      if (state.table === 'Users') {
        const userIds =
          (state.operations.find((operation) => operation.method === 'in')
            ?.args[1] as string[]) || []
        data = users.filter((user) => userIds.includes(user.user_id))
      }
      selectedRows += data.length
      return {
        data,
        count: state.table === 'Flights' ? 200 : undefined,
        error: null,
      }
    })

    const result = await fetchGroupsManagementSnapshot({
      supabase,
      adminScope: 'Pomona',
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
    })

    expect(queries).toHaveLength(5)
    expect(selectedRows).toBe(800)
    expect(result.groups).toHaveLength(50)
    expect(result.groups.flatMap((group) => group.riders)).toHaveLength(200)
    expect(Buffer.byteLength(JSON.stringify(result))).toBeLessThan(80 * 1024)
  })
})

describe('fetchChangeLogEntries', () => {
  it('loads one bounded page and reports whether another page exists', async () => {
    const queries: QueryState[] = []
    const rows = Array.from({ length: 101 }, (_, index) => ({
      id: `change-${index}`,
      actor_user_id: 'admin-1',
      actor_role: 'admin',
      action: 'UPDATE_GROUP_TIME',
      ignored_error: false,
      created_at: `2026-06-13T12:${String(index % 60).padStart(2, '0')}:00Z`,
    }))
    const supabase = createSupabase((state) => {
      queries.push(state)
      if (state.table === 'ChangeLog') return { data: rows, error: null }
      if (state.table === 'Users') {
        return {
          data: [
            {
              user_id: 'admin-1',
              firstname: 'Admin',
              lastname: 'User',
            },
          ],
          error: null,
        }
      }
      return { data: [], error: null }
    })

    const result = await fetchChangeLogEntries(supabase, {
      page: 2,
      pageSize: 100,
    })

    expect(hasOperation(queries[0], 'range', [100, 200])).toBe(true)
    expect(result.entries).toHaveLength(100)
    expect(result.hasMore).toBe(true)
    expect(result.entries[0].actor_name).toBe('Admin User')
  })
})
