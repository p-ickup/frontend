/** @jest-environment node */

jest.mock('server-only', () => ({}))
jest.mock('@/utils/flightValidation', () => ({
  ...jest.requireActual('@/utils/flightValidation'),
  canEditFlight: jest.fn().mockReturnValue(true),
}))

import {
  acceptMatchRequest,
  cancelOwnMatch,
  createOwnFlight,
  deleteOwnFlight,
  getResultsMatches,
  getUnmatchedOptions,
  markGroupsReadyIfEligible,
  reportReadyStatus,
  sendMatchRequest,
  updateOwnFlight,
} from '@/lib/server/studentCommands'

const createThenableEqChain = <T>(data: T, error: unknown = null) => {
  const eqCalls: Array<[string, unknown]> = []
  const chain: {
    eq: jest.Mock
    neq: jest.Mock
    select: jest.Mock
    then: Promise<{ data: T; error: unknown }>['then']
    catch: Promise<{ data: T; error: unknown }>['catch']
  } = {
    eq: jest.fn((column: string, value: unknown) => {
      eqCalls.push([column, value])
      return chain
    }),
    neq: jest.fn(() => chain),
    select: jest.fn(() => chain),
    then: (onFulfilled, onRejected) =>
      Promise.resolve({ data, error }).then(onFulfilled, onRejected),
    catch: (onRejected) => Promise.resolve({ data, error }).catch(onRejected),
  }

  return { chain, eqCalls }
}

const buildFlightLookupChain = (flight: {
  flight_id: number
  user_id: string
  matching_status: 'submitted' | 'unmatched' | 'matched'
}) => {
  const maybeSingle = jest.fn().mockResolvedValue({ data: flight, error: null })
  const eqFlightId = jest.fn(() => ({ maybeSingle }))
  const select = jest.fn(() => ({ eq: eqFlightId }))
  return { select, eqFlightId, maybeSingle }
}

describe('acceptMatchRequest', () => {
  it('calls the transactional RPC and returns the ride id', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true, rideId: 42 },
      error: null,
    })

    await expect(
      acceptMatchRequest({
        supabase: { rpc },
        requestId: 'request-123',
      }),
    ).resolves.toEqual({
      success: true,
      rideId: 42,
    })

    expect(rpc).toHaveBeenCalledWith('accept_match_request', {
      p_request_id: 'request-123',
    })
  })

  it('surfaces structured RPC command failures with status', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: false,
        status: 409,
        error: 'This match request is no longer pending.',
      },
      error: null,
    })

    await expect(
      acceptMatchRequest({
        supabase: { rpc },
        requestId: 'request-123',
      }),
    ).rejects.toMatchObject({
      message: 'This match request is no longer pending.',
      status: 409,
    })
  })

  it('maps raw RPC errors to user-facing command errors', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        message:
          'One of these flights is already matched. Please refresh and try again.',
      },
    })

    await expect(
      acceptMatchRequest({
        supabase: { rpc },
        requestId: 'request-123',
      }),
    ).rejects.toMatchObject({
      message:
        'One of these flights is already matched. Please refresh and try again.',
      status: 409,
    })
  })
})

describe('cancelOwnMatch', () => {
  it('calls the transactional RPC for match cancellation', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })

    await expect(
      cancelOwnMatch({
        supabase: { rpc },
        rideId: 17,
      }),
    ).resolves.toEqual({
      success: true,
    })

    expect(rpc).toHaveBeenCalledWith('cancel_own_match', {
      p_ride_id: 17,
    })
  })

  it('surfaces structured cancellation failures with status', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: false,
        status: 404,
        error: 'Match not found.',
      },
      error: null,
    })

    await expect(
      cancelOwnMatch({
        supabase: { rpc },
        rideId: 17,
      }),
    ).rejects.toMatchObject({
      message: 'Match not found.',
      status: 404,
    })
  })
})

