import { render, screen, waitFor } from '@testing-library/react'

const requestJsonMock = jest.fn()
const postJsonMock = jest.fn()
const authenticatedUser = { id: 'user-1' }

jest.mock('@/utils/api', () => ({
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
  postJson: (...args: unknown[]) => postJsonMock(...args),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: authenticatedUser,
    isAuthenticated: true,
  }),
}))

jest.mock(
  '@/components/results/MatchCard',
  () =>
    function MockMatchCard({
      rideId,
      isGroupReady,
    }: {
      rideId: number
      isGroupReady: boolean
    }) {
      return (
        <div data-testid={`match-${rideId}`}>
          match {rideId} ready {String(isGroupReady)}
        </div>
      )
    },
)

jest.mock(
  '@/components/results/CommentSection',
  () =>
    function MockCommentSection() {
      return <div>comments</div>
    },
)

jest.mock(
  '@/components/results/EmptyState',
  () =>
    function MockEmptyState() {
      return <div>empty</div>
    },
)

jest.mock(
  '@/components/buttons/RedirectButton',
  () =>
    function MockRedirectButton() {
      return <button>redirect</button>
    },
)

import Results from '@/app/results/page'

const readyMatch = {
  ride_id: 77,
  user_id: 'user-1',
  date: '2099-06-20',
  time: '08:00:00',
  voucher: null,
  contingency_voucher: null,
  uber_type: 'X',
  ready_for_pickup_at: '2099-06-20T14:00:00Z',
  reported_missing_user_ids: null,
  group_ready_at: null,
  Flights: {
    airport: 'LAX',
    date: '2099-06-20',
    to_airport: true,
  },
  Users: {
    user_id: 'user-1',
    firstname: 'Taylor',
    lastname: 'Student',
    phonenumber: null,
    photo_url: null,
    email: 'taylor@example.com',
  },
}

describe('Results readiness persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requestJsonMock.mockResolvedValue({ success: true, matches: [readyMatch] })
  })

  it('renders match data before the single background write settles', async () => {
    postJsonMock.mockImplementation(() => new Promise(() => {}))

    render(<Results />)

    expect(await screen.findByTestId('match-77')).toHaveTextContent(
      'match 77 ready true',
    )
    expect(screen.queryByText('Loading Matches...')).not.toBeInTheDocument()
    await waitFor(() =>
      expect(postJsonMock).toHaveBeenCalledWith(
        '/api/matches/mark-group-ready',
        { rideIds: [77] },
      ),
    )
    expect(postJsonMock).toHaveBeenCalledTimes(1)
  })

  it('keeps rendered matches visible when background persistence fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    postJsonMock.mockRejectedValue(new Error('write failed'))

    render(<Results />)

    expect(await screen.findByTestId('match-77')).toBeInTheDocument()
    await waitFor(() => expect(errorSpy).toHaveBeenCalled())
    expect(screen.getByTestId('match-77')).toBeInTheDocument()

    errorSpy.mockRestore()
  })
})
