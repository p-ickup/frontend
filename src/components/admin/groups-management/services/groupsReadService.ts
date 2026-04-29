type GroupsSupabaseClient = any

import { buildNoShowLookup } from '@/utils/adminMatchNoShows'

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

const fetchPagedRows = async <T>(
  fetchPage: (
    from: number,
    to: number,
  ) => Promise<{ data: T[] | null; error: any }>,
  pageSize = 1000,
): Promise<T[]> => {
  let from = 0
  let hasMore = true
  const rows: T[] = []

  while (hasMore) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) {
      throw createError(error, 'Failed to fetch paginated rows')
    }

    if (!data || data.length === 0) {
      hasMore = false
      continue
    }

    rows.push(...data)
    from += pageSize
    hasMore = data.length === pageSize
  }

  return rows
}

const fetchUsersInBatches = async (
  supabase: GroupsSupabaseClient,
  userIds: string[],
  select: string,
  batchSize = 100,
) => {
  const rows: any[] = []

  for (let index = 0; index < userIds.length; index += batchSize) {
    const batch = userIds.slice(index, index + batchSize)
    if (batch.length === 0) continue

    const { data, error } = await supabase
      .from('Users')
      .select(select)
      .in('user_id', batch)

    if (error) {
      throw createError(error, 'Failed to fetch users')
    }

    if (data) {
      rows.push(...data)
    }
  }

  return rows
}

