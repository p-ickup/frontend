'use client'

import { useAuth } from '@/hooks/useAuth'
import { useSubsidyLogic } from '@/hooks/useSubsidyLogic'
import { createBrowserClient } from '@/utils/supabase'
import { Download, Info, Loader2, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ChangeLogPanel from './groups-management/ChangeLogPanel'
import CorralPanel from './groups-management/CorralPanel'
import CreateGroupPanel from './groups-management/CreateGroupPanel'
import FiltersPanel from './groups-management/FiltersPanel'
import {
  GroupsActionsContext,
  GroupsDataContext,
  GroupsUiContext,
} from './groups-management/context'
import GroupsManagementModals from './groups-management/GroupsManagementModals'
import { useGroupsContextValues } from './groups-management/hooks/useGroupsContextValues'
import { useGroupsDataOrchestration } from './groups-management/hooks/useGroupsDataOrchestration'
import { useGroupsDerivedData } from './groups-management/hooks/useGroupsDerivedData'
import MatchedGroupsPanel from './groups-management/MatchedGroupsPanel'
import {
  confirmChangeLogEntries,
  createGroupRecords,
  deleteGroupRecords,
  fetchRiderByFlightId,
  logChangeLogEntry,
  moveRiderToGroup,
  moveRiderToCorral,
  setMatchingStatus,
  normalizeVoucherInput,
  removeGroupMatch,
  removeRiderToUnmatched,
  saveGroupOverrideRecords,
  updateFlightRecord,
  updateGroupMatchesMetadata,
  updateGroupTimeRecords,
  updateGroupVoucherRecords,
} from './groups-management/services/groupsWriteService'
import type {
  ChangeLogEntry,
  ChangedGroup,
  EditRiderForm,
  Group,
  Rider,
  SortingRule,
  TimeConflictModalState,
  UnmatchedIndividual,
  ValidationErrorModalState,
} from './groups-management/types'
import {
  calculateBagUnits,
  calculateGroupTimeRange,
  calculateTimeMidpoint,
  consolidateChangeDescriptions,
  determineUberType,
  formatVoucher,
  getChangeDescription,
  getOverrideSelections,
  getTotalBags,
  getUberType,
  isGroupSubsidized,
  matchDatetimeFromEarliest,
  normalizeDateToYYYYMMDD,
  timeToMinutes,
  validateTimeCompatibility,
} from './groups-management/utils'
import UnmatchedRidersPanel from './groups-management/UnmatchedRidersPanel'

export default function GroupsManagement() {
  const supabase = useMemo(() => createBrowserClient(), [])
  const { user } = useAuth()
  const { computeGroupSubsidized } = useSubsidyLogic()
  const [, setAdminScope] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'matched' | 'unmatched'>('matched')
  const [selectedAirports, setSelectedAirports] = useState<string[]>([])
  const [filterDirectionTo, setFilterDirectionTo] = useState<boolean>(true)
  const [filterDirectionFrom, setFilterDirectionFrom] = useState<boolean>(true)
  const [availableAirports, setAvailableAirports] = useState<string[]>([])
  const [dateRangeStart, setDateRangeStart] = useState<string>('')
  const [dateRangeEnd, setDateRangeEnd] = useState<string>('')
  const [timeRangeStart, setTimeRangeStart] = useState<string>('')
  const [timeRangeEnd, setTimeRangeEnd] = useState<string>('')
  const [subsidyFilter, setSubsidyFilter] = useState<
    'subsidized' | 'unsubsidized' | 'all'
  >('all')
  const [selectedUberTypes, setSelectedUberTypes] = useState<Set<string>>(
    () => new Set(['X', 'XL', 'XXL', 'Connect']),
  )
  const [minBags, setMinBags] = useState<string>('')
  const [maxBags, setMaxBags] = useState<string>('')
  const [lastAlgorithmRunDate, setLastAlgorithmRunDate] = useState<
    string | null
  >(null)
  const [sortingRules, setSortingRules] = useState<SortingRule[]>([])
  const [draggedSortIndex, setDraggedSortIndex] = useState<number | null>(null)
  const [dragOverSortIndex, setDragOverSortIndex] = useState<number | null>(
    null,
  )
  const [groups, setGroups] = useState<Group[]>([])
  const [unmatchedRiders, setUnmatchedRiders] = useState<Rider[]>([])
  const [corralRiders, setCorralRiders] = useState<Rider[]>([])
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())
  const [changeLogExpanded, setChangeLogExpanded] = useState(false)
  const [changeLog, setChangeLog] = useState<ChangeLogEntry[]>([])
  const [changeLogOptionsExpanded, setChangeLogOptionsExpanded] =
    useState(false)
  const [changeLogHeight, setChangeLogHeight] = useState(256) // Default height in pixels
  const [changeLogFilterName, setChangeLogFilterName] = useState<string>('')
  /** Filter changelog by the rider/person affected (metadata names), not the admin actor */
  const [changeLogFilterSubjectName, setChangeLogFilterSubjectName] =
    useState<string>('')
  const [changeLogFilterRideId, setChangeLogFilterRideId] = useState<string>('')
  const [changeLogFilterActions, setChangeLogFilterActions] = useState<
    Set<string>
  >(new Set())
  const [changeLogFilterDateFrom, setChangeLogFilterDateFrom] =
    useState<string>('')
  const [changeLogFilterDateTo, setChangeLogFilterDateTo] = useState<string>('')
  const [changeLogSortBy, setChangeLogSortBy] = useState<
    'date' | 'actor' | 'action'
  >('date')
  const [changeLogSortDirection, setChangeLogSortDirection] = useState<
    'asc' | 'desc'
  >('desc')
  const [isResizingChangeLog, setIsResizingChangeLog] = useState(false)
  const resizeStartRef = useRef<{ y: number; height: number } | null>(null)
  const [draggedRider, setDraggedRider] = useState<Rider | null>(null)
  const [isDraggingOverCorral, setIsDraggingOverCorral] = useState(false)
  const [dragOverGroupId, setDragOverGroupId] = useState<number | null>(null)
  // Start collapsed by default (will expand on desktop)
  const [filtersCollapsed, setFiltersCollapsed] = useState(true)
  const [corralCollapsed, setCorralCollapsed] = useState(true)
  const [corralSelectionMode, setCorralSelectionMode] = useState<number | null>(
    null,
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingRiderOperations, setPendingRiderOperations] = useState<
    Set<number>
  >(new Set())
  const [newGroupSectionExpanded, setNewGroupSectionExpanded] = useState(false)
  const [selectedRidersForNewGroup, setSelectedRidersForNewGroup] = useState<
    Rider[]
  >([])
  const [recentlyAddedToNewGroup, setRecentlyAddedToNewGroup] = useState<
    Set<string>
  >(new Set())
  const [newGroupDate, setNewGroupDate] = useState<string>('')
  const [newGroupTime, setNewGroupTime] = useState<string>('')
  const [newGroupVoucher, setNewGroupVoucher] = useState<string>('')
  const [newGroupContingencyVoucher, setNewGroupContingencyVoucher] =
    useState<string>('')
  const [isSubsidized, setIsSubsidized] = useState<boolean>(false)
  const [isCreatingGroup, setIsCreatingGroup] = useState(false)
  const [deleteGroupConfirmation, setDeleteGroupConfirmation] = useState<{
    rider: Rider
    groupId: number
    callback: () => Promise<void>
  } | null>(null)
  const [editTimeModal, setEditTimeModal] = useState<{
    group: Group
  } | null>(null)
  const [editTimeValue, setEditTimeValue] = useState<string>('')
  const [editDateValue, setEditDateValue] = useState<string>('')
  const [isUpdatingTime, setIsUpdatingTime] = useState(false)
  const [editRiderModal, setEditRiderModal] = useState<{ rider: Rider } | null>(
    null,
  )
  const [editRiderForm, setEditRiderForm] = useState<EditRiderForm | null>(null)
  const [isUpdatingRider, setIsUpdatingRider] = useState(false)
  const [editVoucherModal, setEditVoucherModal] = useState<{
    group: Group
  } | null>(null)
  const [editVoucherValue, setEditVoucherValue] = useState<string>('')
  const [isUpdatingVoucher, setIsUpdatingVoucher] = useState(false)
  const [editGroupOverridesModal, setEditGroupOverridesModal] = useState<{
    group: Group
  } | null>(null)
  const [overrideSubsidized, setOverrideSubsidized] = useState<
    'auto' | 'yes' | 'no'
  >('auto')
  const [overrideUberType, setOverrideUberType] = useState<
    'auto' | 'X' | 'XL' | 'XXL' | 'Connect'
  >('auto')
  const [isUpdatingOverrides, setIsUpdatingOverrides] = useState(false)
  const [timeConflictModal, setTimeConflictModal] =
    useState<TimeConflictModalState | null>(null)
  const [validationErrorModal, setValidationErrorModal] =
    useState<ValidationErrorModalState | null>(null)
  const [isAddRiderOpen, setIsAddRiderOpen] = useState(false)
  const [corralTab, setCorralTab] = useState<'riders' | 'changes'>('riders')
  const [changedGroups, setChangedGroups] = useState<ChangedGroup[]>([])
  const [unmatchedIndividuals, setUnmatchedIndividuals] = useState<
    UnmatchedIndividual[]
  >([])
  const [leftSidebarTabs] = useState<Array<'filters' | 'createGroup'>>([
    'filters',
    'createGroup',
  ])
  const [activeLeftTab, setActiveLeftTab] = useState<'filters' | 'createGroup'>(
    'filters',
  )
  const [autoCalculateError, setAutoCalculateError] = useState<string | null>(
    null,
  )
  const [corralCardErrors] = useState<Map<string, string>>(new Map())
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchInput, setSearchInput] = useState<string>('')
  const [searchFeedback, setSearchFeedback] = useState(false)
  const [confirmingGroups, setConfirmingGroups] = useState<Set<number>>(
    new Set(),
  )
  const [confirmingIndividuals, setConfirmingIndividuals] = useState<
    Set<string>
  >(new Set())

  const {
    changeLogHasMore,
    changeLogLoading,
    error,
    goToPage,
    loadMoreChangeLog,
    loading,
    page,
    pendingChangesLoading,
    refreshChangeLog: fetchChangeLog,
    refreshGroups: fetchData,
    refreshUnconfirmed: loadUnconfirmedChanges,
    refreshing,
    totalPages,
    totalRecords,
  } = useGroupsDataOrchestration({
    changeLogExpanded,
    corralTab,
    dateRangeEnd,
    dateRangeStart,
    groups,
    isResizingChangeLog,
    resizeStartRef,
    setAdminScope,
    setAvailableAirports,
    setChangeLog,
    setChangeLogHeight,
    setChangedGroups,
    setCorralCollapsed,
    setDateRangeEnd,
    setDateRangeStart,
    setFiltersCollapsed,
    setGroups,
    setIsResizingChangeLog,
    setLastAlgorithmRunDate,
    setSelectedAirports,
    setUnmatchedIndividuals,
    setUnmatchedRiders,
    supabase,
  })

  const mergeChangeLogEntries = useCallback(
    (entries?: ChangeLogEntry[]) => {
      const validEntries = entries?.filter(Boolean) ?? []
      if (validEntries.length === 0) return

      setChangeLog((current) => {
        const visibleLimit =
          current.length >= 100
            ? current.length
            : current.length + validEntries.length
        const deduped = Array.from(
          new Map(
            [...validEntries, ...current].map(
              (entry) => [entry.id, entry] as const,
            ),
          ).values(),
        )

        return deduped
          .sort(
            (left, right) =>
              new Date(right.created_at).getTime() -
              new Date(left.created_at).getTime(),
          )
          .slice(0, visibleLimit)
      })
    },
    [setChangeLog],
  )

  // Helper function to log changes to ChangeLog
  const logToChangeLog = useCallback(
    async (
      action: ChangeLogEntry['action'],
      metadata?: any,
      targetGroupId?: number,
      targetUserId?: string,
      confirmed: boolean = false,
      changeBatchId?: string,
    ) => {
      if (!user) return

      const entry = await logChangeLogEntry({
        supabase,
        actorUserId: user.id,
        action,
        metadata,
        targetGroupId,
        targetUserId,
        changeBatchId,
        confirmed,
      })

      if (changeLogExpanded) {
        mergeChangeLogEntries([entry])
      }
    },
    [changeLogExpanded, mergeChangeLogEntries, user, supabase],
  )

  const closeDeleteGroupConfirmation = useCallback(() => {
    setDeleteGroupConfirmation(null)
  }, [])

  const closeEditTime = useCallback(() => {
    setEditTimeModal(null)
    setEditTimeValue('')
    setEditDateValue('')
  }, [])

  const closeEditRider = useCallback(() => {
    setEditRiderModal(null)
    setEditRiderForm(null)
  }, [])

  const closeEditVoucher = useCallback(() => {
    setEditVoucherModal(null)
    setEditVoucherValue('')
  }, [])

  const setChangeLogDateRange = useCallback((from: string, to: string) => {
    setChangeLogFilterDateFrom(from)
    setChangeLogFilterDateTo(to)
  }, [])

  const clearChangeLogFilters = useCallback(() => {
    setChangeLogFilterName('')
    setChangeLogFilterSubjectName('')
    setChangeLogFilterRideId('')
    setChangeLogFilterActions(new Set())
    setChangeLogDateRange('', '')
  }, [setChangeLogDateRange])

  const clearDraftGroup = useCallback(() => {
    setSelectedRidersForNewGroup([])
    setRecentlyAddedToNewGroup(new Set())
    setNewGroupDate('')
    setNewGroupTime('')
    setNewGroupVoucher('')
    setNewGroupContingencyVoucher('')
    setIsSubsidized(false)
    setNewGroupSectionExpanded(false)
    setAutoCalculateError(null)
  }, [])

  // Update group time and date for all members
  const handleUpdateGroupTime = useCallback(
    async (groupId: number, newTime: string, newDate?: string) => {
      if (!newTime || !newTime.includes(':')) {
        setErrorMessage('Invalid time format. Please use HH:MM format.')
        setTimeout(() => setErrorMessage(null), 3000)
        return
      }

      setIsUpdatingTime(true)
      try {
        const { formattedTime } = await updateGroupTimeRecords({
          supabase,
          groupId,
          newTime,
          newDate,
        })

        // Get old group data before updating state (for ChangeLog)
        const oldGroup = groups.find((g) => g.ride_id === groupId)

        // Log to ChangeLog (only once, outside of state setter)
        if (oldGroup) {
          const logMetadata: any = {
            ride_id: groupId, // Store as number in metadata
            old_time: oldGroup.match_time || 'N/A',
            new_time: formattedTime,
            rider_count: oldGroup.riders.length,
          }
          if (newDate) {
            logMetadata.old_date = oldGroup.date || 'N/A'
            logMetadata.new_date = newDate
          }
          await logToChangeLog(
            'UPDATE_GROUP_TIME',
            logMetadata,
            groupId, // Set target_group_id to the group that was changed
          )
        }

        // Update local state and track changes
        setGroups((prev) => {
          const updatedGroups = prev.map((g) => {
            if (g.ride_id === groupId) {
              const updates: Partial<Group> = { match_time: formattedTime }
              if (newDate) {
                updates.date = newDate
              }
              return { ...g, ...updates }
            }
            return g
          })
          return updatedGroups
        })

        // Track this as a changed group - use updated group from state
        setGroups((prevGroups) => {
          const updatedGroup = prevGroups.find((g) => g.ride_id === groupId)
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === groupId,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('UPDATE_GROUP_TIME')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === groupId
                    ? {
                        ...cg,
                        group: updatedGroup, // Update with latest group data
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [
                    getChangeDescription('UPDATE_GROUP_TIME'),
                  ],
                },
              ]
            })
          }
          return prevGroups
        })

        closeEditTime()
        setErrorMessage(null)
      } catch (error) {
        console.error('Error in handleUpdateGroupTime:', error)
        setErrorMessage('Failed to update group time')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingTime(false)
      }
    },
    [closeEditTime, supabase, logToChangeLog, groups],
  )

  // Update group voucher for all members
  const handleUpdateGroupVoucher = useCallback(
    async (groupId: number, newVoucher: string) => {
      if (!user) return

      setIsUpdatingVoucher(true)
      try {
        const { normalizedVoucher } = await updateGroupVoucherRecords({
          supabase,
          groupId,
          newVoucher,
        })

        // Update local state and track this as a changed group
        setGroups((prev) => {
          const updatedGroups = prev.map((g) =>
            g.ride_id === groupId
              ? { ...g, group_voucher: normalizedVoucher || undefined }
              : g,
          )

          // Track this as a changed group
          const updatedGroup = updatedGroups.find((g) => g.ride_id === groupId)
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === groupId,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('UPDATE_VOUCHER')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === groupId
                    ? {
                        ...cg,
                        group: updatedGroup,
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [getChangeDescription('UPDATE_VOUCHER')],
                },
              ]
            })
          }

          return updatedGroups
        })

        // Log to ChangeLog
        // Note: target_group_id expects UUID, but ride_id is a number
        // Storing ride_id in metadata instead
        await logToChangeLog(
          'UPDATE_VOUCHER',
          {
            group_id: groupId.toString(),
            ride_id: groupId, // Store as number in metadata
            voucher: normalizedVoucher || '',
          },
          groupId, // Set target_group_id to the group that was changed
        )

        closeEditVoucher()
        setErrorMessage(null)
      } catch (error) {
        console.error('Error in handleUpdateGroupVoucher:', error)
        setErrorMessage('Failed to update group voucher')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingVoucher(false)
      }
    },
    [closeEditVoucher, logToChangeLog, supabase, user],
  )

  const toggleAirport = useCallback((airport: string) => {
    setSelectedAirports((prev) =>
      prev.includes(airport)
        ? prev.filter((a) => a !== airport)
        : [...prev, airport],
    )
  }, [])

  const toggleGroupExpanded = useCallback((rideId: number) => {
    setExpandedGroups((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(rideId)) {
        newSet.delete(rideId)
      } else {
        newSet.add(rideId)
      }
      return newSet
    })
  }, [])

  const handleAddToCorral = useCallback(
    async (rider: Rider, fromGroupId?: number) => {
      if (fromGroupId) {
        try {
          // Find the group to get updated rider list
          const group = groups.find((g) => g.ride_id === fromGroupId)
          if (!group) {
            console.error('Group not found:', fromGroupId)
            return
          }

          const updatedRiders = group.riders.filter(
            (r) => r.flight_id !== rider.flight_id,
          )

          // Check if this is the last person in the group
          if (updatedRiders.length === 0) {
            // Show confirmation modal
            setDeleteGroupConfirmation({
              rider,
              groupId: fromGroupId,
              callback: async () => {
                await deleteGroupRecords({
                  supabase,
                  groupId: fromGroupId,
                })

                // Log to ChangeLog
                // Note: target_group_id expects UUID, but ride_id is a number
                // Storing ride_id in metadata instead
                await logToChangeLog(
                  'REMOVE_FROM_GROUP',
                  {
                    from_group: fromGroupId,
                    to: 'corral',
                    ride_id: fromGroupId, // Store as number in metadata
                    rider_name: rider.name,
                    rider_user_id: rider.user_id,
                    rider_flight_id: rider.flight_id,
                  },
                  fromGroupId, // Set target_group_id to the group that was changed
                  rider.user_id,
                )

                // Update local state - remove group and add rider to corral
                setGroups((prev) =>
                  prev.filter((g) => g.ride_id !== fromGroupId),
                )
                const riderWithOrigin: Rider = {
                  ...rider,
                  originType: 'group' as 'group' | 'unmatched',
                  originGroupId: fromGroupId,
                }
                setCorralRiders((prev) => [...prev, riderWithOrigin])
              },
            })
            return
          }

          const riderWithOrigin: Rider = {
            ...rider,
            originType: 'group' as 'group' | 'unmatched',
            originGroupId: fromGroupId,
          }
          setCorralRiders((prev) => [
            ...prev.filter((r) => r.flight_id !== rider.flight_id),
            riderWithOrigin,
          ])
          setGroups((prev) =>
            prev
              .map((g) =>
                g.ride_id === fromGroupId
                  ? {
                      ...g,
                      riders: g.riders.filter(
                        (r) => r.flight_id !== rider.flight_id,
                      ),
                      time_range: calculateGroupTimeRange(
                        g.riders.filter((r) => r.flight_id !== rider.flight_id),
                      ),
                    }
                  : g,
              )
              .filter((g) => g.riders.length > 0),
          )

          // Do NOT set Flights.matched = false when moving to corral; only set unmatched when user explicitly clicks "Remove from group" (to unmatched).

          // Only update if there are remaining riders (groups need at least 1 rider)
          let newUberType: string | null = null
          let newIsSubsidized: boolean | null = null
          if (updatedRiders.length > 0) {
            // Calculate new bag units and uber_type (preserve Connect if ride is Connect)
            const bagUnits = calculateBagUnits(updatedRiders)
            const isConnect = group.uber_type?.toLowerCase() === 'connect'
            const uberType = isConnect
              ? 'Connect'
              : determineUberType(updatedRiders.length, bagUnits)
            const { subsidized: isSubsidized } = computeGroupSubsidized({
              date: group.date,
              toAirport: group.to_airport,
              airport: group.airport,
              riderCount: updatedRiders.length,
              riderSchools: updatedRiders.map((r) => r.school),
              uberType: uberType ?? undefined,
            })

            // Respect manual overrides: use group's value when override is set
            const effectiveUberType = group.uber_type_override
              ? (group.uber_type ?? uberType)
              : uberType
            const hasVoucher = Boolean(group.group_voucher?.trim())
            const isConnectType =
              (effectiveUberType ?? group.uber_type)?.toLowerCase() ===
              'connect'
            const effectiveIsSubsidized = group.subsidized_override
              ? (group.is_subsidized ?? isSubsidized)
              : isSubsidized || hasVoucher || isConnectType

            if (effectiveUberType) {
              newUberType = effectiveUberType
              newIsSubsidized = effectiveIsSubsidized
            }
          }

          await moveRiderToCorral({
            supabase,
            groupId: fromGroupId,
            userId: rider.user_id,
            flightId: rider.flight_id,
            remainingGroupUpdates: newUberType
              ? {
                  uber_type: newUberType,
                  is_subsidized: newIsSubsidized,
                  is_verified: false,
                }
              : undefined,
            changeMetadata: {
              from_group: fromGroupId,
              to: 'corral',
              ride_id: fromGroupId,
              rider_name: rider.name,
              rider_user_id: rider.user_id,
              rider_flight_id: rider.flight_id,
            },
          })

          // Only update local state after successful database operations
          setCorralRiders((prev) => [
            ...prev.filter((r) => r.flight_id !== rider.flight_id),
            riderWithOrigin,
          ])

          // Remove from group (local state) and track changes
          setGroups((prev) => {
            const updatedGroups = prev.map((g) =>
              g.ride_id === fromGroupId
                ? {
                    ...g,
                    riders: g.riders.filter(
                      (r) => r.flight_id !== rider.flight_id,
                    ),
                    uber_type: newUberType || g.uber_type, // Update uber_type (always a string, defaults to 'XXL*' for invalid)
                    is_subsidized: newIsSubsidized ?? g.is_subsidized,
                  }
                : g,
            )
            return updatedGroups
          })

          // Track this as a changed group
          setGroups((prevGroups) => {
            const updatedGroup = prevGroups.find(
              (g) => g.ride_id === fromGroupId,
            )
            if (updatedGroup) {
              setChangedGroups((prevChanged) => {
                const existing = prevChanged.find(
                  (cg) => cg.group.ride_id === fromGroupId,
                )
                if (existing) {
                  // Merge new change description with existing ones
                  const newDescription =
                    getChangeDescription('REMOVE_FROM_GROUP')
                  const existingDescriptions = existing.changeDescriptions || []
                  const updatedDescriptions = consolidateChangeDescriptions([
                    ...existingDescriptions,
                    newDescription,
                  ])
                  return prevChanged.map((cg) =>
                    cg.group.ride_id === fromGroupId
                      ? {
                          ...cg,
                          group: updatedGroup, // Update with latest group data
                          changedAt: new Date().toISOString(),
                          emailsSent: false,
                          changeDescriptions: updatedDescriptions,
                        }
                      : cg,
                  )
                }
                return [
                  ...prevChanged,
                  {
                    group: updatedGroup,
                    changeType: 'modified',
                    changedAt: new Date().toISOString(),
                    emailsSent: false,
                    changeDescriptions: [
                      getChangeDescription('REMOVE_FROM_GROUP'),
                    ],
                  },
                ]
              })
            }
            return prevGroups
          })
        } catch (error) {
          console.error('Error in handleAddToCorral:', error)
          setErrorMessage('Failed to remove rider from group')
          await fetchData()
          setTimeout(() => setErrorMessage(null), 3000)
        }
      } else {
        // Remove from unmatched (no database operations needed)
        const riderWithOrigin: Rider = {
          ...rider,
          originType: 'unmatched' as 'group' | 'unmatched',
          originGroupId: undefined,
        }
        setCorralRiders((prev) => [
          ...prev.filter((r) => r.flight_id !== rider.flight_id),
          riderWithOrigin,
        ])
        setUnmatchedRiders((prev) =>
          prev.filter((r) => r.flight_id !== rider.flight_id),
        )
      }
    },
    [groups, supabase, logToChangeLog, computeGroupSubsidized, fetchData],
  )

  // Update individual rider fields
  const handleUpdateRider = useCallback(
    async (
      flightId: number,
      updates: {
        flight_no?: string
        airline_iata?: string
        airport?: string
        to_airport?: boolean
        date?: string
        time_range?: string
      },
    ) => {
      setIsUpdatingRider(true)
      try {
        // Get current rider information before updating
        let oldRider: Rider | null = null
        let riderGroupId: number | undefined = undefined

        // Find rider in groups
        for (const group of groups) {
          const rider = group.riders.find((r) => r.flight_id === flightId)
          if (rider) {
            oldRider = rider
            riderGroupId = group.ride_id
            break
          }
        }

        // If not found in groups, check unmatched riders
        if (!oldRider) {
          const rider = unmatchedRiders.find((r) => r.flight_id === flightId)
          if (rider) {
            oldRider = rider
          }
        }

        // If still not found, fetch from database
        if (!oldRider) {
          oldRider = await fetchRiderByFlightId({
            supabase,
            flightId,
          })
        }

        await updateFlightRecord({
          supabase,
          flightId,
          updates,
        })

        // Log to ChangeLog
        if (oldRider) {
          const metadata: any = {
            rider_name: oldRider.name,
            rider_user_id: oldRider.user_id,
            rider_flight_id: flightId,
          }

          // Add old and new values for changed fields
          if (
            updates.flight_no !== undefined &&
            updates.flight_no !== oldRider.flight_no
          ) {
            metadata.old_flight_no = oldRider.flight_no || 'N/A'
            metadata.new_flight_no = updates.flight_no
          }
          if (
            updates.airline_iata !== undefined &&
            updates.airline_iata !== oldRider.airline_iata
          ) {
            metadata.old_airline_iata = oldRider.airline_iata || 'N/A'
            metadata.new_airline_iata = updates.airline_iata
          }
          if (
            updates.airport !== undefined &&
            updates.airport !== oldRider.airport
          ) {
            metadata.old_airport = oldRider.airport || 'N/A'
            metadata.new_airport = updates.airport
          }
          if (
            updates.to_airport !== undefined &&
            updates.to_airport !== oldRider.to_airport
          ) {
            metadata.old_to_airport = oldRider.to_airport
            metadata.new_to_airport = updates.to_airport
          }
          if (updates.date !== undefined && updates.date !== oldRider.date) {
            metadata.old_date = oldRider.date || 'N/A'
            metadata.new_date = updates.date
          }
          if (
            updates.time_range !== undefined &&
            updates.time_range !== oldRider.time_range
          ) {
            metadata.old_time_range = oldRider.time_range || 'N/A'
            metadata.new_time_range = updates.time_range
          }

          if (riderGroupId) {
            metadata.ride_id = riderGroupId
          }

          await logToChangeLog(
            'UPDATE_RIDER_DETAILS',
            metadata,
            riderGroupId,
            oldRider.user_id,
          )
        }

        const applyRiderUpdates = (rider: Rider): Rider =>
          rider.flight_id === flightId
            ? {
                ...rider,
                ...(updates.flight_no !== undefined
                  ? { flight_no: updates.flight_no }
                  : {}),
                ...(updates.airline_iata !== undefined
                  ? { airline_iata: updates.airline_iata }
                  : {}),
                ...(updates.airport !== undefined
                  ? { airport: updates.airport }
                  : {}),
                ...(updates.to_airport !== undefined
                  ? { to_airport: updates.to_airport }
                  : {}),
                ...(updates.date !== undefined ? { date: updates.date } : {}),
                ...(updates.time_range !== undefined
                  ? { time_range: updates.time_range }
                  : {}),
              }
            : rider

        setGroups((previous) =>
          previous.map((group) => ({
            ...group,
            riders: group.riders.map(applyRiderUpdates),
          })),
        )
        setUnmatchedRiders((previous) => previous.map(applyRiderUpdates))
        setCorralRiders((previous) => previous.map(applyRiderUpdates))

        closeEditRider()
        setErrorMessage(null)
      } catch (error) {
        console.error('Error in handleUpdateRider:', error)
        setErrorMessage('Failed to update rider details')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingRider(false)
      }
    },
    [closeEditRider, groups, unmatchedRiders, logToChangeLog, supabase],
  )

  const handleRemoveFromGroupToUnmatched = useCallback(
    async (rider: Rider, groupId: number) => {
      const group = groups.find((candidate) => candidate.ride_id === groupId)
      if (!group || pendingRiderOperations.has(rider.flight_id)) return

      const updatedRiders = group.riders.filter(
        (candidate) => candidate.flight_id !== rider.flight_id,
      )

      // Confirm deletion before changing any records when this is the last rider.
      if (updatedRiders.length === 0) {
        setDeleteGroupConfirmation({
          rider,
          groupId,
          callback: async () => {
            const allFlightIds = group.riders.map(
              (groupRider) => groupRider.flight_id,
            )
            setPendingRiderOperations(
              (previous) => new Set([...Array.from(previous), ...allFlightIds]),
            )
            setGroups((previous) =>
              previous.filter((candidate) => candidate.ride_id !== groupId),
            )
            setUnmatchedRiders((previous) => {
              const existingIds = new Set(
                previous.map((candidate) => candidate.flight_id),
              )
              return [
                ...previous,
                ...group.riders.filter(
                  (candidate) => !existingIds.has(candidate.flight_id),
                ),
              ]
            })

            try {
              await deleteGroupRecords({
                supabase,
                groupId,
                flightIds: allFlightIds,
                markFlightsUnmatched: true,
              })
              await logToChangeLog(
                'DELETE_GROUP',
                {
                  ride_id: groupId,
                  rider_name: rider.name,
                  rider_user_id: rider.user_id,
                },
                groupId,
              )
              setChangedGroups((previous) => [
                ...previous.filter(
                  (changed) => changed.group.ride_id !== groupId,
                ),
                {
                  group,
                  changeType: 'deleted',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                },
              ])
              setUnmatchedIndividuals((previous) => {
                const existingIds = new Set(
                  previous.map((entry) => entry.rider.flight_id),
                )
                return [
                  ...previous,
                  ...group.riders
                    .filter(
                      (groupRider) => !existingIds.has(groupRider.flight_id),
                    )
                    .map((groupRider) => ({
                      rider: groupRider,
                      becameUnmatchedAt: new Date().toISOString(),
                      emailSent: false,
                    })),
                ]
              })
            } catch (error) {
              console.error('Error deleting final rider group:', error)
              setGroups((previous) =>
                previous.some((candidate) => candidate.ride_id === groupId)
                  ? previous
                  : [...previous, group],
              )
              setUnmatchedRiders((previous) =>
                previous.filter(
                  (candidate) => !allFlightIds.includes(candidate.flight_id),
                ),
              )
              setErrorMessage('Failed to delete group')
              setTimeout(() => setErrorMessage(null), 3000)
              void fetchData()
            } finally {
              setPendingRiderOperations((previous) => {
                const next = new Set(previous)
                allFlightIds.forEach((flightId) => next.delete(flightId))
                return next
              })
            }
          },
        })
        return
      }

      const bagUnits = calculateBagUnits(updatedRiders)
      const isConnect = group.uber_type?.toLowerCase() === 'connect'
      const calculatedUberType = isConnect
        ? 'Connect'
        : determineUberType(updatedRiders.length, bagUnits)
      const { subsidized: calculatedSubsidized } = computeGroupSubsidized({
        date: group.date,
        toAirport: group.to_airport,
        airport: group.airport,
        riderCount: updatedRiders.length,
        riderSchools: updatedRiders.map((candidate) => candidate.school),
        uberType: calculatedUberType ?? undefined,
      })
      const effectiveUberType = group.uber_type_override
        ? (group.uber_type ?? calculatedUberType)
        : calculatedUberType
      const hasVoucher = Boolean(group.group_voucher?.trim())
      const isConnectType =
        (effectiveUberType ?? group.uber_type)?.toLowerCase() === 'connect'
      const effectiveIsSubsidized = group.subsidized_override
        ? (group.is_subsidized ?? calculatedSubsidized)
        : calculatedSubsidized || hasVoucher || isConnectType
      const optimisticGroup: Group = {
        ...group,
        riders: updatedRiders,
        time_range: calculateGroupTimeRange(updatedRiders),
        uber_type: effectiveUberType ?? group.uber_type,
        is_subsidized: effectiveIsSubsidized,
      }

      setPendingRiderOperations((previous) =>
        new Set(previous).add(rider.flight_id),
      )
      setGroups((previous) =>
        previous.map((candidate) =>
          candidate.ride_id === groupId ? optimisticGroup : candidate,
        ),
      )
      setUnmatchedRiders((previous) =>
        previous.some((candidate) => candidate.flight_id === rider.flight_id)
          ? previous
          : [...previous, rider],
      )

      try {
        const { changeLogEntries } = await removeRiderToUnmatched({
          supabase,
          groupId,
          userId: rider.user_id,
          flightId: rider.flight_id,
          remainingGroupUpdates: effectiveUberType
            ? {
                uber_type: effectiveUberType,
                is_subsidized: effectiveIsSubsidized,
                is_verified: false,
              }
            : undefined,
          changeMetadata: {
            from_group: groupId,
            to: 'unmatched',
            ride_id: groupId,
            rider_name: rider.name,
            rider_user_id: rider.user_id,
            rider_flight_id: rider.flight_id,
            flight_id: rider.flight_id,
            date: rider.date,
          },
        })
        if (changeLogExpanded) {
          mergeChangeLogEntries(changeLogEntries)
        }
        setChangedGroups((previous) => {
          const existing = previous.find(
            (changed) => changed.group.ride_id === groupId,
          )
          const description = getChangeDescription('REMOVE_FROM_GROUP')
          if (existing) {
            return previous.map((changed) =>
              changed.group.ride_id === groupId
                ? {
                    ...changed,
                    group: optimisticGroup,
                    changedAt: new Date().toISOString(),
                    emailsSent: false,
                    changeDescriptions: consolidateChangeDescriptions([
                      ...(changed.changeDescriptions || []),
                      description,
                    ]),
                  }
                : changed,
            )
          }
          return [
            ...previous,
            {
              group: optimisticGroup,
              changeType: 'modified',
              changedAt: new Date().toISOString(),
              emailsSent: false,
              changeDescriptions: [description],
            },
          ]
        })
        setUnmatchedIndividuals((previous) =>
          previous.some((entry) => entry.rider.flight_id === rider.flight_id)
            ? previous
            : [
                ...previous,
                {
                  rider,
                  becameUnmatchedAt: new Date().toISOString(),
                  emailSent: false,
                },
              ],
        )
      } catch (error) {
        console.error('Error removing rider from group to unmatched:', error)
        setGroups((previous) =>
          previous.map((candidate) =>
            candidate.ride_id === groupId ? group : candidate,
          ),
        )
        setUnmatchedRiders((previous) =>
          previous.filter(
            (candidate) => candidate.flight_id !== rider.flight_id,
          ),
        )
        setErrorMessage('Failed to remove rider from group')
        setTimeout(() => setErrorMessage(null), 3000)
        void fetchData()
      } finally {
        setPendingRiderOperations((previous) => {
          const next = new Set(previous)
          next.delete(rider.flight_id)
          return next
        })
      }
    },
    [
      changeLogExpanded,
      computeGroupSubsidized,
      fetchData,
      groups,
      logToChangeLog,
      mergeChangeLogEntries,
      pendingRiderOperations,
      supabase,
    ],
  )

  const handleRemoveFromCorral = useCallback((rider: Rider) => {
    // Remove from corral
    setCorralRiders((prev) =>
      prev.filter((r) => r.flight_id !== rider.flight_id),
    )

    // Return to origin
    if (rider.originType === 'group' && rider.originGroupId) {
      // Return to original group
      setGroups((prev) =>
        prev.map((g) =>
          g.ride_id === rider.originGroupId
            ? {
                ...g,
                riders: [...g.riders, rider],
              }
            : g,
        ),
      )
    } else {
      // Return to unmatched
      setUnmatchedRiders((prev) => [...prev, rider])
    }
  }, [])

  const handleRemoveFromCorralToUnmatched = useCallback(
    async (rider: Rider) => {
      // If rider came from a group, remove the match from database
      if (rider.originType === 'group' && rider.originGroupId) {
        try {
          await removeGroupMatch({
            supabase,
            groupId: rider.originGroupId,
            userId: rider.user_id,
            flightId: rider.flight_id,
          }).catch((error) => {
            console.error('Error removing match from database:', error)
          })

          await setMatchingStatus({
            supabase,
            flightIds: rider.flight_id,
            matchingStatus: 'unmatched',
          }).catch((error) => {
            console.error('Error updating flight:', error)
          })

          // Update local state - remove from group and recalculate time range
          setGroups((prev) =>
            prev.map((g) => {
              if (g.ride_id === rider.originGroupId) {
                const remainingRiders = g.riders.filter(
                  (r) => r.flight_id !== rider.flight_id,
                )
                // Recalculate time range if there are remaining riders
                const newTimeRange =
                  remainingRiders.length > 0
                    ? calculateGroupTimeRange(remainingRiders)
                    : g.time_range
                const midpointTime =
                  remainingRiders.length > 0
                    ? calculateTimeMidpoint(newTimeRange)
                    : g.match_time
                const formattedTime =
                  remainingRiders.length > 0 && midpointTime
                    ? midpointTime.includes(':') &&
                      midpointTime.split(':').length === 2
                      ? `${midpointTime}:00`
                      : midpointTime
                    : g.match_time

                // Update all matches in the group with new time
                if (remainingRiders.length > 0 && formattedTime) {
                  updateGroupMatchesMetadata({
                    supabase,
                    groupId: rider.originGroupId,
                    updates: {
                      time: formattedTime,
                      is_verified: false,
                    },
                  }).catch((error) => {
                    console.error('Error updating group matches time:', error)
                  })
                }

                return {
                  ...g,
                  riders: remainingRiders,
                  time_range: newTimeRange,
                  match_time: formattedTime,
                }
              }
              return g
            }),
          )
        } catch (error) {
          console.error('Error removing rider from group:', error)
        }
      }

      // Remove from corral and add to unmatched
      setCorralRiders((prev) =>
        prev.filter((r) => r.flight_id !== rider.flight_id),
      )
      // Clear originType and originGroupId since rider is now truly unmatched
      const unmatchedRider = {
        ...rider,
        originType: undefined,
        originGroupId: undefined,
      }
      setUnmatchedRiders((prev) => [...prev, unmatchedRider])
    },
    [supabase],
  )

  const handleAddFromCorral = useCallback(
    (group: Group) => {
      if (corralRiders.length === 0) return

      setCorralSelectionMode(group.ride_id)
      setCorralCollapsed(false) // Open corral
      setErrorMessage(null)
    },
    [corralRiders.length],
  )

  const handleSelectFromCorral = useCallback(
    async (
      rider: Rider,
      group: Group,
      skipValidation = false,
      explicitSourceGroupId?: number,
      customTime?: string,
      customDate?: string,
    ) => {
      // Check for validation errors that require acknowledgment (unless skipping)
      if (!skipValidation) {
        const timeCompatible = validateTimeCompatibility(group, rider)

        const updatedRiders = [...group.riders, rider]
        const newRiderCount = updatedRiders.length

        // Calculate bag units manually to avoid dependency issues
        let numLargeBags = 0
        let numNormalBags = 0
        for (const r of updatedRiders) {
          numLargeBags += r.checked_bags
          numNormalBags += r.carry_on_bags
        }
        const bagUnits = numLargeBags * 2 + numNormalBags

        // Check if bags would exceed 10 for 4+ members
        const bagsExceedLimit = newRiderCount >= 4 && bagUnits > 10

        // Determine which issue(s) we have (prioritize time if both)
        if (!timeCompatible || bagsExceedLimit) {
          const issue = !timeCompatible ? 'time' : 'bags'
          setValidationErrorModal({
            rider,
            group,
            issue,
            onAcknowledge: async () => {
              setValidationErrorModal(null)

              // Log IGNORE_ERROR to ChangeLog without keeping the warning open.
              void logToChangeLog(
                'IGNORE_ERROR',
                {
                  ride_id: group.ride_id,
                  rider_name: rider.name,
                  rider_user_id: rider.user_id,
                  rider_flight_id: rider.flight_id,
                  issue: issue,
                  time_compatible: timeCompatible,
                  bags_exceed_limit: bagsExceedLimit,
                  bag_units: bagUnits,
                  new_rider_count: newRiderCount,
                },
                group.ride_id,
                rider.user_id,
                false,
              ).catch((error) => {
                console.error(
                  'Error logging ignored validation warning:',
                  error,
                )
              })

              // Recursively call handleSelectFromCorral to proceed with addition
              await handleSelectFromCorral(
                rider,
                group,
                true, // Skip validation (already acknowledged)
                explicitSourceGroupId,
                customTime,
                customDate,
              )
            },
            onCancel: () => {
              setValidationErrorModal(null)
              setCorralSelectionMode(null)
            },
          })
          return
        }
      }

      // Determine source (corral, unmatched, or direct from group) - DON'T remove from corral yet
      const corralRider = corralRiders.find(
        (r) => r.flight_id === rider.flight_id,
      )
      const isFromCorral = !!corralRider

      // If explicitSourceGroupId is provided, use it (direct drag from group)
      // Otherwise, use the originGroupId from corral rider
      const sourceGroupId = explicitSourceGroupId || corralRider?.originGroupId
      const source = explicitSourceGroupId
        ? 'group'
        : isFromCorral
          ? 'corral'
          : 'unmatched'

      try {
        // Calculate bag units and uber_type for the updated group (preserve Connect if ride is Connect)
        const updatedRiders = [...group.riders, rider]
        const bagUnits = calculateBagUnits(updatedRiders)
        const isConnect = group.uber_type?.toLowerCase() === 'connect'
        const uberType = isConnect
          ? 'Connect'
          : determineUberType(updatedRiders.length, bagUnits) // Always returns a string (defaults to 'XXL*' for invalid)

        // Use custom time/date if provided, otherwise check for overlap
        let formattedTime: string
        let finalDate: string
        let newTimeRange: string
        if (customTime && customDate) {
          // Use custom time/date provided by user
          formattedTime =
            customTime.includes(':') && customTime.split(':').length === 2
              ? `${customTime}:00`
              : customTime
          finalDate = customDate
          // For custom time, we still need a time range - use the custom time as both start and end
          // Or calculate from the group's existing time range
          newTimeRange = calculateGroupTimeRange(updatedRiders)
        } else {
          // Calculate new time range overlap for the group
          newTimeRange = calculateGroupTimeRange(updatedRiders)

          // Check if there's actually an overlap (not just a fallback to first rider's range)
          const hasOverlap = validateTimeCompatibility(group, rider)

          if (hasOverlap && newTimeRange && newTimeRange !== rider.time_range) {
            // There's an overlap - calculate midpoint and update group time
            const midpointTime = calculateTimeMidpoint(newTimeRange)
            formattedTime =
              midpointTime.includes(':') && midpointTime.split(':').length === 2
                ? `${midpointTime}:00`
                : midpointTime
          } else {
            // No overlap - keep existing group time (don't update existing matches)
            if (group.match_time) {
              formattedTime = group.match_time
              // Ensure formattedTime has seconds
              if (formattedTime.split(':').length === 2) {
                formattedTime = `${formattedTime}:00`
              }
            } else {
              // No existing time - use calculated time for new rider only (don't update existing matches)
              const midpointTime = calculateTimeMidpoint(
                newTimeRange || group.time_range || '12:00 - 12:00',
              )
              formattedTime =
                midpointTime.includes(':') &&
                midpointTime.split(':').length === 2
                  ? `${midpointTime}:00`
                  : midpointTime
            }
          }
          finalDate = group.date
        }

        // uberType will always be a string now (defaults to 'XXL*' for invalid combinations)
        // No need to check for null/undefined

        const { subsidized: isSubsidized } = computeGroupSubsidized({
          date: finalDate,
          toAirport: group.to_airport,
          airport: group.airport,
          riderCount: updatedRiders.length,
          riderSchools: updatedRiders.map((r) => r.school),
          uberType: uberType ?? undefined,
        })
        const rawGroupVoucher = (group.group_voucher ?? '').trim()
        const voucherValue = rawGroupVoucher
          ? normalizeVoucherInput(rawGroupVoucher)
          : ''

        // Respect manual overrides for the group when setting new/updated match
        const effectiveUberType = group.uber_type_override
          ? (group.uber_type ?? uberType)
          : uberType
        const hasVoucher = Boolean(group.group_voucher?.trim())
        const isConnectType =
          (effectiveUberType ?? group.uber_type)?.toLowerCase() === 'connect'
        const effectiveIsSubsidized = group.subsidized_override
          ? (group.is_subsidized ?? isSubsidized)
          : isSubsidized || hasVoucher || isConnectType

        const sourceGroup = sourceGroupId
          ? groups.find((candidate) => candidate.ride_id === sourceGroupId)
          : undefined
        const sourceRemainingRiders = sourceGroup
          ? sourceGroup.riders.filter(
              (candidate) => candidate.flight_id !== rider.flight_id,
            )
          : []
        let sourceGroupUpdates: Record<string, unknown> | undefined
        if (sourceGroup && sourceRemainingRiders.length > 0) {
          const sourceBagUnits = calculateBagUnits(sourceRemainingRiders)
          const sourceComputedUberType =
            sourceGroup.uber_type?.toLowerCase() === 'connect'
              ? 'Connect'
              : determineUberType(sourceRemainingRiders.length, sourceBagUnits)
          const sourceEffectiveUberType = sourceGroup.uber_type_override
            ? (sourceGroup.uber_type ?? sourceComputedUberType)
            : sourceComputedUberType
          const { subsidized: sourceComputedSubsidized } =
            computeGroupSubsidized({
              date: sourceGroup.date,
              toAirport: sourceGroup.to_airport,
              airport: sourceGroup.airport,
              riderCount: sourceRemainingRiders.length,
              riderSchools: sourceRemainingRiders.map(
                (remainingRider) => remainingRider.school,
              ),
              uberType: sourceEffectiveUberType ?? undefined,
            })
          sourceGroupUpdates = {
            uber_type: sourceEffectiveUberType || sourceGroup.uber_type,
            is_subsidized: sourceGroup.subsidized_override
              ? (sourceGroup.is_subsidized ?? sourceComputedSubsidized)
              : sourceComputedSubsidized ||
                Boolean(sourceGroup.group_voucher?.trim()) ||
                sourceEffectiveUberType?.toLowerCase() === 'connect',
            is_verified: false,
          }
        }

        const pendingUnmatchedItem = unmatchedIndividuals.find(
          (item) => item.rider.flight_id === rider.flight_id,
        )
        const unmatchedChangeLogIds = pendingUnmatchedItem?.changeLogIds?.length
          ? pendingUnmatchedItem.changeLogIds
          : pendingUnmatchedItem?.changeLogId
            ? [pendingUnmatchedItem.changeLogId]
            : []
        const changeBatchId = crypto.randomUUID()

        setCorralRiders((prev) =>
          prev.filter((r) => r.flight_id !== rider.flight_id),
        )
        setUnmatchedRiders((prev) =>
          prev.filter((r) => r.flight_id !== rider.flight_id),
        )
        setGroups((prev) =>
          prev
            .map((g) => {
              const ridersWithoutMoved = g.riders.filter(
                (candidate) => candidate.flight_id !== rider.flight_id,
              )

              if (g.ride_id === group.ride_id) {
                const nextRiders = [...ridersWithoutMoved, rider]
                return {
                  ...g,
                  riders: nextRiders,
                  time_range:
                    newTimeRange || calculateGroupTimeRange(nextRiders),
                  match_time: g.match_time,
                  uber_type: effectiveUberType,
                  is_subsidized: effectiveIsSubsidized,
                }
              }

              if (ridersWithoutMoved.length !== g.riders.length) {
                return {
                  ...g,
                  riders: ridersWithoutMoved,
                  time_range: calculateGroupTimeRange(ridersWithoutMoved),
                }
              }

              return g
            })
            .filter((g) => g.riders.length > 0),
        )

        const { changeLogEntries } = await moveRiderToGroup({
          destinationGroupId: group.ride_id,
          sourceGroupId,
          userId: rider.user_id,
          flightId: rider.flight_id,
          date: finalDate,
          time: formattedTime,
          voucher: voucherValue,
          isSubsidized: effectiveIsSubsidized,
          uberType: effectiveUberType,
          destinationGroupUpdates: {
            uber_type: effectiveUberType,
            is_subsidized: effectiveIsSubsidized,
            is_verified: false,
          },
          sourceGroupUpdates,
          changeLogIds: unmatchedChangeLogIds,
          sourceMetadata: sourceGroupId
            ? {
                from_group: sourceGroupId,
                to: 'corral',
                ride_id: sourceGroupId,
                rider_name: rider.name,
                rider_user_id: rider.user_id,
                rider_flight_id: rider.flight_id,
                flight_id: rider.flight_id,
              }
            : undefined,
          destinationMetadata: {
            from: source,
            to_group: group.ride_id,
            from_group: sourceGroupId,
            ride_id: group.ride_id,
            rider_name: rider.name,
            rider_user_id: rider.user_id,
            rider_flight_id: rider.flight_id,
          },
          changeBatchId,
        })
        if (changeLogExpanded) {
          mergeChangeLogEntries(changeLogEntries)
        }

        // Only remove from corral AFTER successful database operations
        if (isFromCorral && corralRider) {
          setCorralRiders((prev) =>
            prev.filter((r) => r.flight_id !== rider.flight_id),
          )
        }

        if (unmatchedChangeLogIds.length > 0) {
          setUnmatchedIndividuals((prev) =>
            prev.filter((ui) => ui.rider.flight_id !== rider.flight_id),
          )
        }

        // Update local state and track changes
        setGroups((prev) => {
          const updatedGroups = prev.map((g) => {
            // Update destination group
            if (g.ride_id === group.ride_id) {
              const ridersWithoutMoved = g.riders.filter(
                (existingRider) => existingRider.flight_id !== rider.flight_id,
              )
              return {
                ...g,
                riders: [...ridersWithoutMoved, rider],
                time_range: newTimeRange, // Update time range (for display)
                match_time: g.match_time, // Keep existing group time — only the added rider's match was updated
                uber_type: effectiveUberType, // Update uber_type in local state (respects override)
                is_subsidized: effectiveIsSubsidized,
              }
            }
            // If rider came from another group, update source group (match already deleted above)
            if (sourceGroupId && g.ride_id === sourceGroupId) {
              // Calculate new uber_type and is_subsidized for source group after removing rider
              const remainingRiders = g.riders.filter(
                (r) => r.flight_id !== rider.flight_id,
              )
              if (remainingRiders.length === 0) {
                return {
                  ...g,
                  riders: [],
                  time_range: '',
                }
              }

              if (remainingRiders.length > 0) {
                const bagUnits = calculateBagUnits(remainingRiders)
                const sourceIsConnect = g.uber_type?.toLowerCase() === 'connect'
                const computedUberType = sourceIsConnect
                  ? 'Connect'
                  : determineUberType(remainingRiders.length, bagUnits)
                const sourceEffectiveUberType = g.uber_type_override
                  ? (g.uber_type ?? computedUberType)
                  : computedUberType
                const { subsidized: sourceComputedSubsidized } =
                  computeGroupSubsidized({
                    date: g.date,
                    toAirport: g.to_airport,
                    airport: g.airport,
                    riderCount: remainingRiders.length,
                    riderSchools: remainingRiders.map((r) => r.school),
                    uberType: sourceEffectiveUberType ?? undefined,
                  })
                const sourceHasVoucher = Boolean(g.group_voucher?.trim())
                const sourceIsConnectType =
                  (sourceEffectiveUberType ?? g.uber_type)?.toLowerCase() ===
                  'connect'
                const sourceEffectiveIsSubsidized = g.subsidized_override
                  ? (g.is_subsidized ?? sourceComputedSubsidized)
                  : sourceComputedSubsidized ||
                    sourceHasVoucher ||
                    sourceIsConnectType
                // Recalculate time range for display only, but keep existing match_time
                const newSourceTimeRange =
                  calculateGroupTimeRange(remainingRiders)

                return {
                  ...g,
                  riders: remainingRiders,
                  time_range: newSourceTimeRange, // Update time range for display only
                  match_time: g.match_time, // Keep existing time - don't change
                  uber_type: sourceEffectiveUberType || g.uber_type,
                  is_subsidized: sourceEffectiveIsSubsidized,
                }
              }
            }
            return g
          })
          return updatedGroups.filter((g) => g.riders.length > 0)
        })

        // Track destination group as changed
        setGroups((prevGroups) => {
          const updatedGroup = prevGroups.find(
            (g) => g.ride_id === group.ride_id,
          )
          if (updatedGroup) {
            setChangedGroups((prevChanged) => {
              const existing = prevChanged.find(
                (cg) => cg.group.ride_id === group.ride_id,
              )
              if (existing) {
                // Merge new change description with existing ones
                const newDescription = getChangeDescription('ADD_TO_GROUP')
                const existingDescriptions = existing.changeDescriptions || []
                const updatedDescriptions = consolidateChangeDescriptions([
                  ...existingDescriptions,
                  newDescription,
                ])
                return prevChanged.map((cg) =>
                  cg.group.ride_id === group.ride_id
                    ? {
                        ...cg,
                        group: updatedGroup, // Update with latest group data
                        changedAt: new Date().toISOString(),
                        emailsSent: false,
                        changeDescriptions: updatedDescriptions,
                      }
                    : cg,
                )
              }
              return [
                ...prevChanged,
                {
                  group: updatedGroup,
                  changeType: 'modified',
                  changedAt: new Date().toISOString(),
                  emailsSent: false,
                  changeDescriptions: [getChangeDescription('ADD_TO_GROUP')],
                },
              ]
            })
          }
          return prevGroups
        })

        // Track source group as changed (if rider came from another group)
        if (sourceGroupId) {
          setGroups((prevGroups) => {
            const updatedSourceGroup = prevGroups.find(
              (g) => g.ride_id === sourceGroupId,
            )
            if (updatedSourceGroup) {
              setChangedGroups((prevChanged) => {
                const existing = prevChanged.find(
                  (cg) => cg.group.ride_id === sourceGroupId,
                )
                if (existing) {
                  // Merge new change description with existing ones
                  const newDescription =
                    getChangeDescription('REMOVE_FROM_GROUP')
                  const existingDescriptions = existing.changeDescriptions || []
                  const updatedDescriptions = consolidateChangeDescriptions([
                    ...existingDescriptions,
                    newDescription,
                  ])
                  return prevChanged.map((cg) =>
                    cg.group.ride_id === sourceGroupId
                      ? {
                          ...cg,
                          group: updatedSourceGroup, // Update with latest group data
                          changedAt: new Date().toISOString(),
                          emailsSent: false,
                          changeDescriptions: updatedDescriptions,
                        }
                      : cg,
                  )
                }
                return [
                  ...prevChanged,
                  {
                    group: updatedSourceGroup,
                    changeType: 'modified',
                    changedAt: new Date().toISOString(),
                    emailsSent: false,
                    changeDescriptions: [
                      getChangeDescription('REMOVE_FROM_GROUP'),
                    ],
                  },
                ]
              })
            }
            return prevGroups
          })
        }

        if (corralTab === 'changes') {
          void loadUnconfirmedChanges()
        }

        // Clear selection mode
        setCorralSelectionMode(null)
        setErrorMessage(null)
      } catch (error) {
        console.error('Error adding rider from corral to group:', error)
        setErrorMessage('Failed to add rider to group')
        setCorralSelectionMode(null)
        await fetchData()
        setTimeout(() => setErrorMessage(null), 3000)
      }
    },
    [
      logToChangeLog,
      loadUnconfirmedChanges,
      fetchData,
      changeLogExpanded,
      groups,
      corralRiders,
      corralTab,
      computeGroupSubsidized,
      mergeChangeLogEntries,
      unmatchedIndividuals,
    ],
  )

  const handleFiltersToggle = useCallback(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && filtersCollapsed) {
      // Opening filters on mobile - close corral
      setCorralCollapsed(true)
    }
    setFiltersCollapsed(!filtersCollapsed)
    // Always switch to filters tab when opening
    if (filtersCollapsed) {
      setActiveLeftTab('filters')
    }
  }, [filtersCollapsed])

  const handleCorralToggle = useCallback(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile && corralCollapsed) {
      // Opening corral on mobile - close filters
      setFiltersCollapsed(true)
    }
    setCorralCollapsed(!corralCollapsed)
  }, [corralCollapsed])

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setSearchQuery(searchInput)
        if (searchInput.trim().startsWith('#')) {
          setActiveTab('matched')
        }
        // Provide visual feedback
        setSearchFeedback(true)
        setTimeout(() => setSearchFeedback(false), 300)
      }
    },
    [searchInput],
  )

  const handleSearchInputChange = useCallback((value: string) => {
    setSearchInput(value)
    setSearchQuery(value)
    if (value.trim().startsWith('#')) {
      setActiveTab('matched')
    }
  }, [])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setSearchQuery('')
  }, [])

  const handleSaveGroupOverrides = useCallback(
    async (
      group: Group,
      subsidized: 'auto' | 'yes' | 'no',
      uberType: 'auto' | 'X' | 'XL' | 'XXL' | 'Connect',
    ) => {
      setIsUpdatingOverrides(true)
      try {
        const subsidizedOverride = subsidized !== 'auto'
        const uberTypeOverride = uberType !== 'auto'

        let isSubsidized: boolean
        let finalUberType: string
        if (subsidizedOverride) {
          isSubsidized = subsidized === 'yes'
        } else {
          const { subsidized: computed } = computeGroupSubsidized({
            date: group.date,
            toAirport: group.to_airport,
            airport: group.airport,
            riderCount: group.riders.length,
            riderSchools: group.riders.map((r) => r.school),
            uberType: uberTypeOverride
              ? (uberType as string)
              : (group.uber_type ?? undefined),
          })
          const hasVoucher = Boolean(group.group_voucher?.trim())
          const isConnectType = group.uber_type?.toLowerCase() === 'connect'
          isSubsidized = computed || hasVoucher || isConnectType
        }
        if (uberTypeOverride) {
          finalUberType = uberType as string
        } else {
          const bagUnits = calculateBagUnits(group.riders)
          finalUberType =
            group.uber_type?.toLowerCase() === 'connect'
              ? 'Connect'
              : determineUberType(group.riders.length, bagUnits)
        }

        await saveGroupOverrideRecords({
          supabase,
          groupId: group.ride_id,
          isSubsidized,
          uberType: finalUberType,
          subsidizedOverride,
          uberTypeOverride,
        })

        setGroups((prev) =>
          prev.map((g) =>
            g.ride_id === group.ride_id
              ? {
                  ...g,
                  is_subsidized: isSubsidized,
                  uber_type: finalUberType,
                  subsidized_override: subsidizedOverride,
                  uber_type_override: uberTypeOverride,
                }
              : g,
          ),
        )
        setEditGroupOverridesModal(null)
        setErrorMessage(null)
      } catch (e) {
        console.error('Failed to update group overrides:', e)
        setErrorMessage('Failed to update group overrides')
        setTimeout(() => setErrorMessage(null), 3000)
      } finally {
        setIsUpdatingOverrides(false)
      }
    },
    [supabase, computeGroupSubsidized],
  )

  // Create new group in database
  const createNewGroup = useCallback(async () => {
    if (
      selectedRidersForNewGroup.length < 2 ||
      selectedRidersForNewGroup.length > 6
    ) {
      setErrorMessage('Group must have 2-6 riders')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    if (!newGroupDate) {
      setErrorMessage('Date is required')
      setTimeout(() => setErrorMessage(null), 3000)
      return
    }

    setIsCreatingGroup(true)

    try {
      const bagUnits = calculateBagUnits(selectedRidersForNewGroup)
      const uberType = determineUberType(
        selectedRidersForNewGroup.length,
        bagUnits,
      )

      let formattedTime: string
      const calculatedTimeRange = calculateGroupTimeRange(
        selectedRidersForNewGroup,
      )

      const toHhMmSs = (raw: string) => {
        const t = raw.trim()
        const segments = t.split(':')
        if (segments.length >= 2) {
          const hh = segments[0].padStart(2, '0')
          const mm = segments[1].padStart(2, '0')
          const ss =
            segments.length >= 3
              ? segments[2].replace(/\D/g, '').slice(0, 2).padStart(2, '0')
              : '00'
          return `${hh}:${mm}:${ss}`
        }
        return t
      }

      if (newGroupTime) {
        formattedTime = toHhMmSs(newGroupTime)
      } else {
        const midpointTime = calculateTimeMidpoint(calculatedTimeRange)
        formattedTime = toHhMmSs(midpointTime)
      }

      // Use the date input string as-is (YYYY-MM-DD) to avoid UTC/local shifts from Date parsing.
      const rideDate = newGroupDate.trim()

      const firstRider = selectedRidersForNewGroup[0]
      const groupAirport = firstRider?.airport || 'LAX'
      const groupToAirport = firstRider?.to_airport ?? true
      const {
        subsidized: calculatedIsSubsidized,
        assignVoucher: assignVoucherFromRules,
      } = computeGroupSubsidized({
        date: rideDate,
        toAirport: groupToAirport,
        airport: groupAirport,
        riderCount: selectedRidersForNewGroup.length,
        riderSchools: selectedRidersForNewGroup.map((r) => r.school),
        uberType: uberType ?? undefined,
      })

      const normalizedNewGroupVoucher = normalizeVoucherInput(newGroupVoucher)
      const hasVoucher = Boolean(normalizedNewGroupVoucher.trim())
      // Persist manual voucher entry even when automatic subsidy rules would block assignment.
      const assignVoucher = assignVoucherFromRules || hasVoucher
      const isConnectType = uberType?.toLowerCase() === 'connect'
      const effectiveNewGroupSubsidized =
        isSubsidized || calculatedIsSubsidized || hasVoucher || isConnectType

      const { rideId, normalizedVoucher } = await createGroupRecords({
        supabase,
        rideDate,
        riders: selectedRidersForNewGroup,
        formattedTime,
        voucher: newGroupVoucher,
        contingencyVoucher: newGroupContingencyVoucher,
        assignVoucher,
        uberType,
        isSubsidized: effectiveNewGroupSubsidized,
      })

      for (const rider of selectedRidersForNewGroup) {
        const pendingUnmatchedItem = unmatchedIndividuals.find(
          (item) => item.rider.flight_id === rider.flight_id,
        )
        const changeLogIds =
          pendingUnmatchedItem?.changeLogIds &&
          pendingUnmatchedItem.changeLogIds.length > 0
            ? pendingUnmatchedItem.changeLogIds
            : pendingUnmatchedItem?.changeLogId
              ? [pendingUnmatchedItem.changeLogId]
              : []

        if (changeLogIds.length > 0) {
          await confirmChangeLogEntries({
            supabase,
            changeLogIds,
          })
          setUnmatchedIndividuals((prev) =>
            prev.filter((ui) => ui.rider.flight_id !== rider.flight_id),
          )
        }
      }

      await logToChangeLog(
        'CREATE_GROUP',
        {
          ride_id: rideId,
          rider_count: selectedRidersForNewGroup.length,
          rider_names: selectedRidersForNewGroup.map((r) => r.name),
          rider_user_ids: selectedRidersForNewGroup.map((r) => r.user_id),
          date: rideDate,
          time: formattedTime,
          uber_type: uberType,
          is_subsidized: effectiveNewGroupSubsidized,
        },
        rideId,
        undefined,
        false,
        crypto.randomUUID(),
      )

      const selectedFlightIds = new Set(
        selectedRidersForNewGroup.map((r) => r.flight_id),
      )
      setCorralRiders((prev) =>
        prev.filter((r) => !selectedFlightIds.has(r.flight_id)),
      )
      setUnmatchedRiders((prev) =>
        prev.filter((r) => !selectedFlightIds.has(r.flight_id)),
      )
      setGroups((prev) => [
        ...prev,
        {
          ride_id: rideId,
          airport: groupAirport,
          date: rideDate,
          time_range: calculatedTimeRange,
          match_time: formattedTime,
          to_airport: groupToAirport,
          riders: selectedRidersForNewGroup,
          group_voucher: normalizedVoucher || undefined,
          uber_type: uberType,
          is_subsidized: effectiveNewGroupSubsidized,
          subsidized_override: false,
          uber_type_override: false,
        },
      ])

      clearDraftGroup()

      setErrorMessage(null)
    } catch (error) {
      console.error('Unexpected error creating group:', error)
      setErrorMessage(
        error instanceof Error ? error.message : 'An unexpected error occurred',
      )
      setTimeout(() => setErrorMessage(null), 3000)
    } finally {
      setIsCreatingGroup(false)
    }
  }, [
    clearDraftGroup,
    computeGroupSubsidized,
    isSubsidized,
    logToChangeLog,
    newGroupContingencyVoucher,
    newGroupDate,
    newGroupTime,
    newGroupVoucher,
    selectedRidersForNewGroup,
    supabase,
    unmatchedIndividuals,
  ])

  // Add rider to new group selection
  const addRiderToNewGroup = useCallback(
    (rider: Rider) => {
      if (selectedRidersForNewGroup.length >= 6) {
        setErrorMessage('Maximum 6 riders per group')
        setTimeout(() => setErrorMessage(null), 3000)
        return
      }
      if (
        selectedRidersForNewGroup.some((r) => r.flight_id === rider.flight_id)
      ) {
        return // Already selected
      }
      setSelectedRidersForNewGroup((prev) => [...prev, rider])

      // Visual feedback: Add to recently added set for animation (use flight_id as string)
      setRecentlyAddedToNewGroup((prev) =>
        new Set(prev).add(String(rider.flight_id)),
      )
      // Clear animation after 1 second
      setTimeout(() => {
        setRecentlyAddedToNewGroup((prev) => {
          const newSet = new Set(prev)
          newSet.delete(String(rider.flight_id))
          return newSet
        })
      }, 1000)

      // On desktop, open the Create new group section
      if (window.innerWidth >= 768) {
        if (filtersCollapsed) {
          setFiltersCollapsed(false)
        }
        if (leftSidebarTabs.includes('createGroup')) {
          setActiveLeftTab('createGroup')
        }
        setNewGroupSectionExpanded(true)
      }

      // Auto-calculate date/time if not set
      if (!newGroupDate || !newGroupTime) {
        const calculated = matchDatetimeFromEarliest([
          ...selectedRidersForNewGroup,
          rider,
        ])
        if (calculated) {
          setNewGroupDate(calculated.date)
          // Convert time to HH:MM format for time input
          const [hours, minutes] = calculated.time.split(':')
          setNewGroupTime(`${hours}:${minutes || '00'}`)
        }
      }
    },
    [
      filtersCollapsed,
      leftSidebarTabs,
      newGroupDate,
      newGroupTime,
      selectedRidersForNewGroup,
    ],
  )

  const removeRiderFromNewGroup = useCallback((flightId: number) => {
    setSelectedRidersForNewGroup((prev) =>
      prev.filter((rider) => rider.flight_id !== flightId),
    )
  }, [])

  const {
    filteredGroups,
    formatChangeLogEntry,
    sortedChangeLog,
    sortedCorralRiders,
    sortedGroups,
    sortedUnmatchedRiders,
  } = useGroupsDerivedData({
    changeLog,
    changeLogFilterActions,
    changeLogFilterDateFrom,
    changeLogFilterDateTo,
    changeLogFilterName,
    changeLogFilterRideId,
    changeLogFilterSubjectName,
    changeLogSortBy,
    changeLogSortDirection,
    corralRiders,
    dateRangeEnd,
    dateRangeStart,
    filterDirectionFrom,
    filterDirectionTo,
    groups,
    lastAlgorithmRunDate,
    maxBags,
    minBags,
    searchQuery,
    selectedAirports,
    selectedUberTypes,
    sortingRules,
    subsidyFilter,
    timeRangeEnd,
    timeRangeStart,
    unmatchedRiders,
  })

  // Debug: why is group 353 not in filteredGroups when it's in groups?
  useEffect(() => {
    const g353 = groups.find((g) => g.ride_id === 353)
    const inFiltered = filteredGroups.some((g) => g.ride_id === 353)
    if (!g353) return
    if (inFiltered) return
    const group = g353
    const reasons: string[] = []
    const airportMatch =
      selectedAirports.length === 0 || selectedAirports.includes(group.airport)
    if (!airportMatch)
      reasons.push(
        `airport: group.airport=${group.airport} selected=${JSON.stringify(selectedAirports)}`,
      )
    const directionMatch =
      (filterDirectionTo && group.to_airport) ||
      (filterDirectionFrom && !group.to_airport)
    if (!directionMatch)
      reasons.push(
        `direction: to_airport=${group.to_airport} filterTo=${filterDirectionTo} filterFrom=${filterDirectionFrom}`,
      )
    if (dateRangeStart || dateRangeEnd) {
      const groupDateStr = normalizeDateToYYYYMMDD(group.date) || group.date
      if (dateRangeStart && groupDateStr < dateRangeStart)
        reasons.push(
          `date before start: groupDate=${groupDateStr} start=${dateRangeStart}`,
        )
      if (dateRangeEnd && groupDateStr > dateRangeEnd)
        reasons.push(
          `date after end: groupDate=${groupDateStr} end=${dateRangeEnd}`,
        )
    }
    if (timeRangeStart && timeRangeEnd) {
      const calculatedTimeRange = calculateGroupTimeRange(group.riders)
      const groupTimeRange = calculatedTimeRange.split(' - ')
      const groupStart = groupTimeRange[0]?.trim()
      const groupEnd = groupTimeRange[1]?.trim()
      if (groupStart && groupEnd) {
        const filterStartM = timeToMinutes(timeRangeStart)
        const filterEndM = timeToMinutes(timeRangeEnd)
        const groupStartM = timeToMinutes(
          groupStart.includes(':')
            ? groupStart.split(':').slice(0, 2).join(':')
            : groupStart,
        )
        const groupEndM = timeToMinutes(
          groupEnd.includes(':')
            ? groupEnd.split(':').slice(0, 2).join(':')
            : groupEnd,
        )
        const isOvernight = filterStartM > filterEndM
        const timeInRange = isOvernight
          ? groupStartM >= filterStartM ||
            groupStartM <= filterEndM ||
            groupEndM >= filterStartM ||
            groupEndM <= filterEndM
          : (groupStartM >= filterStartM && groupStartM <= filterEndM) ||
            (groupEndM >= filterStartM && groupEndM <= filterEndM) ||
            (groupStartM <= filterStartM && groupEndM >= filterEndM)
        if (!timeInRange)
          reasons.push(
            `time: ${groupStart}-${groupEnd} not in ${timeRangeStart}-${timeRangeEnd}${isOvernight ? ' (overnight)' : ''}`,
          )
      }
    }
    const riderCount = group.riders.length
    const isSubsidized =
      group.is_subsidized ?? isGroupSubsidized(group.airport, riderCount)
    if (subsidyFilter === 'subsidized' && !isSubsidized)
      reasons.push('subsidy: filter=subsidized but group not subsidized')
    if (subsidyFilter === 'unsubsidized' && isSubsidized)
      reasons.push('subsidy: filter=unsubsidized but group is subsidized')
    const effectiveUberType = group.uber_type || getUberType(riderCount)
    const normalizedType =
      effectiveUberType?.toLowerCase() === 'connect'
        ? 'Connect'
        : effectiveUberType === 'XXL*'
          ? 'XXL'
          : (effectiveUberType ?? 'X')
    if (
      selectedUberTypes.size > 0 &&
      selectedUberTypes.size < 4 &&
      !selectedUberTypes.has(normalizedType)
    ) {
      reasons.push(
        `uberType: normalized=${normalizedType} selectedSize=${selectedUberTypes.size} hasType=${selectedUberTypes.has(normalizedType)}`,
      )
    }
    if (minBags || maxBags) {
      const totalBags = getTotalBags(group.riders)
      if (minBags && totalBags < parseInt(minBags))
        reasons.push(`minBags: total=${totalBags} min=${minBags}`)
      if (maxBags && totalBags > parseInt(maxBags))
        reasons.push(`maxBags: total=${totalBags} max=${maxBags}`)
    }
    if (searchQuery.trim()) {
      reasons.push(
        `search: query="${searchQuery.trim()}" (no match for ride_id/names/flight/etc)`,
      )
    }
  }, [
    groups,
    filteredGroups,
    selectedAirports,
    filterDirectionTo,
    filterDirectionFrom,
    dateRangeStart,
    dateRangeEnd,
    timeRangeStart,
    timeRangeEnd,
    subsidyFilter,
    selectedUberTypes,
    minBags,
    maxBags,
    searchQuery,
  ])

  const openEditRider = useCallback((rider: Rider) => {
    setEditRiderModal({ rider })
    setEditRiderForm({
      flight_no: rider.flight_no || '',
      airline_iata: rider.airline_iata || '',
      airport: rider.airport || '',
      to_airport: rider.to_airport ?? true,
      date: rider.date || '',
      time_range: rider.time_range || '',
    })
  }, [])

  const openEditTime = useCallback((group: Group) => {
    setEditTimeModal({ group })
    setEditTimeValue(group.match_time ? group.match_time.substring(0, 5) : '')
    setEditDateValue(group.date || '')
  }, [])

  const openEditVoucher = useCallback((group: Group) => {
    setEditVoucherModal({ group })
    setEditVoucherValue(
      group.group_voucher ? formatVoucher(group.group_voucher) : '',
    )
  }, [])

  const openEditGroupOverrides = useCallback((group: Group) => {
    const { overrideSubsidized, overrideUberType } =
      getOverrideSelections(group)
    setEditGroupOverridesModal({ group })
    setOverrideSubsidized(overrideSubsidized)
    setOverrideUberType(overrideUberType)
  }, [])

  const { actionsContextValue, dataContextValue, uiContextValue } =
    useGroupsContextValues({
      actions: {
        addRiderToNewGroup,
        clearChangeLogFilters,
        clearDraftGroup,
        closeDeleteGroupConfirmation,
        closeEditRider,
        closeEditTime,
        closeEditVoucher,
        createNewGroup,
        fetchChangeLog,
        fetchData,
        handleAddFromCorral,
        handleAddToCorral,
        handleCorralToggle,
        handleFiltersToggle,
        handleRemoveFromCorral,
        handleRemoveFromCorralToUnmatched,
        handleRemoveFromGroupToUnmatched,
        handleSaveGroupOverrides,
        handleSelectFromCorral,
        handleUpdateGroupTime,
        handleUpdateGroupVoucher,
        handleUpdateRider,
        loadUnconfirmedChanges,
        logToChangeLog,
        openEditGroupOverrides,
        openEditRider,
        openEditTime,
        openEditVoucher,
        removeRiderFromNewGroup,
        setChangeLogDateRange,
        setChangedGroups,
        setCorralRiders,
        setUnmatchedIndividuals,
        setUnmatchedRiders,
        supabase,
        toggleAirport,
        toggleGroupExpanded,
      },
      data: {
        availableAirports,
        changeLog,
        changedGroups,
        corralRiders,
        formatChangeLogEntry,
        groups,
        lastAlgorithmRunDate,
        sortedChangeLog,
        sortedCorralRiders,
        sortedGroups,
        sortedUnmatchedRiders,
        unmatchedIndividuals,
        unmatchedRiders,
      },
      ui: {
        autoCalculateError,
        changeLogExpanded,
        changeLogFilterActions,
        changeLogFilterDateFrom,
        changeLogFilterDateTo,
        changeLogFilterName,
        changeLogFilterRideId,
        changeLogFilterSubjectName,
        changeLogHeight,
        changeLogOptionsExpanded,
        changeLogSortBy,
        changeLogSortDirection,
        confirmingGroups,
        confirmingIndividuals,
        corralCardErrors,
        corralCollapsed,
        corralSelectionMode,
        corralTab,
        dateRangeEnd,
        dateRangeStart,
        deleteGroupConfirmation,
        dragOverGroupId,
        dragOverSortIndex,
        draggedRider,
        draggedSortIndex,
        editDateValue,
        editGroupOverridesModal,
        editRiderForm,
        editRiderModal,
        editTimeModal,
        editTimeValue,
        editVoucherModal,
        editVoucherValue,
        errorMessage,
        expandedGroups,
        filterDirectionFrom,
        filterDirectionTo,
        isAddRiderOpen,
        isCreatingGroup,
        isDraggingOverCorral,
        isSubsidized,
        isUpdatingOverrides,
        isUpdatingRider,
        isUpdatingTime,
        isUpdatingVoucher,
        leftSidebarTabs,
        maxBags,
        minBags,
        newGroupContingencyVoucher,
        newGroupDate,
        newGroupSectionExpanded,
        newGroupTime,
        newGroupVoucher,
        overrideSubsidized,
        overrideUberType,
        recentlyAddedToNewGroup,
        resizeStartRef,
        selectedAirports,
        selectedRidersForNewGroup,
        selectedUberTypes,
        setAutoCalculateError,
        setChangeLogExpanded,
        setChangeLogFilterActions,
        setChangeLogFilterName,
        setChangeLogFilterRideId,
        setChangeLogFilterSubjectName,
        setChangeLogOptionsExpanded,
        setChangeLogSortBy,
        setChangeLogSortDirection,
        setConfirmingGroups,
        setConfirmingIndividuals,
        setCorralSelectionMode,
        setCorralTab,
        setDateRangeEnd,
        setDateRangeStart,
        setDragOverGroupId,
        setDragOverSortIndex,
        setDraggedRider,
        setDraggedSortIndex,
        setEditDateValue,
        setEditGroupOverridesModal,
        setEditRiderForm,
        setEditTimeValue,
        setEditVoucherValue,
        setErrorMessage,
        setFilterDirectionFrom,
        setFilterDirectionTo,
        setIsAddRiderOpen,
        setIsDraggingOverCorral,
        setIsResizingChangeLog,
        setIsSubsidized,
        setMaxBags,
        setMinBags,
        setNewGroupContingencyVoucher,
        setNewGroupDate,
        setNewGroupSectionExpanded,
        setNewGroupTime,
        setNewGroupVoucher,
        setOverrideSubsidized,
        setOverrideUberType,
        setSelectedUberTypes,
        setSortingRules,
        setSubsidyFilter,
        setTimeConflictModal,
        setTimeRangeEnd,
        setTimeRangeStart,
        sortingRules,
        subsidyFilter,
        timeConflictModal,
        timeRangeEnd,
        timeRangeStart,
        validationErrorModal,
      },
    })

  if (loading) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="flex items-center space-x-4 rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
            <span className="text-lg font-medium text-gray-700">
              Loading Groups...
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (error && groups.length === 0 && unmatchedRiders.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-lg rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="font-medium text-red-700">{error}</p>
        </div>
      </div>
    )
  }

  const downloadAdminExport = async (kind: 'matched' | 'unmatched') => {
    if (!dateRangeStart || !dateRangeEnd) {
      setErrorMessage(
        `Please select both a start and end date before downloading the ${kind} CSV.`,
      )
      setTimeout(() => setErrorMessage(null), 5000)
      return
    }

    try {
      setErrorMessage(null)
      const response = await fetch(
        `/api/admin/groups/export?kind=${kind}&start=${encodeURIComponent(dateRangeStart)}&end=${encodeURIComponent(dateRangeEnd)}`,
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error || `Failed to generate ${kind} CSV`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${kind}-${dateRangeStart}-to-${dateRangeEnd}.csv`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      console.error(`Error downloading ${kind} CSV:`, error)
      setErrorMessage(
        `Failed to download ${kind} CSV: ${error.message || 'Unknown error'}`,
      )
      setTimeout(() => setErrorMessage(null), 5000)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Desktop: Title (left) | Search (center) | Buttons (right) */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {/* Title - Left */}
            <h1 className="flex-shrink-0 text-2xl font-bold text-gray-900">
              View & Manage Groups
            </h1>
            {/* Search Bar - Center */}
            <div className="flex flex-1 justify-center">
              <div className="relative w-full max-w-md">
                <input
                  type="text"
                  placeholder="Search by ride ID (#Num), name, flight, or voucher..."
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-20 text-sm text-gray-900 placeholder-gray-500 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                    searchFeedback ? 'bg-teal-50 ring-2 ring-teal-500' : ''
                  }`}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {(searchInput || searchQuery) && (
                    <button
                      onClick={handleClearSearch}
                      className="flex items-center justify-center rounded p-0.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="group">
                    <Info className="h-4 w-4 text-gray-400" />
                    <div className="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                      <p className="mb-1 font-semibold">Search Tips:</p>
                      <p className="mb-1">
                        • Use{' '}
                        <span className="font-mono font-semibold">#512</span> or{' '}
                        <span className="font-mono font-semibold">
                          #[512, 503]
                        </span>{' '}
                        to search by ride ID (single or multiple)
                      </p>
                      <p>
                        • Otherwise searches across names, flights, vouchers,
                        and ride IDs
                      </p>
                      <p>
                        • Must press enter to search after typing your search
                        query.
                      </p>
                      <div className="absolute right-2 top-full h-0 w-0 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Buttons - Right */}
            <div className="flex flex-shrink-0 items-center gap-3">
              {/* Filters Toggle Button */}
              <button
                onClick={handleFiltersToggle}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span>Filters & Options</span>
              </button>
              {/* Corral Toggle Button */}
              <button
                onClick={handleCorralToggle}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className={`h-4 w-4 flex-shrink-0 transition-transform ${corralCollapsed ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span>Corral</span>
                {corralRiders.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                    {corralRiders.length}
                  </span>
                )}
              </button>
              {/* Create Group Toggle Button */}
              <button
                onClick={() => {
                  if (leftSidebarTabs.includes('createGroup')) {
                    // If in left sidebar, expand sidebar and switch to tab
                    if (filtersCollapsed) {
                      setFiltersCollapsed(false)
                    }
                    setActiveLeftTab('createGroup')
                    setNewGroupSectionExpanded(true)
                  } else {
                    // If in right sidebar, toggle expansion
                    setNewGroupSectionExpanded(!newGroupSectionExpanded)
                  }
                }}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Create Group</span>
                {selectedRidersForNewGroup.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                    {selectedRidersForNewGroup.length}
                  </span>
                )}
              </button>
            </div>
          </div>
          {/* Mobile: Title and Buttons on first row, Create Group on second row, Search on third row */}
          <div className="flex flex-col gap-4 md:hidden">
            {/* First Row: Title and Buttons */}
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-2xl font-bold text-gray-900">
                View & Manage Groups
              </h1>
              <div className="flex items-center gap-3">
                {/* Filters Toggle Button */}
                <button
                  onClick={handleFiltersToggle}
                  className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <span className="sm:hidden">Filters</span>
                </button>
                {/* Corral Toggle Button */}
                <button
                  onClick={handleCorralToggle}
                  className="flex min-w-[120px] items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <svg
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${corralCollapsed ? 'rotate-180' : ''}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span>Corral</span>
                  {corralRiders.length > 0 && (
                    <span className="flex-shrink-0 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">
                      {corralRiders.length}
                    </span>
                  )}
                </button>
              </div>
            </div>
            {/* Second Row: Search Bar with Create Group Button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Search by ride ID (#Num), name, flight, or voucher..."
                  value={searchInput}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className={`w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-20 text-sm text-gray-900 placeholder-gray-500 transition-all focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 ${
                    searchFeedback ? 'bg-teal-50 ring-2 ring-teal-500' : ''
                  }`}
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                  {(searchInput || searchQuery) && (
                    <button
                      onClick={handleClearSearch}
                      className="flex items-center justify-center rounded p-0.5 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      title="Clear search"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <div className="group">
                    <Info className="h-4 w-4 text-gray-400" />
                    <div className="absolute bottom-full right-0 mb-2 hidden w-64 rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block">
                      <p className="mb-1 font-semibold">Search Tips:</p>
                      <p className="mb-1">
                        • Use{' '}
                        <span className="font-mono font-semibold">#512</span> or{' '}
                        <span className="font-mono font-semibold">
                          #[512, 503]
                        </span>{' '}
                        to search by ride ID (single or multiple)
                      </p>
                      <p>
                        • Otherwise searches across names, flights, vouchers,
                        and ride IDs
                      </p>
                      <div className="absolute right-2 top-full h-0 w-0 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  if (leftSidebarTabs.includes('createGroup')) {
                    // If in left sidebar, expand sidebar and switch to tab
                    if (filtersCollapsed) {
                      setFiltersCollapsed(false)
                    }
                    setActiveLeftTab('createGroup')
                    setNewGroupSectionExpanded(true)
                  } else {
                    // If in right sidebar, toggle expansion
                    setNewGroupSectionExpanded(!newGroupSectionExpanded)
                  }
                }}
                className="flex flex-shrink-0 items-center justify-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                title="Create Group"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {selectedRidersForNewGroup.length > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-800">
                    {selectedRidersForNewGroup.length}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <GroupsDataContext.Provider value={dataContextValue}>
        <GroupsActionsContext.Provider value={actionsContextValue}>
          <GroupsUiContext.Provider value={uiContextValue}>
            {/* Main Content - Three Panels */}
            <div className="flex flex-1 overflow-hidden">
              <div
                className={`${filtersCollapsed ? 'w-0 overflow-hidden md:w-12' : 'w-full md:w-72'} flex flex-col border-r border-gray-200 bg-white transition-all duration-300`}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-4">
                  {!filtersCollapsed && (
                    <div className="flex-1">
                      <div className="mb-2 flex gap-1">
                        {leftSidebarTabs.map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveLeftTab(tab)}
                            className={`flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                              activeLeftTab === tab
                                ? 'bg-teal-500 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {tab === 'filters' ? 'Filters' : 'Create Group'}
                          </button>
                        ))}
                      </div>
                      <h2 className="text-lg font-semibold text-gray-900">
                        {activeLeftTab === 'filters'
                          ? 'Group Filters'
                          : 'Create New Group'}
                      </h2>
                    </div>
                  )}
                  <button
                    onClick={handleFiltersToggle}
                    className="rounded p-1.5 text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                    title={
                      filtersCollapsed ? 'Expand sidebar' : 'Collapse sidebar'
                    }
                  >
                    <svg
                      className={`h-5 w-5 transition-transform ${filtersCollapsed ? '' : 'rotate-180'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                </div>

                {!filtersCollapsed && activeLeftTab === 'filters' && (
                  <FiltersPanel />
                )}
                {!filtersCollapsed && activeLeftTab === 'createGroup' && (
                  <div className="flex-1 space-y-4 overflow-y-auto p-4">
                    <CreateGroupPanel />
                  </div>
                )}
              </div>

              <div
                className={`flex-1 overflow-y-auto bg-gray-100 p-6 ${!filtersCollapsed || !corralCollapsed ? 'hidden md:block' : ''}`}
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:gap-2">
                  <div className="flex flex-1 items-center gap-2 md:flex-initial md:flex-none">
                    <button
                      onClick={() => setActiveTab('matched')}
                      className={`rounded-lg px-6 py-2 font-medium transition-all ${
                        activeTab === 'matched'
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                          : 'border border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      Matched Groups
                    </button>
                    <button
                      onClick={() => setActiveTab('unmatched')}
                      className={`rounded-lg px-6 py-2 font-medium transition-all ${
                        activeTab === 'unmatched'
                          ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white'
                          : 'border border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      Unmatched ({sortedUnmatchedRiders.length})
                    </button>
                    <button
                      onClick={() => setIsAddRiderOpen(true)}
                      className="ml-auto flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 md:hidden"
                      title="Add New Rider"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Add Rider</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 md:flex-initial md:flex-none">
                    <button
                      onClick={() => downloadAdminExport('matched')}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
                      title="Download Matched CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Matches CSV</span>
                    </button>
                    <button
                      onClick={() => downloadAdminExport('unmatched')}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-all hover:bg-gray-50"
                      title="Download Unmatched CSV"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Unmatched CSV</span>
                    </button>
                  </div>
                  <button
                    onClick={() => setIsAddRiderOpen(true)}
                    className="hidden items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 md:ml-auto md:flex"
                    title="Add New Rider"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>Add Rider</span>
                  </button>
                </div>

                {errorMessage && (
                  <div className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3">
                    <p className="text-sm text-red-800">{errorMessage}</p>
                  </div>
                )}

                {pendingRiderOperations.size > 0 && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm font-medium text-teal-800"
                    role="status"
                    aria-live="polite"
                  >
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving {pendingRiderOperations.size}{' '}
                    {pendingRiderOperations.size === 1
                      ? 'rider change'
                      : 'rider changes'}
                    ...
                  </div>
                )}

                <p className="mb-6 text-sm text-gray-600">
                  {activeTab === 'matched'
                    ? 'Drag and drop riders between groups or to the corral'
                    : 'View all unmatched riders - drag them to groups to assign'}
                </p>

                <div className="min-h-9 mb-4 flex flex-wrap items-center justify-between gap-3 border-y border-gray-200 py-2 text-sm text-gray-600">
                  <span>
                    Page {page} of {totalPages} · {totalRecords} flight records
                  </span>
                  <div className="flex items-center gap-2">
                    {refreshing && (
                      <span className="flex items-center gap-2 text-teal-700">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal-200 border-t-teal-600"></span>
                        Refreshing
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void goToPage(page - 1)}
                      disabled={refreshing || page <= 1}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      onClick={() => void goToPage(page + 1)}
                      disabled={refreshing || page >= totalPages}
                      className="rounded border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {activeTab === 'matched' && <MatchedGroupsPanel />}
                {activeTab === 'unmatched' && (
                  <UnmatchedRidersPanel
                    pendingFlightIds={pendingRiderOperations}
                  />
                )}
              </div>

              <CorralPanel pendingChangesLoading={pendingChangesLoading} />
            </div>

            <ChangeLogPanel
              hasMore={changeLogHasMore}
              loading={changeLogLoading}
              onLoadMore={loadMoreChangeLog}
            />
            <GroupsManagementModals />
          </GroupsUiContext.Provider>
        </GroupsActionsContext.Provider>
      </GroupsDataContext.Provider>
    </div>
  )
}
