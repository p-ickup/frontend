import { useCallback, useEffect, useRef, useState } from 'react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { requestJson } from '@/utils/api'

import {
  fetchChangeLogEntries,
  fetchPendingChangesSnapshot,
} from '../services/groupsReadService'
import type { GroupsManagementSnapshot } from '../services/groupsReadService'
import type {
  ChangeLogEntry,
  ChangedGroup,
  Group,
  Rider,
  UnmatchedIndividual,
} from '../types'

type SetState<T> = Dispatch<SetStateAction<T>>

export interface UseGroupsDataOrchestrationParams {
  changeLogExpanded: boolean
  corralTab: 'riders' | 'changes'
  dateRangeEnd: string
  dateRangeStart: string
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
  changeLogHasMore: boolean
  changeLogLoading: boolean
  error: string | null
  goToPage: (page: number) => Promise<void>
  loadMoreChangeLog: () => Promise<void>
  loading: boolean
  page: number
  pendingChangesLoading: boolean
  refreshAll: () => Promise<void>
  refreshChangeLog: () => Promise<void>
  refreshGroups: () => Promise<void>
  refreshLastAlgorithmRun: () => Promise<void>
  refreshUnconfirmed: (overrideGroups?: Group[]) => Promise<void>
  refreshing: boolean
  totalPages: number
  totalRecords: number
}

