import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const buildNoShowLookupMock = jest.fn()
const postJsonMock = jest.fn()
const pushMock = jest.fn()
const useAuthMock = jest.fn()
const createBrowserClientMock = jest.fn()

jest.mock('@/utils/api', () => ({
  postJson: (...args: unknown[]) => postJsonMock(...args),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

jest.mock('@/utils/adminMatchNoShows', () => ({
  buildNoShowLookup: (...args: unknown[]) => buildNoShowLookupMock(...args),
  parseNoShowKey: (key: string) => {
    const [rideId, missingId] = key.split(':')
    return rideId && missingId ? { rideId: Number(rideId), missingId } : null
  },
}))

jest.mock('@/utils/supabase', () => ({
  createBrowserClient: () => createBrowserClientMock(),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

import AdminDashboard from '@/components/admin/AdminDashboard'

type QueryState = {
  table: string
  selectArgs: unknown[]
  ops: Array<{
    type: string
    column?: string
    value?: unknown
    values?: unknown[]
  }>
}

const hasOp = (
  state: QueryState,
  type: string,
  column: string,
  expected?: unknown,
) =>
  state.ops.some(
    (op) =>
      op.type === type &&
      op.column === column &&
      (expected === undefined
        ? true
        : JSON.stringify(op.value ?? op.values) === JSON.stringify(expected)),
  )

const createSupabaseMock = (
  resolver: (state: QueryState & { terminal: string }) => any,
) => {
  const createBuilder = (table: string) => {
    const state: QueryState = {
      table,
      selectArgs: [],
      ops: [],
    }

    const builder: any = {
      select: (...args: unknown[]) => {
        state.selectArgs = args
        return builder
      },
      eq: (column: string, value: unknown) => {
        state.ops.push({ type: 'eq', column, value })
        return builder
      },
      in: (column: string, values: unknown[]) => {
        state.ops.push({ type: 'in', column, values })
        return builder
      },
      not: (column: string, value: unknown, extra: unknown) => {
        state.ops.push({ type: 'not', column, value: [value, extra] })
        return builder
      },
      order: (column: string, value: unknown) => {
        state.ops.push({ type: 'order', column, value })
        return builder
      },
      limit: (value: unknown) => {
        state.ops.push({ type: 'limit', value })
        return builder
      },
      gte: (column: string, value: unknown) => {
        state.ops.push({ type: 'gte', column, value })
        return builder
      },
      lte: (column: string, value: unknown) => {
        state.ops.push({ type: 'lte', column, value })
        return builder
      },
      is: (column: string, value: unknown) => {
        state.ops.push({ type: 'is', column, value })
        return builder
      },
      range: (from: number, to: number) => {
        state.ops.push({ type: 'range', value: [from, to] })
        return builder
      },
      maybeSingle: () =>
        Promise.resolve(resolver({ ...state, terminal: 'maybeSingle' })),
      single: () => Promise.resolve(resolver({ ...state, terminal: 'single' })),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(resolver({ ...state, terminal: 'then' })).then(
          onFulfilled,
          onRejected,
        ),
    }

    return builder
  }

  return {
    from: jest.fn((table: string) => createBuilder(table)),
  }
}

const dashboardUser = {
  id: 'admin-1',
  email: 'admin@example.com',
} as any

describe('AdminDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthMock.mockReturnValue({ user: null })
    buildNoShowLookupMock.mockResolvedValue(new Map())
    postJsonMock.mockResolvedValue({
      success: true,
      would_send: 2,
      preview: [{ to: 'student@example.com', subject: 'Your match' }],
    })
    jest.spyOn(window, 'alert').mockImplementation(() => {})
    jest.spyOn(window, 'confirm').mockImplementation(() => true)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  const renderDashboard = () => {
    const supabase = createSupabaseMock((state) => {
      if (state.table === 'Users' && hasOp(state, 'eq', 'user_id', 'admin-1')) {
        return {
          data: { school: 'Pomona', role: 'admin', admin_scope: 'Pomona' },
          error: null,
        }
      }

      if (
        state.table === 'AlgorithmStatus' &&
        hasOp(state, 'in', 'status', ['success', 'failed'])
      ) {
        return {
          data: {
            finished_at: '2026-01-15T18:00:00Z',
            status: 'success',
            target: 'ASPC',
            algorithm_name: 'matcher',
          },
          error: null,
        }
      }

      if (
        state.table === 'AlgorithmStatus' &&
        hasOp(state, 'eq', 'status', 'scheduled')
      ) {
        return {
          data: {
            scheduled_for: '2026-01-20T18:30:00Z',
            target: 'All',
          },
          error: null,
        }
      }

      if (
        state.table === 'Flights' &&
        (state.selectArgs[1] as any)?.head === true
      ) {
        return {
          data: null,
          count: 3,
          error: null,
        }
      }

      if (
        state.table === 'Flights' &&
        hasOp(state, 'gte', 'date') &&
        hasOp(state, 'lte', 'date')
      ) {
        return {
          data: [
            {
              flight_id: 101,
              user_id: 'student-1',
              date: '2026-01-16',
              matched: false,
              Users: { school: 'Pomona' },
            },
            {
              flight_id: 102,
              user_id: 'student-2',
              date: '2026-01-17',
              matched: false,
              Users: { school: 'Pomona' },
            },
            {
              flight_id: 103,
              user_id: 'student-3',
              date: '2026-01-18',
              matched: false,
              Users: { school: 'Pomona' },
            },
          ],
          error: null,
        }
      }

      if (state.table === 'Matches' && hasOp(state, 'in', 'flight_id')) {
        return {
          data: [
            { ride_id: 1, flight_id: 101, user_id: 'student-1' },
            { ride_id: 2, flight_id: 102, user_id: 'student-2' },
          ],
          error: null,
        }
      }

      if (
        state.table === 'Matches' &&
        state.ops.some(
          (op) =>
            op.type === 'range' &&
            JSON.stringify(op.value) === JSON.stringify([0, 999]),
        )
      ) {
        return {
          data: [
            {
              ride_id: 77,
              user_id: 'student-1',
              reported_missing_user_ids: ['student-2'],
              date: '2026-01-19',
              ready_for_pickup_at: '2026-01-19T12:00:00Z',
            },
            {
              ride_id: 77,
              user_id: 'student-2',
              reported_missing_user_ids: null,
              date: '2026-01-19',
              ready_for_pickup_at: null,
            },
          ],
          error: null,
        }
      }

      if (state.table === 'match_cancellations') {
        return {
          data: [
            {
              id: 1,
              ride_id: 77,
              user_id: 'student-1',
              flight_id: 101,
              cancelled_at: '2026-01-18T20:15:00Z',
              match_date: '2026-01-19',
              match_time: '12:30:00',
              airport: 'LAX',
              to_airport: true,
              is_subsidized: false,
              cancelled_after_deadline: true,
              cancelled_before_1hr: false,
              cancellation_type: 'student_initiated',
            },
          ],
          error: null,
        }
      }

      if (state.table === 'Users' && hasOp(state, 'in', 'user_id')) {
        return {
          data: [
            {
              user_id: 'student-1',
              firstname: 'Taylor',
              lastname: 'Student',
              email: 'taylor@example.com',
            },
            {
              user_id: 'student-2',
              firstname: 'Jordan',
              lastname: 'Student',
              email: 'jordan@example.com',
            },
          ],
          error: null,
        }
      }

      return { data: [], error: null }
    })

    createBrowserClientMock.mockReturnValue(supabase)

    return render(<AdminDashboard user={dashboardUser} />)
  }

  it('loads and renders the core dashboard metrics', async () => {
    renderDashboard()

    expect(await screen.findByText('Pickup Dashboard')).toBeInTheDocument()
    expect(await screen.findByText('Pomona')).toBeInTheDocument()
    expect(await screen.findByText('67%')).toBeInTheDocument()
    expect(await screen.findByText('2 / 3 riders matched')).toBeInTheDocument()
    expect(await screen.findByText('Completed (ASPC)')).toBeInTheDocument()
    expect(await screen.findByText('Scheduled (All)')).toBeInTheDocument()
  })

  it('navigates to groups management from the action button', async () => {
    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /View & Manage Groups/i }),
    )

    expect(pushMock).toHaveBeenCalledWith('/admin/groups')
  })

  it('runs the match email dry run through the server route', async () => {
    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /Preview Match Emails/i }),
    )

    await waitFor(() =>
      expect(postJsonMock).toHaveBeenCalledWith(
        '/api/admin/send-match-emails',
        expect.objectContaining({
          dry_run: true,
          date_start: expect.any(String),
        }),
      ),
    )
    expect(window.alert).toHaveBeenCalled()
    expect(
      await screen.findByText(/Preview: Would send 2 emails/i),
    ).toBeInTheDocument()
    expect(await screen.findByText(/student@example.com/i)).toBeInTheDocument()
  })

  it('sends match emails after confirmation and shows the result summary', async () => {
    postJsonMock.mockResolvedValueOnce({
      success: true,
      sent: 2,
      failed: 0,
      total: 2,
    })

    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /Send All Match Emails/i }),
    )

    await waitFor(() =>
      expect(postJsonMock).toHaveBeenCalledWith(
        '/api/admin/send-match-emails',
        expect.objectContaining({
          date_start: expect.any(String),
        }),
      ),
    )
    expect(window.confirm).toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Sent: 2'),
    )
    expect(await screen.findByText('2/2')).toBeInTheDocument()
  })

  it('blocks unmatched email preview until both dates are selected', async () => {
    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /Preview Unmatched \(Dry Run\)/i }),
    )

    expect(postJsonMock).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('Please select both start and end dates'),
    )
  })

  it('loads and renders no-show rows on demand', async () => {
    buildNoShowLookupMock.mockResolvedValueOnce(
      new Map([
        [
          '77:student-2',
          {
            reporterCount: 1,
            reporterUserIds: ['student-1'],
            reporterNames: ['Taylor Student'],
            flag: 'orange',
            submittedDelayForRide: true,
            hadNewFlightOnDelay: false,
            missingRiderSubmittedReady: false,
          },
        ],
      ]),
    )

    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /Load no-shows/i }),
    )

    expect(await screen.findByText('Jordan Student')).toBeInTheDocument()
    expect(await screen.findByText('Taylor Student')).toBeInTheDocument()
    expect(await screen.findByText('1/2')).toBeInTheDocument()
    expect(await screen.findByText('Delay form in log')).toBeInTheDocument()
    expect(await screen.findByText('Not yet')).toBeInTheDocument()
  })

  it('loads and renders cancellation rows on demand', async () => {
    renderDashboard()

    await screen.findByText('Pickup Dashboard')
    await userEvent.click(
      screen.getByRole('button', { name: /Load Cancellations/i }),
    )

    expect(await screen.findByText('Taylor Student')).toBeInTheDocument()
    expect(await screen.findByText('taylor@example.com')).toBeInTheDocument()

    expect(await screen.findByText('$40')).toBeInTheDocument()
  })
})
