'use client'

import { createContext, useContext } from 'react'

import type {
  ChangeLogEntry,
  ChangedGroup,
  Group,
  Rider,
  UnmatchedIndividual,
} from '../types'
import type { FormattedChangeLogEntry } from '../utils'

export interface GroupsDataContextValue {
  availableAirports: string[]
  changeLog: ChangeLogEntry[]
  changedGroups: ChangedGroup[]
  corralRiders: Rider[]
  formatChangeLogEntry: (entry: ChangeLogEntry) => FormattedChangeLogEntry
  groups: Group[]
  lastAlgorithmRunDate: string | null
  sortedChangeLog: ChangeLogEntry[]
  sortedCorralRiders: Rider[]
  sortedGroups: Group[]
  sortedUnmatchedRiders: Rider[]
  unmatchedIndividuals: UnmatchedIndividual[]
  unmatchedRiders: Rider[]
}

const GroupsDataContext = createContext<GroupsDataContextValue | null>(null)

export const useGroupsDataContext = () => {
  const context = useContext(GroupsDataContext)

  if (!context) {
    throw new Error('useGroupsDataContext must be used inside GroupsManagement')
  }

  return context
}

export default GroupsDataContext