describe('reportReadyStatus', () => {
  it('calls the transactional RPC and returns readiness state', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true, nowReady: true },
      error: null,
    })

    await expect(
      reportReadyStatus({
        supabase: { rpc },
        rideId: 31,
        everyoneReady: false,
        missingUserIds: ['user-a'],
      }),
    ).resolves.toEqual({
      success: true,
      nowReady: true,
    })

    expect(rpc).toHaveBeenCalledWith('report_ready_status', {
      p_ride_id: 31,
      p_status: 'reporting_missing',
      p_missing_user_ids: ['user-a'],
    })
  })

  it('surfaces structured readiness failures with status', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: false,
        status: 403,
        error: 'You are not a member of this ride.',
      },
      error: null,
    })

    await expect(
      reportReadyStatus({
        supabase: { rpc },
        rideId: 31,
        everyoneReady: true,
        missingUserIds: [],
      }),
    ).rejects.toMatchObject({
      message: 'You are not a member of this ride.',
      status: 403,
    })
  })
})

describe('sendMatchRequest', () => {
  it('allows peer requests when both flights are submitted', async () => {
    const senderChain = buildFlightLookupChain({
      flight_id: 1,
      user_id: 'sender-1',
      matching_status: 'submitted',
    })
    const receiverChain = buildFlightLookupChain({
      flight_id: 2,
      user_id: 'receiver-1',
      matching_status: 'submitted',
    })
    const requestMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const requestEqStatus = jest.fn(() => ({ maybeSingle: requestMaybeSingle }))
    const requestEqReceiverFlight = jest.fn(() => ({ eq: requestEqStatus }))
    const requestEqSenderFlight = jest.fn(() => ({
      eq: requestEqReceiverFlight,
    }))
    const requestEqReceiver = jest.fn(() => ({ eq: requestEqSenderFlight }))
    const requestEqSender = jest.fn(() => ({ eq: requestEqReceiver }))
    const requestSelect = jest.fn(() => ({ eq: requestEqSender }))
    const insert = jest.fn().mockResolvedValue({ error: null })

    let flightReads = 0
    let matchRequestReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'Flights') {
        flightReads += 1
        return flightReads === 1 ? senderChain : receiverChain
      }
      if (table === 'MatchRequests') {
        matchRequestReads += 1
        return matchRequestReads === 1 ? { select: requestSelect } : { insert }
      }
      return {}
    })

    await expect(
      sendMatchRequest({
        supabase: { from },
        userId: 'sender-1',
        receiverId: 'receiver-1',
        senderFlightId: 1,
        receiverFlightId: 2,
      }),
    ).resolves.toEqual({ success: true })

    expect(insert).toHaveBeenCalledWith([
      {
        sender_id: 'sender-1',
        receiver_id: 'receiver-1',
        sender_flight_id: 1,
        receiver_flight_id: 2,
        status: 'pending',
      },
    ])
  })

  it('allows peer requests when both flights are unmatched', async () => {
    const senderChain = buildFlightLookupChain({
      flight_id: 1,
      user_id: 'sender-1',
      matching_status: 'unmatched',
    })
    const receiverChain = buildFlightLookupChain({
      flight_id: 2,
      user_id: 'receiver-1',
      matching_status: 'unmatched',
    })
    const requestMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const requestEqStatus = jest.fn(() => ({ maybeSingle: requestMaybeSingle }))
    const requestEqReceiverFlight = jest.fn(() => ({ eq: requestEqStatus }))
    const requestEqSenderFlight = jest.fn(() => ({
      eq: requestEqReceiverFlight,
    }))
    const requestEqReceiver = jest.fn(() => ({ eq: requestEqSenderFlight }))
    const requestEqSender = jest.fn(() => ({ eq: requestEqReceiver }))
    const requestSelect = jest.fn(() => ({ eq: requestEqSender }))
    const insert = jest.fn().mockResolvedValue({ error: null })

    let flightReads = 0
    let matchRequestReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'Flights') {
        flightReads += 1
        return flightReads === 1 ? senderChain : receiverChain
      }
      if (table === 'MatchRequests') {
        matchRequestReads += 1
        return matchRequestReads === 1 ? { select: requestSelect } : { insert }
      }
      return {}
    })

    await expect(
      sendMatchRequest({
        supabase: { from },
        userId: 'sender-1',
        receiverId: 'receiver-1',
        senderFlightId: 1,
        receiverFlightId: 2,
      }),
    ).resolves.toEqual({ success: true })

    expect(insert).toHaveBeenCalled()
  })

  it('rejects when the sender flight is already matched', async () => {
    const senderChain = buildFlightLookupChain({
      flight_id: 1,
      user_id: 'sender-1',
      matching_status: 'matched',
    })
    const receiverChain = buildFlightLookupChain({
      flight_id: 2,
      user_id: 'receiver-1',
      matching_status: 'unmatched',
    })
    const requestMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const requestEqStatus = jest.fn(() => ({ maybeSingle: requestMaybeSingle }))
    const requestEqReceiverFlight = jest.fn(() => ({ eq: requestEqStatus }))
    const requestEqSenderFlight = jest.fn(() => ({
      eq: requestEqReceiverFlight,
    }))
    const requestEqReceiver = jest.fn(() => ({ eq: requestEqSenderFlight }))
    const requestEqSender = jest.fn(() => ({ eq: requestEqReceiver }))
    const requestSelect = jest.fn(() => ({ eq: requestEqSender }))
    const insert = jest.fn()

    let flightReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'Flights') {
        flightReads += 1
        return flightReads === 1 ? senderChain : receiverChain
      }
      if (table === 'MatchRequests') {
        return { select: requestSelect }
      }
      return {}
    })

    await expect(
      sendMatchRequest({
        supabase: { from },
        userId: 'sender-1',
        receiverId: 'receiver-1',
        senderFlightId: 1,
        receiverFlightId: 2,
      }),
    ).rejects.toMatchObject({
      message: 'One of these flights is already matched.',
      status: 409,
    })

    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects when the receiver flight is already matched', async () => {
    const senderChain = buildFlightLookupChain({
      flight_id: 1,
      user_id: 'sender-1',
      matching_status: 'submitted',
    })
    const receiverChain = buildFlightLookupChain({
      flight_id: 2,
      user_id: 'receiver-1',
      matching_status: 'matched',
    })
    const requestMaybeSingle = jest
      .fn()
      .mockResolvedValue({ data: null, error: null })
    const requestEqStatus = jest.fn(() => ({ maybeSingle: requestMaybeSingle }))
    const requestEqReceiverFlight = jest.fn(() => ({ eq: requestEqStatus }))
    const requestEqSenderFlight = jest.fn(() => ({
      eq: requestEqReceiverFlight,
    }))
    const requestEqReceiver = jest.fn(() => ({ eq: requestEqSenderFlight }))
    const requestEqSender = jest.fn(() => ({ eq: requestEqReceiver }))
    const requestSelect = jest.fn(() => ({ eq: requestEqSender }))
    const insert = jest.fn()

    let flightReads = 0
    const from = jest.fn((table: string) => {
      if (table === 'Flights') {
        flightReads += 1
        return flightReads === 1 ? senderChain : receiverChain
      }
      if (table === 'MatchRequests') {
        return { select: requestSelect }
      }
      return {}
    })

    await expect(
      sendMatchRequest({
        supabase: { from },
        userId: 'sender-1',
        receiverId: 'receiver-1',
        senderFlightId: 1,
        receiverFlightId: 2,
      }),
    ).rejects.toMatchObject({
      message: 'One of these flights is already matched.',
      status: 409,
    })

    expect(insert).not.toHaveBeenCalled()
  })
})

