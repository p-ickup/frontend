/** @jest-environment node */

jest.mock('server-only', () => ({}))

import { setMatchingStatus } from '@/lib/server/adminGroupsCommands'

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
