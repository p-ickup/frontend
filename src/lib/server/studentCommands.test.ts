/** @jest-environment node */

jest.mock('server-only', () => ({}))

import {
  acceptMatchRequest,
  cancelOwnMatch,
  createOwnFlight,
  reportReadyStatus,
  updateOwnFlight,
} from '@/lib/server/studentCommands'

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

describe('createOwnFlight', () => {
  it('narrows the write payload before inserting a flight', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { flight_id: 321 },
      error: null,
    })
    const select = jest.fn(() => ({ single }))
    const insert = jest.fn(() => ({ select }))
    const from = jest.fn(() => ({ insert }))

    await expect(
      createOwnFlight({
        supabase: { from },
        userId: 'student-1',
        payload: {
          user_id: 'evil-user',
          matched: true,
          created_at: '2020-01-01T00:00:00Z',
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
          injected: 'nope',
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
        matched: null,
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
        payload: {
          flight_no: 'AA12',
        },
      }),
    ).rejects.toMatchObject({
      message: 'flight_no must be a non-negative integer.',
      status: 400,
    })

    expect(insert).not.toHaveBeenCalled()
  })
})

describe('updateOwnFlight', () => {
  it('narrows the update payload before mutating a flight', async () => {
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
    const updateEq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ eq: updateEq }))
    const from = jest
      .fn()
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update })

    await expect(
      updateOwnFlight({
        supabase: { from },
        userId: 'student-1',
        flightId: 77,
        payload: {
          user_id: 'evil-user',
          matched: true,
          flight_no: '456',
          airport: ' ont ',
          opt_in: 'true',
          bag_no_large: '2',
          latest_time: '17:30',
          junk: 'ignore-me',
        },
      }),
    ).resolves.toEqual({ success: true })

    expect(update).toHaveBeenCalledWith({
      flight_no: 456,
      airport: 'ONT',
      opt_in: true,
      bag_no_large: 2,
      latest_time: '17:30',
      matched: null,
    })
    expect(updateEq).toHaveBeenCalledWith('flight_id', 77)
  })
})
