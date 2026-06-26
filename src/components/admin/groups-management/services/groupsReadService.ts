type GroupsSupabaseClient = any

import { buildNoShowLookup } from '@/utils/adminMatchNoShows'
import { toAdminGroupRowDto } from '@/contracts/readModels'

import type {
  ChangeLogEntry,
  ChangedGroup,
  Group,
  Rider,
  UnmatchedIndividual,
} from '../types'
import {
  calculateGroupTimeRange,
  consolidateChangeDescriptions,
  getChangeDescription,
  normalizeDateToYYYYMMDD,
} from '../utils'

type PendingChangeRow = {
  id: string
  metadata?: any
  created_at: string
  action: string
  change_batch_id?: string | null
  confirmed?: boolean
  target_group_id?: number | string | null
  target_user_id?: string | null
}

export interface AlgorithmRunWindow {
  lastAlgorithmRunDate: string
  dateRangeStart: string
  dateRangeEnd: string
}

export interface GroupsManagementSnapshot {
  adminScope: string | null
  availableAirports: string[]
  groups: Group[]
  unmatchedRiders: Rider[]
  pagination: {
    page: number
    pageSize: number
    totalRecords: number
    totalPages: number
  }
}

export interface PendingChangesSnapshot {
  changedGroups: ChangedGroup[]
  unmatchedIndividuals: UnmatchedIndividual[]
}

const CHANGE_ACTIONS = [
  'UPDATE_GROUP_TIME',
  'ADD_TO_GROUP',
  'REMOVE_FROM_GROUP',
  'CREATE_GROUP',
  'DELETE_GROUP',
]

const createError = (error: any, fallback: string) => {
  const message = error?.message || fallback
  const details = error?.details || error?.hint
  return new Error(details ? `${message} (${details})` : message)
}

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getDefaultDateWindow = () => {
  const currentDate = new Date()
  const dateRangeStartDate = new Date(currentDate)
  dateRangeStartDate.setDate(dateRangeStartDate.getDate() - 7)
  const dateRangeEndDate = new Date(currentDate)
  dateRangeEndDate.setMonth(dateRangeEndDate.getMonth() + 1)

  return {
    dateRangeStart: formatDateForInput(dateRangeStartDate),
    dateRangeEnd: formatDateForInput(dateRangeEndDate),
  }
}

const fetchUsersInBatches = async (
  supabase: GroupsSupabaseClient,
  userIds: string[],
  select: string,
  batchSize = 100,
) => {
  const batches: string[][] = []
  for (let index = 0; index < userIds.length; index += batchSize) {
    batches.push(userIds.slice(index, index + batchSize))
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const { data, error } = await supabase
        .from('Users')
        .select(select)
        .in('user_id', batch)

      if (error) throw createError(error, 'Failed to fetch users')
      return data || []
    }),
  )

  return results.flat()
}

const buildUsersMap = (users: any[]) =>
  new Map(
    users.map((user) => [
      String(user.user_id),
      {
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumber: user.phonenumber,
        sms_opt_in: user.sms_opt_in ?? null,
        school: user.school,
      },
    ]),
  )

const resolveRideIdFromChange = (change: PendingChangeRow): number | null => {
  if (change.target_group_id) {
    const parsed =
      typeof change.target_group_id === 'number'
        ? change.target_group_id
        : parseInt(change.target_group_id, 10)
    if (!isNaN(parsed)) return parsed
  }

  const metadata = change.metadata || {}
  if (change.action === 'ADD_TO_GROUP') {
    return metadata.to_group || metadata.ride_id || null
  }
  if (change.action === 'REMOVE_FROM_GROUP') {
    return metadata.from_group || null
  }
  return metadata.ride_id || metadata.to_group || metadata.from_group || null
}

const resolveGroupChangeTypes = (
  changes: PendingChangeRow[],
): Map<number, Set<string>> => {
  const changeTypesByGroup = new Map<number, Set<string>>()

  changes.forEach((change) => {
    const rideId = resolveRideIdFromChange(change)
    if (!rideId || isNaN(rideId)) return

    if (!changeTypesByGroup.has(rideId)) {
      changeTypesByGroup.set(rideId, new Set())
    }
    changeTypesByGroup.get(rideId)!.add(change.action)
  })

  return changeTypesByGroup
}