const buildUsersMap = (users: any[]) =>
  new Map(
    users.map((user) => [
      String(user.user_id),
      {
        firstname: user.firstname,
        lastname: user.lastname,
        phonenumber: user.phonenumber,
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
  supabase: GroupsSupabaseClient,
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
  const { error: deleteError } = await supabase
    .from('ChangeLog')
    .delete()
    .in('id', uniqueChangeIds)

  if (deleteError) {
    throw createError(
      deleteError,
      'Failed to delete reversed change log entries',
    )
  }

  const { data: refreshedChanges, error } = await supabase
    .from('ChangeLog')
    .select('id, metadata, created_at, action, confirmed, target_group_id')
    .eq('confirmed', false)
    .in('action', CHANGE_ACTIONS)
    .order('created_at', { ascending: false })

  if (error) {
    throw createError(error, 'Failed to reload pending changes')
  }

  return refreshedChanges || []
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

  if (!data?.finished_at) {
    return null
  }

  const runDate = new Date(data.finished_at)
  const dateRangeStart = runDate.toISOString().split('T')[0]
  const dateRangeEndDate = new Date(runDate)
  dateRangeEndDate.setDate(dateRangeEndDate.getDate() + 15)

  return {
    lastAlgorithmRunDate: dateRangeStart,
    dateRangeStart,
    dateRangeEnd: dateRangeEndDate.toISOString().split('T')[0],
  }
}

export const fetchGroupsManagementSnapshot = async ({
  supabase,
  currentUserId,
}: {
  supabase: GroupsSupabaseClient
  currentUserId?: string
}): Promise<GroupsManagementSnapshot> => {
  const flightsData = await fetchPagedRows<any>(
    async (from, to) =>
      await supabase
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
        matched,
        flight_no,
        airline_iata,
        opt_in,
        original_unmatched
      `,
        )
        .range(from, to),
  )

  const userIds = Array.from(
    new Set(flightsData.map((flight) => flight.user_id).filter(Boolean)),
  )

  const allUsersData =
    userIds.length > 0
      ? await fetchUsersInBatches(
          supabase,
          userIds,
          'user_id, firstname, lastname, phonenumber, school',
        )
      : []

  let adminScope: string | null = null
  if (currentUserId) {
    const { data, error } = await supabase
      .from('Users')
      .select('admin_scope')
      .eq('user_id', currentUserId)
      .single()

    if (error) {
      throw createError(error, 'Failed to fetch admin scope')
    }

    adminScope = data?.admin_scope || null
  }

  const usersMap = buildUsersMap(allUsersData)
  const flightsWithUsers = flightsData.map((flight) => ({
    ...flight,
    Users: flight.user_id ? usersMap.get(String(flight.user_id)) || null : null,
  }))

  const availableAirports = Array.from(
    new Set(flightsWithUsers.map((flight) => flight.airport).filter(Boolean)),
  )

  const matchesData = await fetchPagedRows<any>(
    async (from, to) =>
      await supabase
        .from('Matches')
        .select(
          'ride_id, flight_id, user_id, voucher, time, date, uber_type, is_subsidized, subsidized_override, uber_type_override, reported_missing_user_ids, ready_for_pickup_status, ready_for_pickup_at',
        )
        .range(from, to),
  )

  const noShowLookup = await buildNoShowLookup(supabase, matchesData)

  if (matchesData.length === 0) {
    let unmatchedRiders = flightsWithUsers
      .filter((flight) => flight.matched !== true)
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
    }
  }

  const matchFlightIds = Array.from(
    new Set(matchesData.map((match) => match.flight_id)),
  )

  const matchFlightsData: any[] = []
  const flightIdBatchSize = 500
  for (
    let index = 0;
    index < matchFlightIds.length;
    index += flightIdBatchSize
  ) {
    const batch = matchFlightIds.slice(index, index + flightIdBatchSize)
    const { data, error } = await supabase
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
        matched,
        flight_no,
        airline_iata,
        original_unmatched
      `,
      )
      .in('flight_id', batch)

    if (error) {
      throw createError(error, 'Failed to fetch matched flights')
    }

    if (data) {
      matchFlightsData.push(...data)
    }
  }

  const matchFlightUserIds = Array.from(
    new Set(matchFlightsData.map((flight) => flight.user_id).filter(Boolean)),
  )

  const matchUsersData =
    matchFlightUserIds.length > 0
      ? await fetchUsersInBatches(
          supabase,
          matchFlightUserIds,
          'user_id, firstname, lastname, phonenumber, school',
        )
      : []

  const matchUsersMap = buildUsersMap(matchUsersData)
  const flightsMap = new Map<number, any>()

  matchFlightsData.forEach((flight) => {
    flightsMap.set(flight.flight_id, {
      ...flight,
      Users: matchUsersMap.get(String(flight.user_id)) || null,
    })
  })

  flightsWithUsers.forEach((flight) => {
    if (!flightsMap.has(flight.flight_id)) {
      flightsMap.set(flight.flight_id, flight)
    }
  })

  const groupsMap = new Map<number, Group>()
  const matchedFlightIds = new Set<number>()

  matchesData.forEach((match) => {
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

  let groups = Array.from(groupsMap.values()).map((group) => ({
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

  const unmatchedRiders = flightsWithUsers
    .filter(
      (flight) =>
        !matchedFlightIds.has(flight.flight_id) && flight.matched !== true,
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
        checked_bags: flight.bag_no_large || 0,
        carry_on_bags: flight.bag_no || 0,
        time_range: `${flight.earliest_time} - ${flight.latest_time}`,
        airport: flight.airport,
        to_airport: flight.to_airport,
        date: normalizeDateToYYYYMMDD(flight.date),
        reason: 'unmatched',
        flight_no: flight.flight_no || '',
        airline_iata: flight.airline_iata || '',
        original_unmatched: flight.original_unmatched ?? false,
      } satisfies Rider
    })

  return {
    adminScope,
    availableAirports,
    groups,
    unmatchedRiders,
  }
}

export const fetchChangeLogEntries = async (
  supabase: GroupsSupabaseClient,
): Promise<ChangeLogEntry[]> => {
  const { data, error } = await supabase
    .from('ChangeLog')
    .select(
      `
      id,
      actor_user_id,
      actor_role,
      action,
      algorithm_run_id,
      target_group_id,
      target_user_id,
      ignored_error,
      confirmed,
      metadata,
      created_at
    `,
    )
    .order('created_at', { ascending: false })

  if (error) {
    throw createError(error, 'Failed to fetch changelog')
  }

  if (!data || data.length === 0) {
    return []
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
      target_group_id: entry.target_group_id,
      target_user_id: entry.target_user_id,
      ignored_error: entry.ignored_error,
      confirmed: entry.confirmed ?? false,
      metadata: entry.metadata,
      created_at: entry.created_at,
      actor_name: actorNames.get(entry.actor_user_id) || 'Unknown',
    }),
  )

  return Array.from(
    new Map(entries.map((entry) => [entry.id, entry] as const)).values(),
  )
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
    .select('id, metadata, created_at, action, confirmed, target_group_id')
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
      })
    }
  })

  const finalGroupChanges = new Map<
    number,
    {
      changeType: 'modified' | 'deleted'
      changedAt: string
      changeLogId: string
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
      })
    }
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