describe('getUnmatchedOptions', () => {
  it('queries only post-algorithm unmatched flights, not submitted', async () => {
    const myFlights = createThenableEqChain([])
    const peerFlights = createThenableEqChain([])
    const partialGroups = createThenableEqChain([])

    let flightReads = 0
    const selectCalls: string[] = []
    const from = jest.fn((table: string) => {
      if (table === 'Flights') {
        flightReads += 1
        return {
          select: (fields: string) => {
            selectCalls.push(fields)
            return (flightReads === 1 ? myFlights : peerFlights).chain
          },
        }
      }
      if (table === 'Matches') {
        return {
          select: (fields: string) => {
            selectCalls.push(fields)
            return partialGroups.chain
          },
        }
      }
      return {}
    })

    await expect(
      getUnmatchedOptions({
        supabase: { from },
        userId: 'student-1',
      }),
    ).resolves.toMatchObject({
      success: true,
      userEligible: false,
    })

    expect(myFlights.eqCalls).toContainEqual(['matching_status', 'unmatched'])
    expect(peerFlights.eqCalls).toContainEqual(['matching_status', 'unmatched'])
    expect(myFlights.eqCalls).not.toContainEqual([
      'matching_status',
      'submitted',
    ])
    expect(peerFlights.eqCalls).not.toContainEqual([
      'matching_status',
      'submitted',
    ])
    expect(selectCalls.every((fields) => !fields.includes('*'))).toBe(true)
  })
})