const deleteReversedPendingChanges = async (
  _supabase: GroupsSupabaseClient,
  groups: Group[],
  changes: PendingChangeRow[],
): Promise<PendingChangeRow[]> => {
  const changesByRideId = new Map<number, PendingChangeRow[]>()

  changes.forEach((change) => {
    const rideId = resolveRideIdFromChange(change)
    if (!rideId || isNaN(rideId)) return

    if (!changesByRideId.has(rideId)) {
      changesByRideId.set(rideId, [])
    }
    changesByRideId.get(rideId)!.push(change)
  })

  const changesToDelete: string[] = []

  for (const [rideId, groupChanges] of Array.from(changesByRideId.entries())) {
    const group = groups.find((candidate) => candidate.ride_id === rideId)
    if (!group) continue

    const removedRiders = new Map<
      string,
      { changeId: string; change: PendingChangeRow }
    >()
    const addedRiders = new Map<
      string,
      { changeId: string; change: PendingChangeRow }
    >()

    const sortedChanges = [...groupChanges].sort(
      (left, right) =>
        new Date(left.created_at).getTime() -
        new Date(right.created_at).getTime(),
    )

    sortedChanges.forEach((change) => {
      const metadata = change.metadata || {}
      const flightId = metadata.rider_flight_id || metadata.flight_id
      if (!flightId) return

      const key = `${rideId}-${flightId}`
      const changeRideId = resolveRideIdFromChange(change)
      if (changeRideId !== rideId) return

      if (change.action === 'REMOVE_FROM_GROUP') {
        removedRiders.set(key, { changeId: change.id, change })
      } else if (change.action === 'ADD_TO_GROUP') {
        addedRiders.set(key, { changeId: change.id, change })
      }
    })

    removedRiders.forEach((removeData, key) => {
      const addData = addedRiders.get(key)
      if (!addData) return

      const removeTime = new Date(removeData.change.created_at).getTime()
      const addTime = new Date(addData.change.created_at).getTime()
      if (removeTime >= addTime) return

      const flightId =
        removeData.change.metadata?.rider_flight_id ||
        removeData.change.metadata?.flight_id
      if (!flightId) return

      const isCurrentlyInGroup = group.riders.some(
        (rider) => rider.flight_id === flightId,
      )
      if (
        isCurrentlyInGroup &&
        !removeData.change.confirmed &&
        !addData.change.confirmed
      ) {
        changesToDelete.push(removeData.changeId, addData.changeId)
      }
    })

    addedRiders.forEach((addData, key) => {
      const removeData = removedRiders.get(key)
      if (!removeData) return

      const addTime = new Date(addData.change.created_at).getTime()
      const removeTime = new Date(removeData.change.created_at).getTime()
      if (addTime >= removeTime) return

      const flightId =
        addData.change.metadata?.rider_flight_id ||
        addData.change.metadata?.flight_id
      if (!flightId) return

      const isCurrentlyInGroup = group.riders.some(
        (rider) => rider.flight_id === flightId,
      )
      if (
        !isCurrentlyInGroup &&
        !addData.change.confirmed &&
        !removeData.change.confirmed
      ) {
        changesToDelete.push(addData.changeId, removeData.changeId)
      }
    })
  }

  if (changesToDelete.length === 0) {
    return changes
  }

  const uniqueChangeIds = Array.from(new Set(changesToDelete))
  const deletedIds = new Set(uniqueChangeIds)

  // Treat reversed add/remove pairs as resolved for the pending UI without
  // mutating the audit trail itself.
  return changes.filter((change) => !deletedIds.has(change.id))
}

export const fetchLastAlgorithmRunWindow = async (
  supabase: GroupsSupabaseClient,
): Promise<AlgorithmRunWindow | null> => {
  const { data, error } = await supabase
    .from('AlgorithmStatus')
    .select('finished_at')
    .eq('status', 'success')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw createError(error, 'Failed to fetch algorithm status')
  }

  const { dateRangeStart, dateRangeEnd } = getDefaultDateWindow()

  return {
    lastAlgorithmRunDate: data?.finished_at
      ? formatDateForInput(new Date(data.finished_at))
      : '',
    dateRangeStart,
    dateRangeEnd,
  }
}

