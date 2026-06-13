const postJsonMock = jest.fn().mockResolvedValue({ success: true })

jest.mock('@/utils/api', () => ({
  postJson: (...args: unknown[]) => postJsonMock(...args),
}))

import { moveRiderToGroup, removeRiderToUnmatched } from './groupsWriteService'

describe('removeRiderToUnmatched', () => {
  beforeEach(() => {
    postJsonMock.mockClear()
  })

  it('uses one composite admin command for the complete rider move', async () => {
    await removeRiderToUnmatched({
      supabase: {},
      groupId: 44,
      userId: 'student-1',
      flightId: 101,
      remainingGroupUpdates: {
        uber_type: 'XL',
        is_subsidized: true,
        is_verified: false,
      },
      changeMetadata: {
        from_group: 44,
        to: 'unmatched',
      },
    })

    expect(postJsonMock).toHaveBeenCalledTimes(1)
    expect(postJsonMock).toHaveBeenCalledWith('/api/admin/groups/command', {
      action: 'remove_rider_to_unmatched',
      payload: {
        groupId: 44,
        userId: 'student-1',
        flightId: 101,
        remainingGroupUpdates: {
          uber_type: 'XL',
          is_subsidized: true,
          is_verified: false,
        },
        changeMetadata: {
          from_group: 44,
          to: 'unmatched',
        },
      },
    })
  })
})

describe('moveRiderToGroup', () => {
  beforeEach(() => {
    postJsonMock.mockClear()
  })

  it('uses one composite request for persistence, metadata, and audit work', async () => {
    const payload = {
      destinationGroupId: 55,
      sourceGroupId: 44,
      userId: 'student-1',
      flightId: 101,
      date: '2026-06-20',
      time: '10:00:00',
      voucher: '',
      isSubsidized: false,
      uberType: 'XL',
      destinationGroupUpdates: { is_verified: false },
      sourceGroupUpdates: { is_verified: false },
      changeLogIds: ['change-1'],
      sourceMetadata: { from_group: 44 },
      destinationMetadata: { to_group: 55 },
      changeBatchId: 'batch-1',
    }

    await moveRiderToGroup(payload)

    expect(postJsonMock).toHaveBeenCalledTimes(1)
    expect(postJsonMock).toHaveBeenCalledWith('/api/admin/groups/command', {
      action: 'move_rider_to_group',
      payload,
    })
  })
})
