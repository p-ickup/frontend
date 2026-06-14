/** @jest-environment node */

jest.mock('server-only', () => ({}))

import {
  addUnmatchedFlight,
  removeRiderToUnmatched,
  setMatchingStatus,
} from '@/lib/server/adminGroupsCommands'

describe('setMatchingStatus', () => {
  it('updates matching_status to matched for a single flight id', async () => {
    const inMock = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ in: inMock }))
    const from = jest.fn(() => ({ update }))

    await setMatchingStatus({
      supabase: { from },
      flightIds: 42,
      status: 'matched',
    })

    expect(from).toHaveBeenCalledWith('Flights')
    expect(update).toHaveBeenCalledWith({ matching_status: 'matched' })
    expect(inMock).toHaveBeenCalledWith('flight_id', [42])
  })

  it('updates matching_status to unmatched for multiple flight ids', async () => {
    const inMock = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ in: inMock }))
    const from = jest.fn(() => ({ update }))

    await setMatchingStatus({
      supabase: { from },
      flightIds: [10, 20],
      status: 'unmatched',
    })

    expect(update).toHaveBeenCalledWith({ matching_status: 'unmatched' })
    expect(inMock).toHaveBeenCalledWith('flight_id', [10, 20])
  })

  it('no-ops when flightIds is empty', async () => {
    const from = jest.fn()

    await setMatchingStatus({
      supabase: { from },
      flightIds: [],
      status: 'matched',
    })

    expect(from).not.toHaveBeenCalled()
  })
})

describe('removeRiderToUnmatched', () => {
  it('persists the rider move and audit entry without looking up the actor role', async () => {
    const removeFlight = jest.fn().mockResolvedValue({ error: null })
    const removeUser = jest.fn(() => ({ eq: removeFlight }))
    const removeRide = jest.fn(() => ({ eq: removeUser }))
    const deleteMatches = jest.fn(() => ({ eq: removeRide }))

    const updateMatchesByRide = jest.fn().mockResolvedValue({ error: null })
    const updateMatches = jest.fn(() => ({ eq: updateMatchesByRide }))

    const updateFlightsByIds = jest.fn().mockResolvedValue({ error: null })
    const updateFlights = jest.fn(() => ({ in: updateFlightsByIds }))

    const readInsertedChangeLog = jest.fn().mockResolvedValue({
      data: {
        id: 'change-1',
        actor_user_id: 'admin-1',
        actor_role: 'Admin',
        action: 'REMOVE_FROM_GROUP',
        algorithm_run_id: null,
        change_batch_id: null,
        target_group_id: 44,
        target_user_id: 'student-1',
        ignored_error: false,
        confirmed: false,
        metadata: { from_group: 44, to: 'unmatched' },
        created_at: '2026-06-13T00:00:00.000Z',
      },
      error: null,
    })
    const selectInsertedChangeLog = jest.fn(() => ({
      single: readInsertedChangeLog,
    }))
    const insertChangeLog = jest.fn(() => ({
      select: selectInsertedChangeLog,
    }))
    const from = jest.fn((table: string) => {
      if (table === 'Matches') {
        return { delete: deleteMatches, update: updateMatches }
      }
      if (table === 'Flights') return { update: updateFlights }
      if (table === 'ChangeLog') return { insert: insertChangeLog }
      throw new Error(`Unexpected table: ${table}`)
    })

    await removeRiderToUnmatched({
      supabase: { from },
      actorUserId: 'admin-1',
      actorRole: 'Admin',
      groupId: 44,
      userId: 'student-1',
      flightId: 101,
      remainingGroupUpdates: {
        uber_type: 'XL',
        is_subsidized: true,
        is_verified: false,
      },
      changeMetadata: { from_group: 44, to: 'unmatched' },
    })

    expect(removeRide).toHaveBeenCalledWith('ride_id', 44)
    expect(removeUser).toHaveBeenCalledWith('user_id', 'student-1')
    expect(removeFlight).toHaveBeenCalledWith('flight_id', 101)
    expect(updateFlights).toHaveBeenCalledWith({
      matching_status: 'unmatched',
    })
    expect(updateFlightsByIds).toHaveBeenCalledWith('flight_id', [101])
    expect(updateMatches).toHaveBeenCalledWith({
      uber_type: 'XL',
      is_subsidized: true,
      is_verified: false,
    })
    expect(updateMatchesByRide).toHaveBeenCalledWith('ride_id', 44)
    expect(insertChangeLog).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: 'admin-1',
        actor_role: 'Admin',
        action: 'REMOVE_FROM_GROUP',
        target_group_id: 44,
        target_user_id: 'student-1',
      }),
    )
    expect(selectInsertedChangeLog).toHaveBeenCalledWith(
      expect.stringContaining('id'),
    )
    expect(from).not.toHaveBeenCalledWith('Users')
  })

  it('does not write an audit entry when the rider transition fails', async () => {
    const removeFlight = jest
      .fn()
      .mockResolvedValue({ error: { message: 'Delete failed' } })
    const removeUser = jest.fn(() => ({ eq: removeFlight }))
    const removeRide = jest.fn(() => ({ eq: removeUser }))
    const deleteMatches = jest.fn(() => ({ eq: removeRide }))
    const updateFlightsByIds = jest.fn().mockResolvedValue({ error: null })
    const updateFlights = jest.fn(() => ({ in: updateFlightsByIds }))
    const insertChangeLog = jest.fn()
    const from = jest.fn((table: string) => {
      if (table === 'Matches') return { delete: deleteMatches }
      if (table === 'Flights') return { update: updateFlights }
      if (table === 'ChangeLog') return { insert: insertChangeLog }
      throw new Error(`Unexpected table: ${table}`)
    })

    await expect(
      removeRiderToUnmatched({
        supabase: { from },
        actorUserId: 'admin-1',
        actorRole: 'Admin',
        groupId: 44,
        userId: 'student-1',
        flightId: 101,
        changeMetadata: { from_group: 44, to: 'unmatched' },
      }),
    ).rejects.toThrow('Delete failed')

    expect(insertChangeLog).not.toHaveBeenCalled()
  })
})

describe('addUnmatchedFlight', () => {
  it('creates an admin-added flight in the unmatched state', async () => {
    const single = jest.fn().mockResolvedValue({
      data: { flight_id: 205 },
      error: null,
    })
    const select = jest.fn(() => ({ single }))
    const insert = jest.fn(() => ({ select }))
    const from = jest.fn(() => ({ insert }))

    await expect(
      addUnmatchedFlight({
        supabase: { from },
        payload: {
          user_id: 'student-2',
          airport: 'lax',
          date: '2026-06-20',
        },
      }),
    ).resolves.toEqual({ flightId: 205 })

    expect(insert).toHaveBeenCalledWith({
      user_id: 'student-2',
      airport: 'LAX',
      date: '2026-06-20',
      matching_status: 'unmatched',
    })
  })
})
