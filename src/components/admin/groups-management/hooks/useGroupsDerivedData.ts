import { useCallback, useMemo } from 'react'

import type {
  ChangeLogEntry,
  ChangeLogSortBy,
  ChangeLogSortDirection,
  Group,
  Rider,
  SortingRule,
} from '../types'
import type { FormattedChangeLogEntry } from '../utils'
import {
  calculateGroupTimeRange,
  formatChangeLogEntry as buildFormattedChangeLogEntry,
  formatVoucher,
  getDateInPST,
  getTodayInPST,
  getTotalBags,
  getUberType,
  isDatePassed,
  isGroupSubsidized,
  normalizeDateToYYYYMMDD,
  timeToMinutes,
} from '../utils'

type SubsidyFilter = 'subsidized' | 'unsubsidized' | 'all'

export interface UseGroupsDerivedDataParams {
  changeLog: ChangeLogEntry[]
  changeLogFilterActions: Set<string>
  changeLogFilterDateFrom: string
  changeLogFilterDateTo: string
  changeLogFilterName: string
  changeLogFilterSubjectName: string
  changeLogSortBy: ChangeLogSortBy
  changeLogSortDirection: ChangeLogSortDirection
  corralRiders: Rider[]
  dateRangeEnd: string
  dateRangeStart: string
  filterDirectionFrom: boolean
  filterDirectionTo: boolean
  groups: Group[]
  lastAlgorithmRunDate: string | null
  maxBags: string
  minBags: string
  searchQuery: string
  selectedAirports: string[]
  selectedUberTypes: Set<string>
  sortingRules: SortingRule[]
  subsidyFilter: SubsidyFilter
  timeRangeEnd: string
  timeRangeStart: string
  unmatchedRiders: Rider[]
}

export interface UseGroupsDerivedDataResult {
  filteredChangeLog: ChangeLogEntry[]
  filteredGroups: Group[]
  filteredUnmatchedRiders: Rider[]
  formatChangeLogEntry: (entry: ChangeLogEntry) => FormattedChangeLogEntry
  sortedChangeLog: ChangeLogEntry[]
  sortedCorralRiders: Rider[]
  sortedGroups: Group[]
  sortedUnmatchedRiders: Rider[]
}

const matchesGroupSearch = (group: Group, searchQuery: string) => {
  const trimmedQuery = searchQuery.trim()
  if (!trimmedQuery) return true

  const isRideIdSearch = trimmedQuery.startsWith('#')
  const restAfterHash = trimmedQuery.slice(1).trim()

  if (isRideIdSearch) {
    if (restAfterHash.startsWith('[') && restAfterHash.endsWith(']')) {
      const idsStr = restAfterHash.slice(1, -1)
      const rideIds = idsStr
        .split(',')
        .map((value) => parseInt(value.trim(), 10))
        .filter((value) => !Number.isNaN(value))

      return rideIds.length > 0 && rideIds.includes(group.ride_id)
    }

    return group.ride_id.toString().includes(restAfterHash.toLowerCase())
  }

  const query = trimmedQuery.toLowerCase()
  const rideIdMatch = group.ride_id.toString().includes(query)
  const nameMatch = group.riders.some((rider) =>
    rider.name.toLowerCase().includes(query),
  )
  const flightIdMatch = group.riders.some((rider) =>
    rider.flight_id.toString().includes(query),
  )
  const flightNoMatch = group.riders.some((rider) =>
    rider.flight_no?.toString().toLowerCase().includes(query),
  )
  const airlineFlightMatch = group.riders.some((rider) => {
    if (!rider.airline_iata || !rider.flight_no) return false

    return `${rider.airline_iata}${rider.flight_no}`
      .toLowerCase()
      .includes(query)
  })
  const groupVoucherMatch = group.group_voucher
    ? formatVoucher(group.group_voucher).toLowerCase().includes(query)
    : false

  return (
    rideIdMatch ||
    nameMatch ||
    flightIdMatch ||
    flightNoMatch ||
    airlineFlightMatch ||
    groupVoucherMatch
  )
}

