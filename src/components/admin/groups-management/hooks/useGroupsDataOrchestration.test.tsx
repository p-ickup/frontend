import { renderHook, waitFor } from '@testing-library/react'

const requestJsonMock = jest.fn()
const fetchChangeLogEntriesMock = jest.fn()
const fetchPendingChangesSnapshotMock = jest.fn()

jest.mock('@/utils/api', () => ({
  requestJson: (...args: unknown[]) => requestJsonMock(...args),
}))

jest.mock(
  '@/components/admin/groups-management/services/groupsReadService',
  () => ({
    fetchChangeLogEntries: (...args: unknown[]) =>
      fetchChangeLogEntriesMock(...args),
    fetchPendingChangesSnapshot: (...args: unknown[]) =>
      fetchPendingChangesSnapshotMock(...args),
  }),
)

import { useGroupsDataOrchestration } from '@/components/admin/groups-management/hooks/useGroupsDataOrchestration'

const group = {
  ride_id: 7,
  airport: 'LAX',
  date: '2026-06-20',
  time_range: '08:00 - 09:00',
  to_airport: true,
  riders: [],
}

const createProps = (overrides: Record<string, unknown> = {}) => ({
  changeLogExpanded: false,
  corralTab: 'riders' as const,
  dateRangeEnd: '',
  dateRangeStart: '',
  groups: [],
  isResizingChangeLog: false,
  resizeStartRef: { current: null },
  setAdminScope: jest.fn(),
  setAvailableAirports: jest.fn(),
  setChangeLog: jest.fn(),
  setChangeLogHeight: jest.fn(),
  setChangedGroups: jest.fn(),
  setCorralCollapsed: jest.fn(),
  setDateRangeEnd: jest.fn(),
  setDateRangeStart: jest.fn(),
  setFiltersCollapsed: jest.fn(),
  setGroups: jest.fn(),
  setIsResizingChangeLog: jest.fn(),
  setLastAlgorithmRunDate: jest.fn(),
  setSelectedAirports: jest.fn(),
  setUnmatchedIndividuals: jest.fn(),
  setUnmatchedRiders: jest.fn(),
  supabase: {},
  ...overrides,
})

describe('useGroupsDataOrchestration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    requestJsonMock.mockResolvedValue({
      adminScope: 'Pomona',
      availableAirports: ['LAX'],
      groups: [group],
      unmatchedRiders: [],
      pagination: {
        page: 1,
        pageSize: 200,
        totalRecords: 1,
        totalPages: 1,
      },
      dateRangeStart: '2026-06-01',
      dateRangeEnd: '2026-06-30',
      lastAlgorithmRunDate: '2026-06-10',
    })
    fetchChangeLogEntriesMock.mockResolvedValue({
      entries: [],
      hasMore: false,
    })
    fetchPendingChangesSnapshotMock.mockResolvedValue({
      changedGroups: [],
      unmatchedIndividuals: [],
    })
  })

  it('renders the primary snapshot before loading secondary panels', async () => {
    const initialProps = createProps()
    const { result, rerender } = renderHook(
      (props) => useGroupsDataOrchestration(props as any),
      { initialProps },
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(requestJsonMock).toHaveBeenCalledTimes(1)
    expect(fetchChangeLogEntriesMock).not.toHaveBeenCalled()
    expect(fetchPendingChangesSnapshotMock).not.toHaveBeenCalled()

    rerender(
      createProps({
        changeLogExpanded: true,
        corralTab: 'changes',
        groups: [group],
      }),
    )

    await waitFor(() => expect(fetchChangeLogEntriesMock).toHaveBeenCalled())
    await waitFor(() =>
      expect(fetchPendingChangesSnapshotMock).toHaveBeenCalledWith(
        expect.objectContaining({ groups: [group] }),
      ),
    )
  })

  it('requests a bounded page from the protected endpoint', async () => {
    const props = createProps()
    const { result } = renderHook(() =>
      useGroupsDataOrchestration(props as any),
    )
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(requestJsonMock).toHaveBeenCalledWith(
      '/api/admin/groups/snapshot?page=1&pageSize=200',
    )
  })
})