type GroupsSnapshotResponse = GroupsManagementSnapshot & {
  dateRangeStart: string
  dateRangeEnd: string
  lastAlgorithmRunDate: string
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback

export const useGroupsDataOrchestration = ({
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
}: UseGroupsDataOrchestrationParams): UseGroupsDataOrchestrationResult => {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalRecords, setTotalRecords] = useState(0)
  const [changeLogLoading, setChangeLogLoading] = useState(false)
  const [changeLogHasMore, setChangeLogHasMore] = useState(false)
  const [pendingChangesLoading, setPendingChangesLoading] = useState(false)
  const groupsRef = useRef(groups)
  const changeLogPageRef = useRef(0)
  const changeLogLoadedRef = useRef(false)
  const pendingLoadedRef = useRef(false)
  const loadedRangeRef = useRef({ start: '', end: '' })
  const snapshotRequestRef = useRef(0)

  useEffect(() => {
    groupsRef.current = groups
  }, [groups])

  const applyGroupsSnapshot = useCallback(
    (snapshot: GroupsSnapshotResponse) => {
      setAdminScope(snapshot.adminScope)
      setAvailableAirports(snapshot.availableAirports)
      setSelectedAirports(snapshot.availableAirports)
      setGroups(snapshot.groups)
      setUnmatchedRiders(snapshot.unmatchedRiders)
      setChangedGroups([])
      setUnmatchedIndividuals([])
      setLastAlgorithmRunDate(snapshot.lastAlgorithmRunDate)
      loadedRangeRef.current = {
        start: snapshot.dateRangeStart,
        end: snapshot.dateRangeEnd,
      }
      setDateRangeStart(snapshot.dateRangeStart)
      setDateRangeEnd(snapshot.dateRangeEnd)
      setPage(snapshot.pagination.page)
      setTotalPages(snapshot.pagination.totalPages)
      setTotalRecords(snapshot.pagination.totalRecords)
      pendingLoadedRef.current = false

      return snapshot.groups
    },
    [
      setAdminScope,
      setAvailableAirports,
      setChangedGroups,
      setGroups,
      setDateRangeEnd,
      setDateRangeStart,
      setLastAlgorithmRunDate,
      setSelectedAirports,
      setUnmatchedIndividuals,
      setUnmatchedRiders,
    ],
  )

  const loadGroupsSnapshot = useCallback(
    async ({
      requestedPage,
      requestedStart,
      requestedEnd,
    }: {
      requestedPage: number
      requestedStart?: string
      requestedEnd?: string
    }) => {
      const requestId = snapshotRequestRef.current + 1
      snapshotRequestRef.current = requestId
      try {
        const params = new URLSearchParams({
          page: String(requestedPage),
          pageSize: '200',
        })
        if (requestedStart) params.set('dateStart', requestedStart)
        if (requestedEnd) params.set('dateEnd', requestedEnd)
        const snapshot = await requestJson<GroupsSnapshotResponse>(
          `/api/admin/groups/snapshot?${params.toString()}`,
        )

        if (requestId !== snapshotRequestRef.current) {
          return groupsRef.current
        }

        return applyGroupsSnapshot(snapshot)
      } catch (nextError) {
        if (requestId !== snapshotRequestRef.current) {
          return groupsRef.current
        }
        console.error('Error fetching groups data:', nextError)
        setError(getErrorMessage(nextError, 'Failed to fetch group data'))
        throw nextError
      }
    },
    [applyGroupsSnapshot],
  )

  const refreshLastAlgorithmRun = useCallback(async () => {
    await loadGroupsSnapshot({
      requestedPage: page,
      requestedStart: dateRangeStart,
      requestedEnd: dateRangeEnd,
    })
  }, [dateRangeEnd, dateRangeStart, loadGroupsSnapshot, page])

  const refreshGroups = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      await loadGroupsSnapshot({
        requestedPage: page,
        requestedStart: dateRangeStart,
        requestedEnd: dateRangeEnd,
      })
    } finally {
      setRefreshing(false)
    }
  }, [dateRangeEnd, dateRangeStart, loadGroupsSnapshot, page])

  const refreshChangeLog = useCallback(async () => {
    setChangeLogLoading(true)
    try {
      const result = await fetchChangeLogEntries(supabase, {
        page: 1,
        pageSize: 100,
      })
      setChangeLog(result.entries)
      setChangeLogHasMore(result.hasMore)
      changeLogPageRef.current = 1
      changeLogLoadedRef.current = true
    } catch (nextError) {
      console.error('Error fetching changelog:', nextError)
      setError(getErrorMessage(nextError, 'Failed to fetch changelog'))
      throw nextError
    } finally {
      setChangeLogLoading(false)
    }
  }, [setChangeLog, supabase])

  const loadMoreChangeLog = useCallback(async () => {
    if (changeLogLoading || !changeLogHasMore) return
    setChangeLogLoading(true)
    try {
      const nextPage = changeLogPageRef.current + 1
      const result = await fetchChangeLogEntries(supabase, {
        page: nextPage,
        pageSize: 100,
      })
      setChangeLog((current) => {
        const combined = [...current, ...result.entries]
        return Array.from(
          new Map(combined.map((entry) => [entry.id, entry])).values(),
        )
      })
      setChangeLogHasMore(result.hasMore)
      changeLogPageRef.current = nextPage
    } finally {
      setChangeLogLoading(false)
    }
  }, [changeLogHasMore, changeLogLoading, setChangeLog, supabase])

  const refreshUnconfirmed = useCallback(
    async (overrideGroups?: Group[]) => {
      const sourceGroups = overrideGroups ?? groupsRef.current

      if (sourceGroups.length === 0) {
        setChangedGroups([])
        setUnmatchedIndividuals([])
        return
      }

      try {
        setPendingChangesLoading(true)
        const snapshot = await fetchPendingChangesSnapshot({
          supabase,
          groups: sourceGroups,
        })

        setChangedGroups(snapshot.changedGroups)
        setUnmatchedIndividuals(snapshot.unmatchedIndividuals)
        pendingLoadedRef.current = true
      } catch (nextError) {
        console.error('Error loading unconfirmed changes:', nextError)
        setError(getErrorMessage(nextError, 'Failed to load pending changes'))
        throw nextError
      } finally {
        setPendingChangesLoading(false)
      }
    },
    [setChangedGroups, setUnmatchedIndividuals, supabase],
  )

  const refreshAll = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      await loadGroupsSnapshot({ requestedPage: 1 })
    } catch {
      // Individual refresh helpers already log and store a user-facing error.
    } finally {
      setLoading(false)
    }
  }, [loadGroupsSnapshot])

  useEffect(() => {
    void refreshAll()
  }, [refreshAll])

  useEffect(() => {
    if (!changeLogExpanded || changeLogLoadedRef.current) return
    void refreshChangeLog().catch(() => undefined)
  }, [changeLogExpanded, refreshChangeLog])

  useEffect(() => {
    if (corralTab !== 'changes' || pendingLoadedRef.current) {
      return
    }
    void refreshUnconfirmed().catch(() => undefined)
  }, [corralTab, groups, refreshUnconfirmed])

  useEffect(() => {
    if (loading || !dateRangeStart || !dateRangeEnd) return
    if (
      loadedRangeRef.current.start === dateRangeStart &&
      loadedRangeRef.current.end === dateRangeEnd
    ) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setRefreshing(true)
      setError(null)
      void loadGroupsSnapshot({
        requestedPage: 1,
        requestedStart: dateRangeStart,
        requestedEnd: dateRangeEnd,
      })
        .catch(() => undefined)
        .finally(() => setRefreshing(false))
    }, 350)

    return () => window.clearTimeout(timeoutId)
  }, [dateRangeEnd, dateRangeStart, loadGroupsSnapshot, loading])

  const goToPage = useCallback(
    async (nextPage: number) => {
      if (nextPage < 1 || nextPage > totalPages || nextPage === page) return
      setRefreshing(true)
      setError(null)
      try {
        await loadGroupsSnapshot({
          requestedPage: nextPage,
          requestedStart: dateRangeStart,
          requestedEnd: dateRangeEnd,
        })
      } finally {
        setRefreshing(false)
      }
    },
    [dateRangeEnd, dateRangeStart, loadGroupsSnapshot, page, totalPages],
  )

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
    changeLogHasMore,
    changeLogLoading,
    error,
    goToPage,
    loadMoreChangeLog,
    loading,
    page,
    pendingChangesLoading,
    refreshAll,
    refreshChangeLog,
    refreshGroups,
    refreshLastAlgorithmRun,
    refreshUnconfirmed,
    refreshing,
    totalPages,
    totalRecords,
  }
}