const matchesRiderSearch = (rider: Rider, searchQuery: string) => {
  const query = searchQuery.toLowerCase().trim()
  if (!query) return true

  const nameMatch = rider.name.toLowerCase().includes(query)
  const flightIdMatch = rider.flight_id.toString().includes(query)
  const flightNoMatch = rider.flight_no
    ?.toString()
    .toLowerCase()
    .includes(query)
  const airlineFlightMatch =
    rider.airline_iata && rider.flight_no
      ? `${rider.airline_iata}${rider.flight_no}`.toLowerCase().includes(query)
      : false

  return nameMatch || flightIdMatch || flightNoMatch || airlineFlightMatch
}

const sortRidersWithRules = (riders: Rider[], sortingRules: SortingRule[]) => {
  return [...riders].sort((left, right) => {
    for (const rule of sortingRules) {
      if (rule.field === 'group_size') {
        continue
      }

      let comparison = 0

      switch (rule.field) {
        case 'bag_size': {
          const leftBags = left.checked_bags + left.carry_on_bags
          const rightBags = right.checked_bags + right.carry_on_bags
          comparison = leftBags - rightBags
          break
        }
        case 'date': {
          comparison =
            new Date(left.date).getTime() - new Date(right.date).getTime()
          break
        }
        case 'time': {
          const leftTime = left.time_range.split(' - ')[0]?.trim() || ''
          const rightTime = right.time_range.split(' - ')[0]?.trim() || ''
          comparison = leftTime.localeCompare(rightTime)
          break
        }
        case 'ride_id': {
          comparison = left.flight_id - right.flight_id
          break
        }
      }

      if (comparison !== 0) {
        return rule.direction === 'asc' ? comparison : -comparison
      }
    }

    return 0
  })
}