export const fetchGroupsManagementSnapshot = async ({
  supabase,
  adminScope,
  dateRangeStart,
  dateRangeEnd,
  page = 1,
  pageSize = 200,
}: {
  supabase: GroupsSupabaseClient
  adminScope: string | null
  dateRangeStart: string
  dateRangeEnd: string
  page?: number
  pageSize?: number
}): Promise<GroupsManagementSnapshot> => {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const {
    data: flightsDataRaw,
    count,
    error: flightsError,
  } = await supabase
    .from('Flights')
    .select(
      `
        flight_id,
        airport,
        date,
        earliest_time,
        latest_time,
        to_airport,
        bag_no,
        bag_no_large,
        bag_no_personal,
        user_id,
        matching_status,
        flight_no,
        airline_iata,
        opt_in,
        original_unmatched
      `,
      { count: 'exact' },
    )
    .gte('date', dateRangeStart)
    .lte('date', dateRangeEnd)
    .order('date', { ascending: true })
    .order('flight_id', { ascending: true })
    .range(from, to)

  if (flightsError) {
    throw createError(flightsError, 'Failed to fetch flights')
  }

  const flightsData = flightsDataRaw || []
  const totalRecords = count || 0
  const pagination = {
    page,
    pageSize,
    totalRecords,
    totalPages: Math.max(1, Math.ceil(totalRecords / pageSize)),
  }

  if (flightsData.length === 0) {
    return {
      adminScope,
      availableAirports: [],
      groups: [],
      unmatchedRiders: [],
      pagination,
    }
  }

  const pageFlightIds = flightsData.map((flight: any) => flight.flight_id)
  const { data: pageMatches, error: pageMatchesError } = await supabase
    .from('Matches')
    .select('ride_id, flight_id')
    .in('flight_id', pageFlightIds)

  if (pageMatchesError) {
    throw createError(pageMatchesError, 'Failed to identify page groups')
  }

  const rideIds = Array.from(
    new Set((pageMatches || []).map((match: any) => match.ride_id)),
  )
  const { data: matchesDataRaw, error: matchesError } = rideIds.length
    ? await supabase
        .from('Matches')
        .select(
          'ride_id, flight_id, user_id, voucher, time, date, uber_type, is_subsidized, subsidized_override, uber_type_override, reported_missing_user_ids, ready_for_pickup_status, ready_for_pickup_at',
        )
        .in('ride_id', rideIds)
    : { data: [], error: null }

  if (matchesError) {
    throw createError(matchesError, 'Failed to fetch complete groups')
  }

  const matchesData = matchesDataRaw || []
  const matchFlightIds = Array.from(
    new Set(matchesData.map((match: any) => match.flight_id)),
  )
  const missingMatchFlightIds = matchFlightIds.filter(
    (flightId) => !pageFlightIds.includes(flightId),
  )

  const { data: additionalMatchFlights, error: matchFlightsError } =
    missingMatchFlightIds.length
      ? await supabase
          .from('Flights')
          .select(
            'flight_id, airport, date, earliest_time, latest_time, to_airport, bag_no, bag_no_large, bag_no_personal, user_id, matching_status, flight_no, airline_iata, opt_in, original_unmatched',
          )
          .in('flight_id', missingMatchFlightIds)
      : { data: [], error: null }

  if (matchFlightsError) {
    throw createError(matchFlightsError, 'Failed to fetch matched flights')
  }

  const allFlightsData = [...flightsData, ...(additionalMatchFlights || [])]

  const userIds = Array.from(
    new Set(allFlightsData.map((flight) => flight.user_id).filter(Boolean)),
  )

  const allUsersData =
    userIds.length > 0
      ? await fetchUsersInBatches(
          supabase,
          userIds,
          'user_id, firstname, lastname, phonenumber, school, sms_opt_in',
        )
      : []

  const usersMap = buildUsersMap(allUsersData)
  const flightsWithUsers = allFlightsData.map((flight) => ({
    ...flight,
    Users: flight.user_id ? usersMap.get(String(flight.user_id)) || null : null,
  }))

  const availableAirports: string[] = Array.from(
    new Set<string>(
      (flightsData as Array<{ airport?: unknown }>)
        .map((flight: any) => flight.airport)
        .filter(
          (airport: unknown): airport is string =>
            typeof airport === 'string' && airport.length > 0,
        ),
    ),
  )

  const noShowLookup = await buildNoShowLookup(supabase, matchesData)

  if (matchesData.length === 0) {
    let unmatchedRiders = flightsWithUsers
      .filter((flight) => flight.matching_status !== 'matched')
      .map((flight) => {
        const userData = Array.isArray(flight.Users)
          ? flight.Users[0]
          : flight.Users

        return {
          user_id: flight.user_id,
          flight_id: flight.flight_id,
          name:
            `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
            'Unknown',
          phone: userData?.phonenumber || 'N/A',
          sms_opt_in: userData?.sms_opt_in ?? null,
          checked_bags: flight.bag_no_large || 0,
          carry_on_bags: flight.bag_no || 0,
          time_range: `${flight.earliest_time} - ${flight.latest_time}`,
          airport: flight.airport,
          to_airport: flight.to_airport,
          date: normalizeDateToYYYYMMDD(flight.date),
          reason: 'unmatched',
          flight_no: flight.flight_no || '',
          airline_iata: flight.airline_iata || '',
          school: userData?.school || undefined,
          original_unmatched: flight.original_unmatched ?? false,
        } satisfies Rider
      })

    if (adminScope) {
      unmatchedRiders = unmatchedRiders.filter(
        (rider) => rider.school === adminScope,
      )
    }

    return {
      adminScope,
      availableAirports,
      groups: [],
      unmatchedRiders,
      pagination,
    }
  }
  const flightsMap = new Map<number, any>()

  flightsWithUsers.forEach((flight) => {
    flightsMap.set(flight.flight_id, flight)
  })

  const groupsMap = new Map<number, Group>()
  const matchedFlightIds = new Set<number>()

  matchesData.forEach((match: any) => {
    const flight = flightsMap.get(match.flight_id)

    if (!flight) {
      if (!groupsMap.has(match.ride_id)) {
        groupsMap.set(match.ride_id, {
          ride_id: match.ride_id,
          airport: '—',
          date: '',
          time_range: '—',
          match_time: match.time || undefined,
          to_airport: true,
          riders: [],
          group_voucher: match.voucher || undefined,
          uber_type: match.uber_type || undefined,
          is_subsidized: match.is_subsidized ?? undefined,
          subsidized_override: match.subsidized_override,
          uber_type_override: match.uber_type_override,
        })
      }

      groupsMap.get(match.ride_id)!.riders.push({
        user_id: match.user_id ?? '',
        flight_id: match.flight_id,
        name: '[Missing flight data]',
        phone: 'N/A',
        checked_bags: 0,
        carry_on_bags: 0,
        time_range: '—',
        airport: '—',
        to_airport: true,
        date: '',
        flight_no: '',
        airline_iata: '',
        school: undefined,
        original_unmatched: false,
        no_show: noShowLookup.get(
          `${match.ride_id}:${String(match.user_id ?? '')}`,
        ),
      })
      return
    }

    matchedFlightIds.add(match.flight_id)

    if (!groupsMap.has(match.ride_id)) {
      groupsMap.set(match.ride_id, {
        ride_id: match.ride_id,
        airport: flight.airport,
        date:
          normalizeDateToYYYYMMDD(match.date) ||
          normalizeDateToYYYYMMDD(flight.date),
        time_range: `${flight.earliest_time} - ${flight.latest_time}`,
        match_time: match.time || undefined,
        to_airport: flight.to_airport,
        riders: [],
        group_voucher: match.voucher || undefined,
        uber_type: match.uber_type || undefined,
        is_subsidized: match.is_subsidized ?? undefined,
        subsidized_override: match.subsidized_override,
        uber_type_override: match.uber_type_override,
      })
    }

    const group = groupsMap.get(match.ride_id)!
    const userData = flight.Users || null
    group.riders.push({
      user_id: flight.user_id,
      flight_id: flight.flight_id,
      name:
        `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
        'Unknown',
      phone: userData?.phonenumber || 'N/A',
      sms_opt_in: userData?.sms_opt_in ?? null,
      checked_bags: flight.bag_no_large || 0,
      carry_on_bags: flight.bag_no || 0,
      time_range: `${flight.earliest_time} - ${flight.latest_time}`,
      airport: flight.airport,
      to_airport: flight.to_airport,
      date: normalizeDateToYYYYMMDD(flight.date),
      flight_no: flight.flight_no || '',
      airline_iata: flight.airline_iata || '',
      school: userData?.school || undefined,
      original_unmatched: flight.original_unmatched ?? false,
      no_show: noShowLookup.get(`${match.ride_id}:${String(flight.user_id)}`),
    })
  })

  // group_voucher was seeded from whichever match was processed first; if that
  // rider had no voucher yet, the group looked voucher-less even when others
  // had the shared group voucher. Resolve from any member match (stable order).
  const groupVoucherByRideId = new Map<number, string>()
  const matchesSortedForVoucher = [...matchesData].sort((a, b) => {
    if (a.ride_id !== b.ride_id) return a.ride_id - b.ride_id
    return (a.flight_id ?? 0) - (b.flight_id ?? 0)
  })
  for (const match of matchesSortedForVoucher) {
    const trimmed = (match.voucher ?? '').trim()
    if (!trimmed) continue
    if (!groupVoucherByRideId.has(match.ride_id)) {
      groupVoucherByRideId.set(match.ride_id, trimmed)
    }
  }
  for (const group of Array.from(groupsMap.values())) {
    const resolved = groupVoucherByRideId.get(group.ride_id)
    if (resolved) {
      group.group_voucher = resolved
    }
  }

  const pageFlightIdSet = new Set(pageFlightIds)
  const groupAnchors = new Map<number, { date: string; flightId: number }>()

  for (const match of matchesData) {
    const flight = flightsMap.get(match.flight_id)
    const flightDate = flight ? normalizeDateToYYYYMMDD(flight.date) : ''
    if (flightDate < dateRangeStart || flightDate > dateRangeEnd) continue

    const currentAnchor = groupAnchors.get(match.ride_id)
    if (
      !currentAnchor ||
      flightDate < currentAnchor.date ||
      (flightDate === currentAnchor.date &&
        match.flight_id < currentAnchor.flightId)
    ) {
      groupAnchors.set(match.ride_id, {
        date: flightDate,
        flightId: match.flight_id,
      })
    }
  }

  let groups = Array.from(groupsMap.values())
    .filter((group) => {
      const anchor = groupAnchors.get(group.ride_id)
      return Boolean(anchor && pageFlightIdSet.has(anchor.flightId))
    })
    .map((group) => ({
      ...group,
      time_range: calculateGroupTimeRange(group.riders),
    }))

  if (adminScope) {
    groups = groups.map((group) => ({
      ...group,
      riders: group.riders.map((rider) =>
        rider.school !== adminScope
          ? {
              ...rider,
              name: '[Hidden]',
              phone: '[Hidden]',
            }
          : rider,
      ),
    }))
  }

  groups = groups.map((group) => toAdminGroupRowDto(group) as Group)

  let unmatchedRiders = flightsWithUsers
    .filter(
      (flight) =>
        pageFlightIds.includes(flight.flight_id) &&
        !matchedFlightIds.has(flight.flight_id) &&
        flight.matching_status !== 'matched',
    )
    .map((flight) => {
      const userData = Array.isArray(flight.Users)
        ? flight.Users[0]
        : flight.Users

      return {
        user_id: flight.user_id,
        flight_id: flight.flight_id,
        name:
          `${userData?.firstname || ''} ${userData?.lastname || ''}`.trim() ||
          'Unknown',
        phone: userData?.phonenumber || 'N/A',
        sms_opt_in: userData?.sms_opt_in ?? null,
        checked_bags: flight.bag_no_large || 0,
        carry_on_bags: flight.bag_no || 0,
        time_range: `${flight.earliest_time} - ${flight.latest_time}`,
        airport: flight.airport,
        to_airport: flight.to_airport,
        date: normalizeDateToYYYYMMDD(flight.date),
        reason: 'unmatched',
        flight_no: flight.flight_no || '',
        airline_iata: flight.airline_iata || '',
        school: userData?.school || undefined,
        original_unmatched: flight.original_unmatched ?? false,
      } satisfies Rider
    })

  if (adminScope) {
    unmatchedRiders = unmatchedRiders.filter(
      (rider) => rider.school === adminScope,
    )
  }

  return {
    adminScope,
    availableAirports,
    groups,
    unmatchedRiders,
    pagination,
  }
}

