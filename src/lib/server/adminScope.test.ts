/** @jest-environment node */

jest.mock('server-only', () => ({}))

import {
  assertAdminScopeForUser,
  assertAdminScopeForUserFlightPair,
} from '@/lib/server/adminScope'

describe('admin scope authorization', () => {
  it('rejects an admin targeting a user outside their school scope', async () => {
    const inMock = jest.fn().mockResolvedValue({
      data: [{ user_id: 'user-scripps', school: 'Scripps' }],
      error: null,
    })
    const select = jest.fn(() => ({ in: inMock }))
    const from = jest.fn(() => ({ select }))

    await expect(
      assertAdminScopeForUser({
        supabase: { from },
        profile: { role: 'admin', admin_scope: 'Pomona' },
        userId: 'user-scripps',
      }),
    ).rejects.toMatchObject({
      message: 'This action includes riders outside your admin scope.',
      status: 403,
      details: { userId: 'user-scripps' },
    })

    expect(from).toHaveBeenCalledWith('Users')
  })

  it('rejects a user and flight pair when the flight belongs to another user', async () => {
    const inMock = jest.fn().mockResolvedValue({
      data: [{ flight_id: 42, user_id: 'other-user' }],
      error: null,
    })
    const select = jest.fn(() => ({ in: inMock }))
    const from = jest.fn(() => ({ select }))

    await expect(
      assertAdminScopeForUserFlightPair({
        supabase: { from },
        profile: { role: 'admin', admin_scope: 'Pomona' },
        userId: 'target-user',
        flightId: 42,
      }),
    ).rejects.toMatchObject({
      message: 'The selected flight does not belong to the targeted rider.',
      status: 400,
      details: { flightId: 42, userId: 'target-user' },
    })

    expect(from).toHaveBeenCalledTimes(1)
    expect(from).toHaveBeenCalledWith('Flights')
  })
})
