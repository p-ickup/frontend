/** @jest-environment node */

const fetchGroupsManagementSnapshotMock = jest.fn()
const fetchLastAlgorithmRunWindowMock = jest.fn()

jest.mock('@/lib/server/auth', () => ({
  badRequestJson: (message: string) =>
    Response.json({ error: message }, { status: 400 }),
  routeErrorJson: (error: any, fallback: string) =>
    Response.json({ error: error?.message || fallback }, { status: 500 }),
  withAdminRoute: (handler: any) => (request: Request, context?: unknown) =>
    handler(
      request,
      {
        supabase: {},
        user: { id: 'admin-1' },
        profile: { role: 'admin', admin_scope: 'Pomona' },
      },
      context,
    ),
}))

jest.mock(
  '@/components/admin/groups-management/services/groupsReadService',
  () => ({
    fetchGroupsManagementSnapshot: (...args: unknown[]) =>
      fetchGroupsManagementSnapshotMock(...args),
    fetchLastAlgorithmRunWindow: (...args: unknown[]) =>
      fetchLastAlgorithmRunWindowMock(...args),
    getDefaultDateWindow: () => ({
      dateRangeStart: '2026-06-06',
      dateRangeEnd: '2026-07-13',
    }),
  }),
)

import { GET } from '@/app/api/admin/groups/snapshot/route'

describe('GET /api/admin/groups/snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    fetchGroupsManagementSnapshotMock.mockResolvedValue({
      adminScope: 'Pomona',
      availableAirports: ['LAX'],
      groups: [
        {
          ride_id: 7,
          airport: 'LAX',
          date: '2026-06-20',
          time_range: '08:00 - 09:00',
          to_airport: true,
          riders: [],
          internal: 'must not escape',
        },
      ],
      unmatchedRiders: [],
      pagination: {
        page: 1,
        pageSize: 200,
        totalRecords: 1,
        totalPages: 1,
        internal: 'must not escape',
      },
      internal: 'must not escape',
    })
    fetchLastAlgorithmRunWindowMock.mockResolvedValue({
      lastAlgorithmRunDate: '2026-06-10',
    })
  })

  it('applies bounded defaults and returns the exact response contract', async () => {
    const response = await GET(
      new Request('http://localhost/api/admin/groups/snapshot'),
      undefined as never,
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(fetchGroupsManagementSnapshotMock).toHaveBeenCalledWith({
      supabase: {},
      adminScope: 'Pomona',
      dateRangeStart: '2026-06-06',
      dateRangeEnd: '2026-07-13',
      page: 1,
      pageSize: 200,
    })
    expect(Object.keys(payload)).toEqual([
      'adminScope',
      'availableAirports',
      'groups',
      'unmatchedRiders',
      'pagination',
      'dateRangeStart',
      'dateRangeEnd',
      'lastAlgorithmRunDate',
    ])
    expect(payload).not.toHaveProperty('internal')
    expect(payload.groups[0]).not.toHaveProperty('internal')
    expect(payload.pagination).not.toHaveProperty('internal')
  })

  it.each([
    ['invalid calendar date', 'dateStart=2026-02-30&dateEnd=2026-03-01'],
    ['reversed range', 'dateStart=2026-06-30&dateEnd=2026-06-01'],
    ['range over 366 days', 'dateStart=2025-01-01&dateEnd=2026-01-03'],
    ['page below one', 'page=0'],
    ['page size over 200', 'pageSize=201'],
  ])('rejects %s', async (_label, query) => {
    const response = await GET(
      new Request(`http://localhost/api/admin/groups/snapshot?${query}`),
      undefined as never,
    )

    expect(response.status).toBe(400)
    expect(fetchGroupsManagementSnapshotMock).not.toHaveBeenCalled()
    expect(fetchLastAlgorithmRunWindowMock).not.toHaveBeenCalled()
  })
})