describe('getResultsMatches', () => {
  it('selects and returns only the declared Results response fields', async () => {
    const userRideIds = createThenableEqChain([{ ride_id: 7 }])
    const detailsIn = jest.fn().mockResolvedValue({
      data: [
        {
          ride_id: 7,
          user_id: 'user-1',
          date: '2026-06-20',
          time: '08:00:00',
          voucher: null,
          contingency_voucher: null,
          uber_type: 'X',
          ready_for_pickup_at: null,
          reported_missing_user_ids: null,
          group_ready_at: null,
          internal_note: 'must not escape',
          Flights: {
            airport: 'LAX',
            date: '2026-06-20',
            to_airport: true,
            terminal: '4',
          },
          Users: {
            user_id: 'user-1',
            firstname: 'Taylor',
            lastname: 'Student',
            phonenumber: null,
            photo_url: null,
            email: 'taylor@example.com',
            role: 'admin',
          },
        },
      ],
      error: null,
    })
    const selectCalls: string[] = []
    let reads = 0
    const from = jest.fn(() => {
      reads += 1
      if (reads === 1) {
        return {
          select: (fields: string) => {
            selectCalls.push(fields)
            return userRideIds.chain
          },
        }
      }
      return {
        select: (fields: string) => {
          selectCalls.push(fields)
          return { in: detailsIn }
        },
      }
    })

    const result = await getResultsMatches({
      supabase: { from },
      userId: 'user-1',
    })

    expect(selectCalls.every((fields) => !fields.includes('*'))).toBe(true)
    expect(detailsIn).toHaveBeenCalledWith('ride_id', [7])
    expect(Object.keys(result.matches[0])).not.toContain('internal_note')
    expect(Object.keys(result.matches[0].Flights)).not.toContain('terminal')
    expect(Object.keys(result.matches[0].Users)).not.toContain('role')
  })
})

describe('markGroupsReadyIfEligible', () => {
  it('checks all memberships once and updates eligible rides idempotently', async () => {
    const readIn = jest.fn().mockResolvedValue({
      data: [
        {
          ride_id: 7,
          user_id: 'user-1',
          ready_for_pickup_at: '2026-06-20T14:00:00Z',
          reported_missing_user_ids: null,
          group_ready_at: null,
        },
        {
          ride_id: 8,
          user_id: 'user-1',
          ready_for_pickup_at: '2026-06-20T15:00:00Z',
          reported_missing_user_ids: null,
          group_ready_at: '2026-06-20T15:05:00Z',
        },
      ],
      error: null,
    })
    const isNull = jest.fn().mockResolvedValue({ error: null })
    const updateEq = jest.fn(() => ({ is: isNull }))
    const update = jest.fn(() => ({ eq: updateEq }))
    let calls = 0
    const from = jest.fn(() => {
      calls += 1
      return calls === 1 ? { select: () => ({ in: readIn }) } : { update }
    })

    const result = await markGroupsReadyIfEligible({
      supabase: { from },
      userId: 'user-1',
      rideIds: [7, 8, 7],
    })

    expect(readIn).toHaveBeenCalledWith('ride_id', [7, 8])
    expect(update).toHaveBeenCalledTimes(1)
    expect(updateEq).toHaveBeenCalledWith('ride_id', 7)
    expect(isNull).toHaveBeenCalledWith('group_ready_at', null)
    expect(result.results).toEqual([
      expect.objectContaining({ rideId: 7, updated: true }),
      {
        rideId: 8,
        updated: false,
        groupReadyAt: '2026-06-20T15:05:00Z',
      },
    ])
  })

  it('rejects the whole batch before writing when a ride is out of scope', async () => {
    const readIn = jest.fn().mockResolvedValue({
      data: [
        {
          ride_id: 7,
          user_id: 'other-user',
          ready_for_pickup_at: '2026-06-20T14:00:00Z',
          reported_missing_user_ids: null,
          group_ready_at: null,
        },
      ],
      error: null,
    })
    const update = jest.fn()
    const from = jest.fn().mockReturnValue({
      select: () => ({ in: readIn }),
      update,
    })

    await expect(
      markGroupsReadyIfEligible({
        supabase: { from },
        userId: 'user-1',
        rideIds: [7],
      }),
    ).rejects.toMatchObject({ status: 403 })

    expect(update).not.toHaveBeenCalled()
  })
})

