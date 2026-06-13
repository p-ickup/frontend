import { render, screen } from '@testing-library/react'

const rider = {
  user_id: 'student-1',
  flight_id: 101,
  name: 'Taylor Student',
  phone: '555-0100',
  checked_bags: 1,
  carry_on_bags: 1,
  time_range: '08:00 - 09:00',
  airport: 'LAX',
  to_airport: true,
  date: '2026-06-20',
  school: 'Pomona',
}

jest.mock('./context', () => ({
  useGroupsActionsContext: () => ({
    addRiderToNewGroup: jest.fn(),
    handleAddToCorral: jest.fn(),
    openEditRider: jest.fn(),
  }),
  useGroupsDataContext: () => ({ sortedUnmatchedRiders: [rider] }),
  useGroupsUiContext: () => ({
    recentlyAddedToNewGroup: new Set(),
    selectedRidersForNewGroup: [],
    setDragOverGroupId: jest.fn(),
    setDraggedRider: jest.fn(),
  }),
}))

import UnmatchedRidersPanel from './UnmatchedRidersPanel'

describe('UnmatchedRidersPanel pending state', () => {
  it('shows saving feedback and blocks duplicate actions', () => {
    render(<UnmatchedRidersPanel pendingFlightIds={new Set([101])} />)

    expect(screen.getByText('Saving')).toBeInTheDocument()
    expect(
      screen.getByText('Taylor Student').closest('[aria-busy="true"]'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add to corral' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Add to new group' }),
    ).toBeDisabled()
    expect(screen.getByTitle('Edit rider details')).toBeDisabled()
  })
})
