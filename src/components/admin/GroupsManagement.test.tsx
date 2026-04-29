import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createBrowserClientMock = jest.fn(() => ({}))
const useAuthMock = jest.fn(() => ({ user: null }))
const useSubsidyLogicMock = jest.fn(() => ({
  computeGroupSubsidized: () => ({
    subsidized: false,
    assignVoucher: false,
  }),
}))

const refreshGroupsMock = jest.fn().mockResolvedValue(undefined)
const refreshChangeLogMock = jest.fn().mockResolvedValue(undefined)
const refreshUnconfirmedMock = jest.fn().mockResolvedValue(undefined)

const createGroupRecordsMock = jest.fn()
const confirmChangeLogEntriesMock = jest.fn().mockResolvedValue(undefined)
const logChangeLogEntryMock = jest.fn().mockResolvedValue(undefined)

jest.mock('@/utils/supabase', () => ({
  createBrowserClient: () => createBrowserClientMock(),
}))

jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => useAuthMock(),
}))

jest.mock('@/hooks/useSubsidyLogic', () => ({
  useSubsidyLogic: () => useSubsidyLogicMock(),
}))

jest.mock(
  '@/components/admin/groups-management/hooks/useGroupsDataOrchestration',
  () => ({
    useGroupsDataOrchestration: () => ({
      loading: false,
      refreshChangeLog: refreshChangeLogMock,
      refreshGroups: refreshGroupsMock,
      refreshUnconfirmed: refreshUnconfirmedMock,
    }),
  }),
)

jest.mock(
  '@/components/admin/groups-management/hooks/useGroupsDerivedData',
  () => ({
    useGroupsDerivedData: () => ({
      filteredGroups: [],
      formatChangeLogEntry: jest.fn(),
      sortedChangeLog: [],
      sortedCorralRiders: [],
      sortedGroups: [],
      sortedUnmatchedRiders: [],
    }),
  }),
)

jest.mock(
  '@/components/admin/groups-management/services/groupsWriteService',
  () => ({
    confirmChangeLogEntries: (...args: unknown[]) =>
      confirmChangeLogEntriesMock(...args),
    createGroupRecords: (...args: unknown[]) => createGroupRecordsMock(...args),
    deleteGroupRecords: jest.fn(),
    deleteRiderMatches: jest.fn(),
    fetchRiderByFlightId: jest.fn(),
    logChangeLogEntry: (...args: unknown[]) => logChangeLogEntryMock(...args),
    markFlightsMatchedState: jest.fn(),
    normalizeVoucherInput: (voucher: string) => {
      const trimmed = voucher.trim()
      if (!trimmed) return ''
      return trimmed.startsWith('https://r.uber.com/')
        ? trimmed
        : `https://r.uber.com/${trimmed.replace(/^\/+/, '')}`
    },
    removeGroupMatch: jest.fn(),
    saveGroupOverrideRecords: jest.fn(),
    updateFlightRecord: jest.fn(),
    updateGroupMatchesMetadata: jest.fn(),
    updateGroupTimeRecords: jest.fn(),
    updateGroupVoucherRecords: jest.fn(),
    upsertManualGroupMatch: jest.fn(),
  }),
)

jest.mock(
  '@/components/admin/groups-management/FiltersPanel',
  () =>
    function MockFiltersPanel() {
      return <div>Filters panel</div>
    },
)

jest.mock(
  '@/components/admin/groups-management/ChangeLogPanel',
  () =>
    function MockChangeLogPanel() {
      return <div>Change log panel</div>
    },
)

jest.mock(
  '@/components/admin/groups-management/CorralPanel',
  () =>
    function MockCorralPanel() {
      return <div>Corral panel</div>
    },
)

jest.mock(
  '@/components/admin/groups-management/MatchedGroupsPanel',
  () =>
    function MockMatchedGroupsPanel() {
      return <div>Matched groups panel</div>
    },
)

jest.mock(
  '@/components/admin/groups-management/UnmatchedRidersPanel',
  () =>
    function MockUnmatchedRidersPanel() {
      return <div>Unmatched riders panel</div>
    },
)

jest.mock(
  '@/components/admin/groups-management/GroupsManagementModals',
  () =>
    function MockGroupsManagementModals() {
      return null
    },
)