describe('createOwnFlight', () => {
  const validPayload = (overrides: Record<string, unknown> = {}) => ({
    to_airport: true,
    airport: 'LAX',
    flight_no: 123,
    airline_iata: 'AA',
    date: '2026-06-20',
    bag_no_personal: 0,
    bag_no: 0,
    bag_no_large: 0,
    earliest_time: '08:00',
    latest_time: '09:00',
    ...overrides,
  })

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-15T12:00:00-07:00'))
  })

  afterEach(() => jest.useRealTimers())

  it('narrows the write payload before inserting a flight', async () => {
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        firstname: 'Taylor',
        lastname: 'Student',
        school: 'Pomona',
        email: 'taylor@example.com',
        phonenumber: '9095551234',
      },
      error: null,
    })
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }))
    const profileSelect = jest.fn(() => ({ eq: profileEq }))
    const single = jest.fn().mockResolvedValue({
      data: { flight_id: 321 },
      error: null,
    })
    const select = jest.fn(() => ({ single }))
    const insert = jest.fn(() => ({ select }))
    const from = jest
      .fn()
      .mockReturnValueOnce({ select: profileSelect })
      .mockReturnValueOnce({ insert })

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: {
          to_airport: 'true',
          airport: ' lax ',
          flight_no: '123',
          airline_iata: 'aa',
          date: '2026-01-20',
          bag_no_personal: '1',
          bag_no: 2,
          bag_no_large: '3',
          earliest_time: '08:00',
          latest_time: '09:00',
          opt_in: 'false',
          terminal: ' 4 ',
        },
      }),
    ).resolves.toEqual({
      success: true,
      flightId: 321,
    })

    expect(insert).toHaveBeenCalledWith([
      {
        to_airport: true,
        airport: 'LAX',
        flight_no: 123,
        airline_iata: 'AA',
        date: '2026-01-20',
        bag_no_personal: 1,
        bag_no: 2,
        bag_no_large: 3,
        earliest_time: '08:00',
        latest_time: '09:00',
        opt_in: false,
        terminal: '4',
        user_id: 'student-1',
        matching_status: 'submitted',
      },
    ])
  })

  it('rejects invalid flight payload fields before inserting', async () => {
    const insert = jest.fn()
    const from = jest.fn(() => ({ insert }))

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: validPayload({ flight_no: 'AA12' }),
      }),
    ).rejects.toMatchObject({
      message: 'Flight number must be an integer from 1 to 9999.',
      status: 400,
    })

    expect(insert).not.toHaveBeenCalled()
  })

  it('rejects unsupported fields instead of silently discarding them', async () => {
    const from = jest.fn()

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: { user_id: 'other-user' },
      }),
    ).rejects.toMatchObject({
      message: 'Unsupported flight field: user_id.',
      code: 'UNSUPPORTED_FIELD',
      field: 'user_id',
    })

    expect(from).not.toHaveBeenCalled()
  })

  it('does not expose database internals when creation fails', async () => {
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        firstname: 'Taylor',
        lastname: 'Student',
        school: 'Pomona',
        email: 'taylor@example.com',
        phonenumber: '9095551234',
      },
      error: null,
    })
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }))
    const profileSelect = jest.fn(() => ({ eq: profileEq }))
    const single = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '23514',
        message: 'new row violates check constraint flights_internal_check',
        hint: 'sensitive database hint',
      },
    })
    const select = jest.fn(() => ({ single }))
    const insert = jest.fn(() => ({ select }))
    const from = jest
      .fn()
      .mockReturnValueOnce({ select: profileSelect })
      .mockReturnValueOnce({ insert })

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: validPayload(),
      }),
    ).rejects.toMatchObject({
      message: 'The flight could not be saved.',
      status: 500,
    })
  })
})

