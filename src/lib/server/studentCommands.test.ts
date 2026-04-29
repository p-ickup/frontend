/** @jest-environment node */

jest.mock('server-only', () => ({}))

import {
  acceptMatchRequest,
  cancelOwnMatch,
  reportReadyStatus,
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
