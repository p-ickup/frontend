'use client'

import { createContext, useContext } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import type {
  ChangeLogSortBy,
  ChangeLogSortDirection,
  EditRiderForm,
  Group,
  Rider,
  SortingRule,
  TimeConflictModalState,
  ValidationErrorModalState,
} from '../types'

type SetState<T> = Dispatch<SetStateAction<T>>
type SubsidyFilter = 'subsidized' | 'unsubsidized' | 'all'

export interface GroupsUiContextValue {
  autoCalculateError: string | null
  changeLogExpanded: boolean
  changeLogFilterActions: Set<string>
  changeLogFilterDateFrom: string
  changeLogFilterDateTo: string
  changeLogFilterName: string
  changeLogFilterSubjectName: string
  changeLogHeight: number
  changeLogOptionsExpanded: boolean
  changeLogSortBy: ChangeLogSortBy
  changeLogSortDirection: ChangeLogSortDirection
  confirmingGroups: Set<number>
  confirmingIndividuals: Set<string>
  corralCardErrors: Map<string, string>
  corralCollapsed: boolean
  corralSelectionMode: number | null
  corralTab: 'riders' | 'changes'
  dateRangeEnd: string
  dateRangeStart: string
  deleteGroupConfirmation: {
    rider: Rider
    groupId: number
    callback: () => Promise<void>
  } | null
  dragOverGroupId: number | null
  dragOverSortIndex: number | null
  draggedRider: Rider | null
  draggedSortIndex: number | null
  editDateValue: string
  editGroupOverridesModal: { group: Group } | null
  editRiderForm: EditRiderForm | null
  editRiderModal: { rider: Rider } | null
  editTimeModal: { group: Group } | null
  editTimeValue: string
  editVoucherModal: { group: Group } | null
  editVoucherValue: string
  errorMessage: string | null
  expandedGroups: Set<number>
  filterDirectionFrom: boolean
  filterDirectionTo: boolean
  isAddRiderOpen: boolean
  isCreatingGroup: boolean
  isDraggingOverCorral: boolean
  isSubsidized: boolean
  isUpdatingOverrides: boolean
  isUpdatingRider: boolean
  isUpdatingTime: boolean
  isUpdatingVoucher: boolean
  leftSidebarTabs: Array<'filters' | 'createGroup'>
  maxBags: string
  minBags: string
  newGroupContingencyVoucher: string
  newGroupDate: string
  newGroupSectionExpanded: boolean
  newGroupTime: string
  newGroupVoucher: string
  overrideSubsidized: 'auto' | 'yes' | 'no'
  overrideUberType: 'auto' | 'X' | 'XL' | 'XXL' | 'Connect'
  recentlyAddedToNewGroup: Set<string>
  resizeStartRef: MutableRefObject<{ y: number; height: number } | null>
  selectedAirports: string[]
  selectedRidersForNewGroup: Rider[]
  selectedUberTypes: Set<string>
  setAutoCalculateError: SetState<string | null>
  setChangeLogExpanded: SetState<boolean>
  setChangeLogFilterActions: SetState<Set<string>>
  setChangeLogFilterName: SetState<string>
  setChangeLogFilterSubjectName: SetState<string>
  setChangeLogOptionsExpanded: SetState<boolean>
  setChangeLogSortBy: SetState<ChangeLogSortBy>
  setChangeLogSortDirection: SetState<ChangeLogSortDirection>
  setConfirmingGroups: SetState<Set<number>>
  setConfirmingIndividuals: SetState<Set<string>>
  setCorralSelectionMode: SetState<number | null>
  setCorralTab: SetState<'riders' | 'changes'>
  setDateRangeEnd: SetState<string>
  setDateRangeStart: SetState<string>
  setDragOverGroupId: SetState<number | null>
  setDragOverSortIndex: SetState<number | null>
  setDraggedRider: SetState<Rider | null>
  setDraggedSortIndex: SetState<number | null>
  setEditDateValue: SetState<string>
  setEditGroupOverridesModal: SetState<{ group: Group } | null>
  setEditRiderForm: SetState<EditRiderForm | null>
  setEditTimeValue: SetState<string>
  setEditVoucherValue: SetState<string>
  setErrorMessage: SetState<string | null>
  setFilterDirectionFrom: SetState<boolean>
  setFilterDirectionTo: SetState<boolean>
  setIsAddRiderOpen: SetState<boolean>
  setIsDraggingOverCorral: SetState<boolean>
  setIsResizingChangeLog: SetState<boolean>
  setIsSubsidized: SetState<boolean>
  setMaxBags: SetState<string>
  setMinBags: SetState<string>
  setNewGroupContingencyVoucher: SetState<string>
  setNewGroupDate: SetState<string>
  setNewGroupSectionExpanded: SetState<boolean>
  setNewGroupTime: SetState<string>
  setNewGroupVoucher: SetState<string>
  setOverrideSubsidized: SetState<'auto' | 'yes' | 'no'>
  setOverrideUberType: SetState<'auto' | 'X' | 'XL' | 'XXL' | 'Connect'>
  setSelectedUberTypes: SetState<Set<string>>
  setSortingRules: SetState<SortingRule[]>
  setSubsidyFilter: SetState<SubsidyFilter>
  setTimeConflictModal: SetState<TimeConflictModalState | null>
  setTimeRangeEnd: SetState<string>
  setTimeRangeStart: SetState<string>
  sortingRules: SortingRule[]
  subsidyFilter: SubsidyFilter
  timeConflictModal: TimeConflictModalState | null
  timeRangeEnd: string
  timeRangeStart: string
  validationErrorModal: ValidationErrorModalState | null
}

const GroupsUiContext = createContext<GroupsUiContextValue | null>(null)

export const useGroupsUiContext = () => {
  const context = useContext(GroupsUiContext)

  if (!context) {
    throw new Error('useGroupsUiContext must be used inside GroupsManagement')
  }

  return context
}

export default GroupsUiContext
