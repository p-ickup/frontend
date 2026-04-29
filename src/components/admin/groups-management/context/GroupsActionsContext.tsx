'use client'

import { createContext, useContext } from 'react'
import type { Dispatch, SetStateAction } from 'react'

import type {
  ChangeLogEntry,
  ChangedGroup,
  Group,
  Rider,
  UnmatchedIndividual,
} from '../types'

type SetState<T> = Dispatch<SetStateAction<T>>

export interface GroupsActionsContextValue {
  addRiderToNewGroup: (rider: Rider) => void
  clearChangeLogFilters: () => void
  clearDraftGroup: () => void
  closeDeleteGroupConfirmation: () => void
  closeEditRider: () => void
  closeEditTime: () => void
  closeEditVoucher: () => void
  createNewGroup: () => Promise<void>
  fetchChangeLog: () => Promise<void>
  fetchData: () => Promise<void>
  handleAddFromCorral: (group: Group) => void
  handleAddToCorral: (rider: Rider, fromGroupId?: number) => Promise<void>
  handleCorralToggle: () => void
  handleFiltersToggle: () => void
  handleRemoveFromCorral: (rider: Rider) => void
  handleRemoveFromCorralToUnmatched: (rider: Rider) => Promise<void>
  handleRemoveFromGroupToUnmatched: (
    rider: Rider,
    groupId: number,
  ) => Promise<void>
  handleSaveGroupOverrides: (
    group: Group,
    subsidized: 'auto' | 'yes' | 'no',
    uberType: 'auto' | 'X' | 'XL' | 'XXL' | 'Connect',
  ) => Promise<void>
  handleSelectFromCorral: (
    rider: Rider,
    group: Group,
    skipValidation?: boolean,
    explicitSourceGroupId?: number,
    customTime?: string,
    customDate?: string,
  ) => Promise<void>
  handleUpdateGroupTime: (
    groupId: number,
    newTime: string,
    newDate?: string,
  ) => Promise<void>
  handleUpdateGroupVoucher: (
    groupId: number,
    newVoucher: string,
  ) => Promise<void>
  handleUpdateRider: (
    flightId: number,
    updates: {
      flight_no?: string
      airline_iata?: string
      airport?: string
      to_airport?: boolean
      date?: string
      time_range?: string
    },
  ) => Promise<void>
  loadUnconfirmedChanges: () => Promise<void>
  logToChangeLog: (
    action: ChangeLogEntry['action'],
    metadata?: any,
    targetGroupId?: number,
    targetUserId?: string,
    confirmed?: boolean,
  ) => Promise<void>
  openEditGroupOverrides: (group: Group) => void
  openEditRider: (rider: Rider) => void
  openEditTime: (group: Group) => void
  openEditVoucher: (group: Group) => void
  removeRiderFromNewGroup: (flightId: number) => void
  setChangeLogDateRange: (from: string, to: string) => void
  setChangedGroups: SetState<ChangedGroup[]>
  setCorralRiders: SetState<Rider[]>
  setUnmatchedIndividuals: SetState<UnmatchedIndividual[]>
  setUnmatchedRiders: SetState<Rider[]>
  supabase: any
  toggleAirport: (airport: string) => void
  toggleGroupExpanded: (rideId: number) => void
}

const GroupsActionsContext = createContext<GroupsActionsContextValue | null>(
  null,
)

export const useGroupsActionsContext = () => {
  const context = useContext(GroupsActionsContext)

  if (!context) {
    throw new Error(
      'useGroupsActionsContext must be used inside GroupsManagement',
    )
  }

  return context
}

export default GroupsActionsContext
