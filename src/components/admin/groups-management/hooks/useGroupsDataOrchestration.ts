import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'

import {
  fetchChangeLogEntries,
  fetchGroupsManagementSnapshot,
  fetchLastAlgorithmRunWindow,
  fetchPendingChangesSnapshot,
} from '../services/groupsReadService'
import type {
  ChangeLogEntry,
  ChangedGroup,
  Group,
  Rider,
  UnmatchedIndividual,
} from '../types'

type SetState<T> = Dispatch<SetStateAction<T>>

export interface UseGroupsDataOrchestrationParams {
  currentUserId?: string
  groups: Group[]
  isResizingChangeLog: boolean
  resizeStartRef: MutableRefObject<{ y: number; height: number } | null>
  setAdminScope: SetState<string | null>
  setAvailableAirports: SetState<string[]>
  setChangeLog: SetState<ChangeLogEntry[]>
  setChangeLogHeight: SetState<number>
  setChangedGroups: SetState<ChangedGroup[]>
  setCorralCollapsed: SetState<boolean>
  setDateRangeEnd: SetState<string>
  setDateRangeStart: SetState<string>
  setFiltersCollapsed: SetState<boolean>
  setGroups: SetState<Group[]>
  setIsResizingChangeLog: SetState<boolean>
  setLastAlgorithmRunDate: SetState<string | null>
  setSelectedAirports: SetState<string[]>
  setUnmatchedIndividuals: SetState<UnmatchedIndividual[]>
  setUnmatchedRiders: SetState<Rider[]>
  supabase: any
}

export interface UseGroupsDataOrchestrationResult {
  error: string | null
  loading: boolean
  refreshAll: () => Promise<void>
  refreshChangeLog: () => Promise<void>
  refreshGroups: () => Promise<void>
  refreshLastAlgorithmRun: () => Promise<void>
  refreshUnconfirmed: (overrideGroups?: Group[]) => Promise<void>
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const useGroupsDataOrchestration = ({
  currentUserId,
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
}: UseGroupsDataOrchestrationParams): UseGroupsDataOrchestrationResult => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const groupsRef = useRef(groups)
  const skipNextGroupsRefreshRef = useRef(false)

  useEffect(() => {
    groupsRef.current = groups
  }, [groups])

  const applyGroupsSnapshot = useCallback(
    (snapshot: Awaited<ReturnType<typeof fetchGroupsManagementSnapshot>>) => {
      setAdminScope(snapshot.adminScope)
      setAvailableAirports(snapshot.availableAirports)
      setSelectedAirports(snapshot.availableAirports)
      setGroups(snapshot.groups)
      setUnmatchedRiders(snapshot.unmatchedRiders)

      return snapshot.groups
    },
    [
      setAdminScope,
      setAvailableAirports,
      setGroups,
      setSelectedAirports,
      setUnmatchedRiders,
    ],
  )

  const loadGroupsSnapshot = useCallback(async () => {
    try {
      const snapshot = await fetchGroupsManagementSnapshot({
        supabase,
        currentUserId,
      })

      return applyGroupsSnapshot(snapshot)
    } catch (nextError) {
      console.error('Error fetching groups data:', nextError)
      setError(getErrorMessage(nextError, 'Failed to fetch group data'))
      throw nextError
    }
  }, [applyGroupsSnapshot, currentUserId, supabase])

  const refreshLastAlgorithmRun = useCallback(async () => {
    try {
      const window = await fetchLastAlgorithmRunWindow(supabase)
      if (!window) return

      setLastAlgorithmRunDate(window.lastAlgorithmRunDate)
      setDateRangeStart(window.dateRangeStart)
      setDateRangeEnd(window.dateRangeEnd)
    } catch (nextError) {
      console.error('Error fetching last algorithm run:', nextError)
      setError(getErrorMessage(nextError, 'Failed to fetch algorithm status'))
      throw nextError
    }
  }, [setDateRangeEnd, setDateRangeStart, setLastAlgorithmRunDate, supabase])

  const refreshGroups = useCallback(async () => {
    await loadGroupsSnapshot()
  }, [loadGroupsSnapshot])

  const refreshChangeLog = useCallback(async () => {
    try {
      const entries = await fetchChangeLogEntries(supabase)
      setChangeLog(entries)
    } catch (nextError) {
      console.error('Error fetching changelog:', nextError)
      setError(getErrorMessage(nextError, 'Failed to fetch changelog'))
      throw nextError
    }
  }, [setChangeLog, supabase])

  const refreshUnconfirmed = useCallback(
    async (overrideGroups?: Group[]) => {
      const sourceGroups = overrideGroups ?? groupsRef.current

      if (sourceGroups.length === 0) {
        setChangedGroups([])
        setUnmatchedIndividuals([])
        return
      }

      try {
        const snapshot = await fetchPendingChangesSnapshot({
          supabase,
          groups: sourceGroups,
        })

        setChangedGroups(snapshot.changedGroups)
        setUnmatchedIndividuals(snapshot.unmatchedIndividuals)
      } catch (nextError) {
        console.error('Error loading unconfirmed changes:', nextError)
        setError(getErrorMessage(nextError, 'Failed to load pending changes'))
        throw nextError
      }
    },
    [setChangedGroups, setUnmatchedIndividuals, supabase],
  )

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      skipNextGroupsRefreshRef.current = true
      await refreshLastAlgorithmRun()
      const nextGroups = await loadGroupsSnapshot()
      await refreshChangeLog()
      await refreshUnconfirmed(nextGroups)
    } catch {
      // Individual refresh helpers already log and store a user-facing error.
    } finally {
      setLoading(false)
    }
  }, [
    loadGroupsSnapshot,
    refreshChangeLog,
    refreshLastAlgorithmRun,
    refreshUnconfirmed,
  ])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (skipNextGroupsRefreshRef.current) {
      skipNextGroupsRefreshRef.current = false
      return
    }

    if (groups.length > 0) {
      void refreshUnconfirmed()
    }
  }, [groups.length, refreshUnconfirmed])

  useEffect(() => {
    const isMobile = window.innerWidth < 768
    if (isMobile) {
      setFiltersCollapsed(true)
      setCorralCollapsed(true)
      return
    }

    setFiltersCollapsed(false)
    setCorralCollapsed(false)
  }, [setCorralCollapsed, setFiltersCollapsed])

  useEffect(() => {
    if (!isResizingChangeLog || !resizeStartRef.current) return

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStartRef.current) return

      const deltaY = resizeStartRef.current.y - event.clientY
      const newHeight = resizeStartRef.current.height + deltaY
      const minHeight = 100
      const maxHeight = window.innerHeight - 300
      setChangeLogHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)))
    }

    const handleMouseUp = () => {
      setIsResizingChangeLog(false)
      resizeStartRef.current = null
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [
    isResizingChangeLog,
    resizeStartRef,
    setChangeLogHeight,
    setIsResizingChangeLog,
  ])

  return {
    error,
    loading,
    refreshAll,
    refreshChangeLog,
    refreshGroups,
    refreshLastAlgorithmRun,
    refreshUnconfirmed,
  }
}
