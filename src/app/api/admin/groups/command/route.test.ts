/** @jest-environment node */

const assertAdminScopeForRideMock = jest.fn().mockResolvedValue(undefined)
const assertAdminScopeForUserFlightPairMock = jest
  .fn()
  .mockResolvedValue(undefined)
const removeRiderToUnmatchedMock = jest.fn().mockResolvedValue(undefined)
const serviceRoleClient = { serviceRole: true }

jest.mock('@/lib/server/auth', () => ({
  badRequestJson: (message: string) =>
    Response.json({ error: message }, { status: 400 }),
  routeErrorJson: (error: any, fallback: string) =>
    Response.json(
      { error: error?.message || fallback },
      { status: error?.status || 500 },
    ),
  withAdminRoute: (handler: any) => (request: Request) =>
    handler(request, {
      user: { id: 'admin-1' },
      profile: { role: 'Admin', admin_scope: 'Pomona' },
    }),
}))

jest.mock('@/lib/server/adminScope', () => ({
  assertAdminScopeForChangeLogIds: jest.fn(),
  assertAdminScopeForChangeLogPayload: jest.fn(),
  assertAdminScopeForFlight: jest.fn(),
  assertAdminScopeForFlights: jest.fn(),
  assertAdminScopeForRide: (...args: unknown[]) =>
    assertAdminScopeForRideMock(...args),
  assertAdminScopeForUser: jest.fn(),
  assertAdminScopeForUserFlightPair: (...args: unknown[]) =>
    assertAdminScopeForUserFlightPairMock(...args),
  assertAdminScopeForUsers: jest.fn(),
}))

jest.mock('@/lib/server/serviceRole', () => ({
  createServiceRoleClient: () => serviceRoleClient,
}))

jest.mock('@/lib/server/adminGroupsCommands', () => ({
  addUnmatchedFlight: jest.fn(),
  confirmChangeLogEntries: jest.fn(),
  createGroupRecords: jest.fn(),
  deleteGroupRecords: jest.fn(),
  deleteRiderMatches: jest.fn(),
  logChangeLogEntry: jest.fn(),
  removeGroupMatch: jest.fn(),
  removeRiderToUnmatched: (...args: unknown[]) =>
    removeRiderToUnmatchedMock(...args),
  saveGroupOverrideRecords: jest.fn(),
  setMatchingStatus: jest.fn(),
  updateFlightRecord: jest.fn(),
  updateGroupMatchesMetadata: jest.fn(),
  updateGroupTimeRecords: jest.fn(),
  updateGroupVoucherRecords: jest.fn(),
  upsertManualGroupMatch: jest.fn(),
}))

import { POST } from './route'

const request = () =>
  new Request('http://localhost/api/admin/groups/command', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'remove_rider_to_unmatched',
      payload: {
        groupId: 44,
        userId: 'student-1',
        flightId: 101,
        remainingGroupUpdates: { uber_type: 'XL', source: 'forbidden' },
        changeMetadata: { from_group: 44, to: 'unmatched' },
      },
    }),
  })

describe('POST /api/admin/groups/command remove_rider_to_unmatched', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    assertAdminScopeForRideMock.mockResolvedValue(undefined)
    assertAdminScopeForUserFlightPairMock.mockResolvedValue(undefined)
    removeRiderToUnmatchedMock.mockResolvedValue(undefined)
  })

  it('checks ride and user-flight scope before executing the composite write', async () => {
    const response = await POST(request(), undefined as never)

    expect(response.status).toBe(200)
    expect(assertAdminScopeForRideMock).toHaveBeenCalledWith({
      supabase: serviceRoleClient,
      profile: { role: 'Admin', admin_scope: 'Pomona' },
      rideId: 44,
    })
    expect(assertAdminScopeForUserFlightPairMock).toHaveBeenCalledWith({
      supabase: serviceRoleClient,
      profile: { role: 'Admin', admin_scope: 'Pomona' },
      userId: 'student-1',
      flightId: 101,
    })
    expect(removeRiderToUnmatchedMock).toHaveBeenCalledWith({
      supabase: serviceRoleClient,
      actorUserId: 'admin-1',
      actorRole: 'Admin',
      actorName: undefined,
      groupId: 44,
      userId: 'student-1',
      flightId: 101,
      remainingGroupUpdates: { uber_type: 'XL' },
      changeMetadata: { from_group: 44, to: 'unmatched' },
    })
  })

  it('does not write when an admin is outside the allowed scope', async () => {
    const scopeError = Object.assign(new Error('Forbidden'), { status: 403 })
    assertAdminScopeForRideMock.mockRejectedValue(scopeError)

    const response = await POST(request(), undefined as never)

    expect(response.status).toBe(403)
    expect(removeRiderToUnmatchedMock).not.toHaveBeenCalled()
  })
})