describe('updateOwnFlight', () => {
  it('rejects cross-user updates before invoking the transaction RPC', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 77,
        user_id: 'other-student',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const from = jest.fn(() => ({ select }))
    const rpc = jest.fn()

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: { airport: 'LAX' },
      }),
    ).rejects.toMatchObject({
      message: 'Flight not found.',
      status: 404,
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('narrows the update payload before calling the transactional RPC', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 77,
        user_id: 'student-1',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        firstname: 'Taylor',
        lastname: 'Student',
        school: 'Pomona',
        email: 'taylor@example.com',
        phonenumber: '9095551234',
      },
      error: null,
    })
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }))
    const profileSelect = jest.fn(() => ({ eq: profileEq }))
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })
    const from = jest
      .fn()
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ select: profileSelect })

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: {
          flight_no: '456',
          airport: ' ont ',
          opt_in: 'true',
          bag_no_large: '2',
          latest_time: '17:30',
        },
      }),
    ).resolves.toEqual({ success: true })

    expect(rpc).toHaveBeenCalledWith('update_own_flight_tx', {
      p_flight_id: 77,
      p_fields: {
        flight_no: 456,
        airport: 'ONT',
        opt_in: true,
        bag_no_large: 2,
        latest_time: '17:30',
      },
    })
  })

  it('surfaces structured matched-flight failures with status 409', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 77,
        user_id: 'student-1',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const profileMaybeSingle = jest.fn().mockResolvedValue({
      data: {
        firstname: 'Taylor',
        lastname: 'Student',
        school: 'Pomona',
        email: 'taylor@example.com',
        phonenumber: '9095551234',
      },
      error: null,
    })
    const profileEq = jest.fn(() => ({ maybeSingle: profileMaybeSingle }))
    const profileSelect = jest.fn(() => ({ eq: profileEq }))
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: false,
        status: 409,
        error:
          'This flight is part of a match. Cancel your match from the Results page before deleting.',
      },
      error: null,
    })
    const from = jest
      .fn()
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ select: profileSelect })

    await expect(
      updateOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 77,
        payload: { airport: 'LAX' },
      }),
    ).rejects.toMatchObject({
      message:
        'This flight is part of a match. Cancel your match from the Results page before deleting.',
      status: 409,
    })
  })
})

describe('deleteOwnFlight', () => {
  it('rejects cross-user deletes before invoking the transaction RPC', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 88,
        user_id: 'other-student',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const from = jest.fn(() => ({ select }))
    const rpc = jest.fn()

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 88,
      }),
    ).rejects.toMatchObject({
      message: 'Flight not found.',
      status: 404,
    })

    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls the transactional RPC for flight deletion', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 88,
        user_id: 'student-1',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const rpc = jest.fn().mockResolvedValue({
      data: { success: true },
      error: null,
    })
    const from = jest.fn().mockReturnValueOnce({ select })

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 88,
      }),
    ).resolves.toEqual({ success: true })

    expect(rpc).toHaveBeenCalledWith('delete_own_flight_tx', {
      p_flight_id: 88,
    })
  })

  it('surfaces structured matched-flight failures with status 409', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({
      data: {
        flight_id: 88,
        user_id: 'student-1',
        date: '2099-01-20',
      },
      error: null,
    })
    const selectEq = jest.fn(() => ({ maybeSingle }))
    const select = jest.fn(() => ({ eq: selectEq }))
    const rpc = jest.fn().mockResolvedValue({
      data: {
        success: false,
        status: 409,
        error:
          'This flight is part of a match. Cancel your match from the Results page before deleting.',
      },
      error: null,
    })
    const from = jest.fn().mockReturnValueOnce({ select })

    await expect(
      deleteOwnFlight({
        supabase: { from, rpc },
        userId: 'student-1',
        flightId: 88,
      }),
    ).rejects.toMatchObject({
      message:
        'This flight is part of a match. Cancel your match from the Results page before deleting.',
      status: 409,
    })
  })
})