jest.mock('@/components/admin/groups-management/CreateGroupPanel', () => {
  const React = require('react')
  const {
    useGroupsActionsContext,
  } = require('@/components/admin/groups-management/context/GroupsActionsContext')
  const {
    useGroupsUiContext,
  } = require('@/components/admin/groups-management/context/GroupsUiContext')

  const riderOne = {
    user_id: 'student-1',
    flight_id: 101,
    name: 'Taylor Student',
    phone: '',
    checked_bags: 1,
    carry_on_bags: 1,
    time_range: '',
    airport: 'LAX',
    to_airport: true,
    date: '',
    school: 'Pomona',
  }

  const riderTwo = {
    user_id: 'student-2',
    flight_id: 102,
    name: 'Jordan Student',
    phone: '',
    checked_bags: 0,
    carry_on_bags: 1,
    time_range: '',
    airport: 'LAX',
    to_airport: true,
    date: '',
    school: 'Pomona',
  }

  return function MockCreateGroupPanel() {
    const actions = useGroupsActionsContext()
    const ui = useGroupsUiContext()

    return (
      <div>
        <div data-testid="draft-count">
          {ui.selectedRidersForNewGroup.length}
        </div>
        {ui.errorMessage && <div>{ui.errorMessage}</div>}
        <button onClick={() => actions.addRiderToNewGroup(riderOne)}>
          Add Rider One
        </button>
        <button onClick={() => actions.addRiderToNewGroup(riderTwo)}>
          Add Rider Two
        </button>
        <button onClick={() => ui.setNewGroupDate('2026-01-22')}>
          Set Group Date
        </button>
        <button onClick={() => ui.setNewGroupTime('13:15')}>
          Set Group Time
        </button>
        <button onClick={() => void actions.createNewGroup()}>
          Trigger Create Group
        </button>
      </div>
    )
  }
})

import GroupsManagement from '@/components/admin/GroupsManagement'

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
} as any

const randomUuidMock = jest.fn(() => 'batch-uuid-1')

const openCreateGroupPanel = async () => {
  await userEvent.click(screen.getByTitle(/Expand sidebar/i))
  const createGroupButtons = screen.getAllByRole('button', {
    name: 'Create Group',
  })
  await userEvent.click(createGroupButtons[0])
}

describe('GroupsManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(globalThis, 'crypto', {
      value: {
        randomUUID: randomUuidMock,
      },
      configurable: true,
    })
    createGroupRecordsMock.mockResolvedValue({
      rideId: 555,
      normalizedVoucher: '',
    })
  })

  it('shows a validation error when creating a group with too few riders', async () => {
    render(<GroupsManagement user={adminUser} />)

    await openCreateGroupPanel()
    await userEvent.click(
      screen.getByRole('button', { name: /Trigger Create Group/i }),
    )

    expect(
      (await screen.findAllByText('Group must have 2-6 riders')).length,
    ).toBeGreaterThan(0)
    expect(createGroupRecordsMock).not.toHaveBeenCalled()
  })

  it('shows a validation error when the group date is missing', async () => {
    render(<GroupsManagement user={adminUser} />)

    await openCreateGroupPanel()
    await userEvent.click(
      screen.getByRole('button', { name: /Add Rider One/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Add Rider Two/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Trigger Create Group/i }),
    )

    expect(
      (await screen.findAllByText('Date is required')).length,
    ).toBeGreaterThan(0)
    expect(createGroupRecordsMock).not.toHaveBeenCalled()
  })

  it('creates a group and logs the create-group change on success', async () => {
    render(<GroupsManagement user={adminUser} />)

    await openCreateGroupPanel()
    await userEvent.click(
      screen.getByRole('button', { name: /Add Rider One/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Add Rider Two/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Set Group Date/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Set Group Time/i }),
    )
    await userEvent.click(
      screen.getByRole('button', { name: /Trigger Create Group/i }),
    )

    await waitFor(() =>
      expect(createGroupRecordsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rideDate: '2026-01-22',
          formattedTime: '13:15:00',
          riders: expect.arrayContaining([
            expect.objectContaining({ user_id: 'student-1', flight_id: 101 }),
            expect.objectContaining({ user_id: 'student-2', flight_id: 102 }),
          ]),
          isSubsidized: false,
        }),
      ),
    )

    await waitFor(() =>
      expect(logChangeLogEntryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE_GROUP',
          targetGroupId: 555,
        }),
      ),
    )
    await waitFor(() => expect(refreshGroupsMock).toHaveBeenCalled())
    expect(confirmChangeLogEntriesMock).not.toHaveBeenCalled()
  })
})