export const useGroupsDerivedData = ({
  changeLog,
  changeLogFilterActions,
  changeLogFilterDateFrom,
  changeLogFilterDateTo,
  changeLogFilterName,
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
}: UseGroupsDerivedDataParams): UseGroupsDerivedDataResult => {
  const filteredGroups = useMemo(
    () =>
      groups.filter((group) => {
        const airportMatch =
          selectedAirports.length === 0 ||
          selectedAirports.includes(group.airport)
        if (!airportMatch) return false

        const directionMatch =
          (filterDirectionTo && group.to_airport) ||
          (filterDirectionFrom && !group.to_airport)
        if (!directionMatch) return false

        if (dateRangeStart || dateRangeEnd) {
          const groupDateStr = normalizeDateToYYYYMMDD(group.date) || group.date
          if (dateRangeStart && groupDateStr < dateRangeStart) return false
          if (dateRangeEnd && groupDateStr > dateRangeEnd) return false
        }

        if (timeRangeStart && timeRangeEnd) {
          const calculatedTimeRange = calculateGroupTimeRange(group.riders)
          const [groupStart, groupEnd] = calculatedTimeRange
            .split(' - ')
            .map((value) => value?.trim())

          if (groupStart && groupEnd) {
            const filterStartMinutes = timeToMinutes(timeRangeStart)
            const filterEndMinutes = timeToMinutes(timeRangeEnd)
            const groupStartMinutes = timeToMinutes(
              groupStart.includes(':')
                ? groupStart.split(':').slice(0, 2).join(':')
                : groupStart,
            )
            const groupEndMinutes = timeToMinutes(
              groupEnd.includes(':')
                ? groupEnd.split(':').slice(0, 2).join(':')
                : groupEnd,
            )
            const isOvernightWindow = filterStartMinutes > filterEndMinutes
            const timeInRange = isOvernightWindow
              ? groupStartMinutes >= filterStartMinutes ||
                groupStartMinutes <= filterEndMinutes ||
                groupEndMinutes >= filterStartMinutes ||
                groupEndMinutes <= filterEndMinutes
              : (groupStartMinutes >= filterStartMinutes &&
                  groupStartMinutes <= filterEndMinutes) ||
                (groupEndMinutes >= filterStartMinutes &&
                  groupEndMinutes <= filterEndMinutes) ||
                (groupStartMinutes <= filterStartMinutes &&
                  groupEndMinutes >= filterEndMinutes)

            if (!timeInRange) return false
          }
        }

        const riderCount = group.riders.length
        const persistedOrComputedSubsidized =
          group.is_subsidized ?? isGroupSubsidized(group.airport, riderCount)

        if (subsidyFilter === 'subsidized' && !persistedOrComputedSubsidized) {
          return false
        }
        if (subsidyFilter === 'unsubsidized' && persistedOrComputedSubsidized) {
          return false
        }

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
          return false
        }

        if (minBags || maxBags) {
          const totalBags = getTotalBags(group.riders)
          if (minBags && totalBags < parseInt(minBags, 10)) return false
          if (maxBags && totalBags > parseInt(maxBags, 10)) return false
        }

        return matchesGroupSearch(group, searchQuery)
      }),
    [
      dateRangeEnd,
      dateRangeStart,
      filterDirectionFrom,
      filterDirectionTo,
      groups,
      maxBags,
      minBags,
      searchQuery,
      selectedAirports,
      selectedUberTypes,
      subsidyFilter,
      timeRangeEnd,
      timeRangeStart,
    ],
  )

  const sortedGroups = useMemo(() => {
    const todayPST = getTodayInPST()

    return [...filteredGroups].sort((left, right) => {
      const leftDatePST = getDateInPST(left.date)
      const rightDatePST = getDateInPST(right.date)
      const leftIsPast = leftDatePST < todayPST
      const rightIsPast = rightDatePST < todayPST

      if (leftIsPast && !rightIsPast) return 1
      if (!leftIsPast && rightIsPast) return -1

      for (const rule of sortingRules) {
        let comparison = 0

        switch (rule.field) {
          case 'bag_size': {
            comparison = getTotalBags(left.riders) - getTotalBags(right.riders)
            break
          }
          case 'group_size': {
            comparison = left.riders.length - right.riders.length
            break
          }
          case 'date': {
            comparison =
              new Date(left.date).getTime() - new Date(right.date).getTime()
            break
          }
          case 'time': {
            const leftTime = left.time_range.split(' - ')[0]?.trim() || ''
            const rightTime = right.time_range.split(' - ')[0]?.trim() || ''
            comparison = leftTime.localeCompare(rightTime)
            break
          }
          case 'ride_id': {
            comparison = left.ride_id - right.ride_id
            break
          }
        }

        if (comparison !== 0) {
          return rule.direction === 'asc' ? comparison : -comparison
        }
      }

      return 0
    })
  }, [filteredGroups, sortingRules])

  const filteredUnmatchedRiders = useMemo(
    () =>
      unmatchedRiders.filter((rider) => {
        if (lastAlgorithmRunDate && !dateRangeStart && !dateRangeEnd) {
          const riderDate = new Date(rider.date)
          const runDate = new Date(lastAlgorithmRunDate)
          riderDate.setHours(0, 0, 0, 0)
          runDate.setHours(0, 0, 0, 0)

          if (riderDate < runDate) {
            return false
          }
        }

        if (dateRangeStart || dateRangeEnd) {
          const riderDate = new Date(rider.date)
          riderDate.setHours(0, 0, 0, 0)

          if (dateRangeStart) {
            const startDate = new Date(dateRangeStart)
            startDate.setHours(0, 0, 0, 0)
            if (riderDate < startDate) {
              return false
            }
          }

          if (dateRangeEnd) {
            const endDate = new Date(dateRangeEnd)
            endDate.setHours(23, 59, 59, 999)
            if (riderDate > endDate) {
              return false
            }
          }
        }

        if (!selectedAirports.includes(rider.airport)) return false

        if (minBags || maxBags) {
          const totalBags = rider.checked_bags + rider.carry_on_bags
          if (minBags && totalBags < parseInt(minBags, 10)) return false
          if (maxBags && totalBags > parseInt(maxBags, 10)) return false
        }

        return matchesRiderSearch(rider, searchQuery)
      }),
    [
      dateRangeEnd,
      dateRangeStart,
      lastAlgorithmRunDate,
      maxBags,
      minBags,
      searchQuery,
      selectedAirports,
      unmatchedRiders,
    ],
  )

  const sortedUnmatchedRiders = useMemo(() => {
    const nonPastDateRiders = filteredUnmatchedRiders.filter(
      (rider) => !isDatePassed(rider.date),
    )
    const pastDateRiders = filteredUnmatchedRiders.filter((rider) =>
      isDatePassed(rider.date),
    )

    return [
      ...sortRidersWithRules(nonPastDateRiders, sortingRules),
      ...sortRidersWithRules(pastDateRiders, sortingRules),
    ]
  }, [filteredUnmatchedRiders, sortingRules])

  const sortedCorralRiders = useMemo(
    () => sortRidersWithRules(corralRiders, sortingRules),
    [corralRiders, sortingRules],
  )

  const riderNamesByUserId = useMemo(() => {
    const names = new Map<string, string>()

    for (const rider of unmatchedRiders) {
      if (!names.has(rider.user_id)) {
        names.set(rider.user_id, rider.name)
      }
    }

    for (const rider of corralRiders) {
      if (!names.has(rider.user_id)) {
        names.set(rider.user_id, rider.name)
      }
    }

    for (const rider of groups.flatMap((group) => group.riders)) {
      if (!names.has(rider.user_id)) {
        names.set(rider.user_id, rider.name)
      }
    }

    return names
  }, [corralRiders, groups, unmatchedRiders])

  const formatChangeLogEntry = useCallback(
    (entry: ChangeLogEntry): FormattedChangeLogEntry =>
      buildFormattedChangeLogEntry(entry, {
        groups,
        unmatchedRiders,
        corralRiders,
      }),
    [corralRiders, groups, unmatchedRiders],
  )

  const filteredChangeLog = useMemo(
    () =>
      changeLog.filter((entry) => {
        if (changeLogFilterName.trim()) {
          const nameMatch = entry.actor_name
            ?.toLowerCase()
            .includes(changeLogFilterName.toLowerCase().trim())

          if (!nameMatch) return false
        }

        if (changeLogFilterSubjectName.trim()) {
          const query = changeLogFilterSubjectName.toLowerCase().trim()
          const metadata = entry.metadata || {}
          const nameParts: string[] = []

          if (
            typeof metadata.rider_name === 'string' &&
            metadata.rider_name.trim()
          ) {
            nameParts.push(metadata.rider_name)
          }

          if (Array.isArray(metadata.rider_names)) {
            for (const riderName of metadata.rider_names) {
              if (typeof riderName === 'string' && riderName.trim()) {
                nameParts.push(riderName)
              }
            }
          }

          if (entry.target_user_id) {
            const foundName = riderNamesByUserId.get(entry.target_user_id)
            if (foundName) {
              nameParts.push(foundName)
            }
          }

          if (!nameParts.join(' ').toLowerCase().includes(query)) {
            return false
          }
        }

        if (
          changeLogFilterActions.size > 0 &&
          !changeLogFilterActions.has(entry.action)
        ) {
          return false
        }

        if (changeLogFilterDateFrom || changeLogFilterDateTo) {
          const entryDate = new Date(entry.created_at)

          if (changeLogFilterDateFrom) {
            const fromDate = new Date(changeLogFilterDateFrom)
            fromDate.setHours(0, 0, 0, 0)
            entryDate.setHours(0, 0, 0, 0)
            if (entryDate < fromDate) return false
          }

          if (changeLogFilterDateTo) {
            const toDate = new Date(changeLogFilterDateTo)
            toDate.setHours(23, 59, 59, 999)
            entryDate.setHours(23, 59, 59, 999)
            if (entryDate > toDate) return false
          }
        }

        return true
      }),
    [
      changeLog,
      changeLogFilterActions,
      changeLogFilterDateFrom,
      changeLogFilterDateTo,
      changeLogFilterName,
      changeLogFilterSubjectName,
      riderNamesByUserId,
    ],
  )

  const sortedChangeLog = useMemo(
    () =>
      [...filteredChangeLog].sort((left, right) => {
        let comparison = 0

        switch (changeLogSortBy) {
          case 'date':
            comparison =
              new Date(left.created_at).getTime() -
              new Date(right.created_at).getTime()
            break
          case 'actor':
            comparison = (left.actor_name || '').localeCompare(
              right.actor_name || '',
            )
            break
          case 'action':
            comparison = left.action.localeCompare(right.action)
            break
        }

        return changeLogSortDirection === 'asc' ? comparison : -comparison
      }),
    [changeLogSortBy, changeLogSortDirection, filteredChangeLog],
  )

  return {
    filteredChangeLog,
    filteredGroups,
    filteredUnmatchedRiders,
    formatChangeLogEntry,
    sortedChangeLog,
    sortedCorralRiders,
    sortedGroups,
    sortedUnmatchedRiders,
  }
}