export const fetchChangeLogEntries = async (
  supabase: GroupsSupabaseClient,
  { page = 1, pageSize = 100 }: { page?: number; pageSize?: number } = {},
): Promise<{ entries: ChangeLogEntry[]; hasMore: boolean }> => {
  const from = (page - 1) * pageSize
  const { data, error } = await supabase
    .from('ChangeLog')
    .select(
      `
      id,
      actor_user_id,
      actor_role,
      action,
      algorithm_run_id,
      change_batch_id,
      target_group_id,
      target_user_id,
      ignored_error,
      confirmed,
      metadata,
      created_at
    `,
    )
    .order('created_at', { ascending: false })
    .range(from, from + pageSize)

  if (error) {
    throw createError(error, 'Failed to fetch changelog')
  }

  if (!data || data.length === 0) {
    return { entries: [], hasMore: false }
  }

  const rawEntries = data as any[]
  const actorUserIds = Array.from(
    new Set(
      rawEntries.map((entry: any) => entry.actor_user_id).filter(Boolean),
    ),
  ) as string[]

  const users =
    actorUserIds.length > 0
      ? await fetchUsersInBatches(
          supabase,
          actorUserIds,
          'user_id, firstname, lastname',
        )
      : []

  const actorNames = new Map(
    users.map((user: any) => [
      user.user_id,
      `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown',
    ]),
  )

  const entries: ChangeLogEntry[] = rawEntries.map(
    (entry: any): ChangeLogEntry => ({
      id: entry.id,
      actor_user_id: entry.actor_user_id,
      actor_role: entry.actor_role,
      action: entry.action,
      algorithm_run_id: entry.algorithm_run_id,
      change_batch_id: entry.change_batch_id,
      target_group_id: entry.target_group_id,
      target_user_id: entry.target_user_id,
      ignored_error: entry.ignored_error,
      confirmed: entry.confirmed ?? false,
      metadata: entry.metadata,
      created_at: entry.created_at,
      actor_name: actorNames.get(entry.actor_user_id) || 'Unknown',
    }),
  )

  const deduped = Array.from(
    new Map(entries.map((entry) => [entry.id, entry] as const)).values(),
  )

  return {
    entries: deduped.slice(0, pageSize),
    hasMore: rawEntries.length > pageSize,
  }
}

export const fetchPendingChangesSnapshot = async ({
  supabase,
  groups,
}: {
  supabase: GroupsSupabaseClient
  groups: Group[]
}): Promise<PendingChangesSnapshot> => {
  const { data, error } = await supabase
    .from('ChangeLog')
    .select(
      'id, metadata, created_at, action, change_batch_id, confirmed, target_group_id',
    )
    .eq('confirmed', false)
    .in('action', CHANGE_ACTIONS)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError(error, 'Failed to fetch pending changes')
  }

  if (!data || data.length === 0) {
    return {
      changedGroups: [],
      unmatchedIndividuals: [],
    }
  }

  const processedChanges = await deleteReversedPendingChanges(
    supabase,
    groups,
    data as PendingChangeRow[],
  )

  const unmatchedChangesMap = new Map<
    number,
    {
      user_id: string
      name: string
      date: string
      becameUnmatchedAt: string
      changeLogId: string
      changeLogIds: string[]
    }
  >()

  processedChanges.forEach((change) => {
    const metadata = change.metadata || {}
    if (change.action !== 'REMOVE_FROM_GROUP' || metadata.to !== 'unmatched') {
      return
    }

    const flightId = metadata.rider_flight_id || metadata.flight_id
    if (!flightId) return

    const existing = unmatchedChangesMap.get(flightId)
    if (
      !existing ||
      new Date(change.created_at) > new Date(existing.becameUnmatchedAt)
    ) {
      unmatchedChangesMap.set(flightId, {
        user_id: metadata.rider_user_id || metadata.user_id || '',
        name: metadata.rider_name || 'Unknown',
        date: metadata.date || '',
        becameUnmatchedAt: change.created_at,
        changeLogId: change.id,
        changeLogIds: existing
          ? Array.from(new Set([...existing.changeLogIds, change.id]))
          : [change.id],
      })
      return
    }

    existing.changeLogIds = Array.from(
      new Set([...existing.changeLogIds, change.id]),
    )
  })

  const finalGroupChanges = new Map<
    number,
    {
      changeType: 'modified' | 'deleted'
      changedAt: string
      changeLogId: string
      changeLogIds: string[]
    }
  >()

  processedChanges.forEach((change) => {
    const rideId = resolveRideIdFromChange(change)
    if (!rideId || isNaN(rideId)) return

    const existing = finalGroupChanges.get(rideId)
    if (
      !existing ||
      new Date(change.created_at) > new Date(existing.changedAt)
    ) {
      finalGroupChanges.set(rideId, {
        changeType: change.action === 'DELETE_GROUP' ? 'deleted' : 'modified',
        changedAt: change.created_at,
        changeLogId: change.id,
        changeLogIds: existing
          ? Array.from(new Set([...existing.changeLogIds, change.id]))
          : [change.id],
      })
      return
    }

    existing.changeLogIds = Array.from(
      new Set([...existing.changeLogIds, change.id]),
    )
  })

  const changeTypesByGroup = resolveGroupChangeTypes(processedChanges)
  const changedGroups: ChangedGroup[] = []

  finalGroupChanges.forEach((changeInfo, rideId) => {
    const group = groups.find((candidate) => candidate.ride_id === rideId)
    if (!group || changeInfo.changeType === 'deleted') {
      return
    }

    const rawDescriptions = Array.from(
      changeTypesByGroup.get(rideId) || new Set<string>(),
    ).map(getChangeDescription)

    changedGroups.push({
      group,
      changeType: changeInfo.changeType,
      changedAt: changeInfo.changedAt,
      emailsSent: false,
      changeLogId: changeInfo.changeLogId,
      changeLogIds: changeInfo.changeLogIds,
      changeDescriptions: consolidateChangeDescriptions(rawDescriptions),
    })
  })

  const dedupedChangedGroups = Array.from(
    new Map(changedGroups.map((item) => [item.group.ride_id, item])).values(),
  )

  if (unmatchedChangesMap.size === 0) {
    return {
      changedGroups: dedupedChangedGroups,
      unmatchedIndividuals: [],
    }
  }

  const flightIds = Array.from(unmatchedChangesMap.keys())

  const { data: matchesData, error: matchesError } = await supabase
    .from('Matches')
    .select('flight_id')
    .in('flight_id', flightIds)

  if (matchesError) {
    throw createError(
      matchesError,
      'Failed to fetch match status for unmatched riders',
    )
  }

  const matchedFlightIds = new Set(
    (matchesData || []).map((match: any) => match.flight_id),
  )

  const { data: flightsData, error: flightsError } = await supabase
    .from('Flights')
    .select('flight_id, user_id, date')
    .in('flight_id', flightIds)

  if (flightsError) {
    throw createError(flightsError, 'Failed to fetch unmatched flight data')
  }

  const flightsMap = new Map(
    (flightsData || []).map((flight: any) => [flight.flight_id, flight]),
  )

  const unmatchedUserIds = Array.from(
    new Set(
      Array.from(unmatchedChangesMap.values())
        .map((change) => change.user_id)
        .filter(Boolean),
    ),
  )

  const unmatchedUsers =
    unmatchedUserIds.length > 0
      ? await fetchUsersInBatches(
          supabase,
          unmatchedUserIds,
          'user_id, firstname, lastname',
        )
      : []

  const unmatchedUserNames = new Map(
    unmatchedUsers.map((user: any) => [
      user.user_id,
      `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Unknown',
    ]),
  )

  const unmatchedIndividuals: UnmatchedIndividual[] = []

  unmatchedChangesMap.forEach((change, flightId) => {
    if (matchedFlightIds.has(flightId)) return

    const flight = flightsMap.get(flightId) as any
    if (!flight) return

    unmatchedIndividuals.push({
      rider: {
        user_id: change.user_id,
        flight_id: flightId,
        name: unmatchedUserNames.get(change.user_id) || change.name,
        phone: 'N/A',
        checked_bags: 0,
        carry_on_bags: 0,
        time_range: '',
        airport: '',
        to_airport: false,
        date: normalizeDateToYYYYMMDD(flight.date || change.date),
      },
      becameUnmatchedAt: change.becameUnmatchedAt,
      emailSent: false,
      changeLogId: change.changeLogId,
      changeLogIds: change.changeLogIds,
    })
  })

  return {
    changedGroups: dedupedChangedGroups,
    unmatchedIndividuals: Array.from(
      new Map(
        unmatchedIndividuals.map((item) => [item.rider.flight_id, item]),
      ).values(),
    ),
  }
}
