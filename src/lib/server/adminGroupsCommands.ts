import 'server-only'

import type {
  ChangeLogEntry,
  Rider,
} from '@/components/admin/groups-management/types'
import { normalizeFlightWritePayload } from '@/lib/server/flightWritePayload'
import { roundToNearest5Minutes } from '@/components/admin/groups-management/utils'

type GroupsSupabaseClient = any

const createError = (error: any, fallback: string) => {
  const message = error?.message || fallback
  const details = error?.details || error?.hint
  const wrapped = new Error(
    details ? `${message} (${details})` : message,
  ) as Error & {
    status?: number
    details?: unknown
  }
  wrapped.status = 400
  wrapped.details = error
  return wrapped
}

const runAdminGroupsRpc = async <T extends Record<string, any>>({
  supabase,
  name,
  params,
  fallback,
}: {
  supabase: GroupsSupabaseClient
  name: string
  params: Record<string, unknown>
  fallback: string
}) => {
  const { data, error } = await supabase.rpc(name, params)

  if (error) {
    throw createError(error, fallback)
  }

  if (!data || data.success !== true) {
    throw createError(data, fallback)
  }

  return data as T
}

const normalizeVoucherInput = (voucher: string): string => {
  const trimmed = voucher.trim()
  if (!trimmed) return ''

  const prefix = 'https://r.uber.com/'
  if (trimmed.startsWith(prefix)) {
    return trimmed
  }

  return `${prefix}${trimmed.replace(/^\/+/, '')}`
}

export const logChangeLogEntry = async ({
  supabase,
  actorUserId,
  actorRole,
  actorName,
  action,
  metadata,
  targetGroupId,
  targetUserId,
  changeBatchId,
  confirmed = false,
}: {
  supabase: GroupsSupabaseClient
  actorUserId: string
  actorRole?: string | null
  actorName?: string
  action: ChangeLogEntry['action']
  metadata?: any
  targetGroupId?: number
  targetUserId?: string
  changeBatchId?: string
  confirmed?: boolean
}) => {
  let resolvedActorRole = actorRole
  let resolvedActorName = actorName
  if (!resolvedActorRole) {
    const { data: userProfile, error: roleError } = await supabase
      .from('Users')
      .select('role, firstname, lastname')
      .eq('user_id', actorUserId)
      .single()

    if (roleError) {
      throw createError(roleError, 'Failed to fetch actor role for change log')
    }
    resolvedActorRole = userProfile?.role
    resolvedActorName =
      `${userProfile?.firstname || ''} ${userProfile?.lastname || ''}`.trim() ||
      resolvedActorName
  }

  let serializedMetadata = null
  try {
    if (metadata) {
      serializedMetadata = JSON.parse(JSON.stringify(metadata))
    }
  } catch {
    serializedMetadata = {
      error: 'Metadata serialization failed',
      original_type: typeof metadata,
    }
  }

  const payload: any = {
    actor_user_id: actorUserId,
    actor_role: resolvedActorRole || 'Admin',
    action,
    change_batch_id: changeBatchId || null,
    target_group_id: targetGroupId || null,
    target_user_id: targetUserId || null,
    metadata: serializedMetadata,
    ignored_error: false,
    confirmed,
  }

  const { data, error } = await supabase
    .from('ChangeLog')
    .insert(payload)
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
    .single()

  if (error) {
    throw createError(error, 'Failed to write change log entry')
  }

  if (!data) {
    throw createError(null, 'Failed to read written change log entry')
  }

  return {
    ...data,
    actor_name: resolvedActorName,
  } as ChangeLogEntry
}

export const removeRiderToUnmatched = async ({
  supabase,
  actorUserId,
  actorRole,
  actorName,
  groupId,
  userId,
  flightId,
  remainingGroupUpdates,
  changeMetadata,
}: {
  supabase: GroupsSupabaseClient
  actorUserId: string
  actorRole?: string | null
  actorName?: string
  groupId: number
  userId: string
  flightId: number
  remainingGroupUpdates?: {
    uber_type?: string | null
    is_subsidized?: boolean | null
    is_verified?: boolean
  }
  changeMetadata: Record<string, unknown>
}) => {
  await Promise.all([
    removeGroupMatch({ supabase, groupId, userId, flightId }),
    setMatchingStatus({
      supabase,
      flightIds: flightId,
      status: 'unmatched',
    }),
    remainingGroupUpdates
      ? updateGroupMatchesMetadata({
          supabase,
          groupId,
          updates: remainingGroupUpdates,
        })
      : Promise.resolve(),
  ])

  const changeLogEntry = await logChangeLogEntry({
    supabase,
    actorUserId,
    actorRole,
    actorName,
    action: 'REMOVE_FROM_GROUP',
    metadata: changeMetadata,
    targetGroupId: groupId,
    targetUserId: userId,
  })

  return { changeLogEntries: [changeLogEntry] }
}

export const moveRiderToCorral = async ({
  supabase,
  actorUserId,
  actorRole,
  actorName,
  groupId,
  userId,
  flightId,
  remainingGroupUpdates,
  changeMetadata,
}: {
  supabase: GroupsSupabaseClient
  actorUserId: string
  actorRole?: string | null
  actorName?: string
  groupId: number
  userId: string
  flightId: number
  remainingGroupUpdates?: {
    uber_type?: string | null
    is_subsidized?: boolean | null
    is_verified?: boolean
  }
  changeMetadata: Record<string, unknown>
}) => {
  await Promise.all([
    removeGroupMatch({ supabase, groupId, userId, flightId }),
    remainingGroupUpdates
      ? updateGroupMatchesMetadata({
          supabase,
          groupId,
          updates: remainingGroupUpdates,
        })
      : Promise.resolve(),
  ])
  const changeLogEntry = await logChangeLogEntry({
    supabase,
    actorUserId,
    actorRole,
    actorName,
    action: 'REMOVE_FROM_GROUP',
    metadata: changeMetadata,
    targetGroupId: groupId,
    targetUserId: userId,
  })

  return { changeLogEntries: [changeLogEntry] }
}

export const moveRiderToGroup = async ({
  supabase,
  actorUserId,
  actorRole,
  actorName,
  destinationGroupId,
  sourceGroupId,
  userId,
  flightId,
  date,
  time,
  voucher,
  isSubsidized,
  uberType,
  destinationGroupUpdates,
  sourceGroupUpdates,
  changeLogIds,
  sourceMetadata,
  destinationMetadata,
  changeBatchId,
}: {
  supabase: GroupsSupabaseClient
  actorUserId: string
  actorRole?: string | null
  actorName?: string
  destinationGroupId: number
  sourceGroupId?: number
  userId: string
  flightId: number
  date: string
  time: string
  voucher: string
  isSubsidized: boolean
  uberType: string
  destinationGroupUpdates: {
    uber_type?: string | null
    is_subsidized?: boolean | null
    is_verified?: boolean
  }
  sourceGroupUpdates?: {
    uber_type?: string | null
    is_subsidized?: boolean | null
    is_verified?: boolean
  }
  changeLogIds?: string[]
  sourceMetadata?: Record<string, unknown>
  destinationMetadata: Record<string, unknown>
  changeBatchId: string
}) => {
  await deleteRiderMatches({ supabase, userId, flightId })
  await upsertManualGroupMatch({
    supabase,
    rideId: destinationGroupId,
    userId,
    flightId,
    date,
    time,
    voucher,
    isSubsidized,
    uberType,
  })

  await Promise.all([
    updateGroupMatchesMetadata({
      supabase,
      groupId: destinationGroupId,
      updates: destinationGroupUpdates,
    }),
    setMatchingStatus({
      supabase,
      flightIds: flightId,
      status: 'matched',
    }),
    sourceGroupId && sourceGroupUpdates
      ? updateGroupMatchesMetadata({
          supabase,
          groupId: sourceGroupId,
          updates: sourceGroupUpdates,
        })
      : Promise.resolve(),
    changeLogIds?.length
      ? confirmChangeLogEntries({ supabase, changeLogIds })
      : Promise.resolve(),
  ])

  const changeLogEntries: ChangeLogEntry[] = []

  if (sourceGroupId && sourceMetadata) {
    const sourceChangeLogEntry = await logChangeLogEntry({
      supabase,
      actorUserId,
      actorRole,
      actorName,
      action: 'REMOVE_FROM_GROUP',
      metadata: sourceMetadata,
      targetGroupId: sourceGroupId,
      targetUserId: userId,
      changeBatchId,
    })
    changeLogEntries.push(sourceChangeLogEntry)
  }

  const destinationChangeLogEntry = await logChangeLogEntry({
    supabase,
    actorUserId,
    actorRole,
    actorName,
    action: 'ADD_TO_GROUP',
    metadata: destinationMetadata,
    targetGroupId: destinationGroupId,
    targetUserId: userId,
    changeBatchId,
  })
  changeLogEntries.push(destinationChangeLogEntry)

  return { changeLogEntries }
}

export const updateGroupTimeRecords = async ({
  supabase,
  groupId,
  newTime,
  newDate,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  newTime: string
  newDate?: string
}) => {
  const roundedTime = roundToNearest5Minutes(newTime)
  const formattedTime =
    roundedTime.includes(':') && roundedTime.split(':').length === 2
      ? `${roundedTime}:00`
      : roundedTime

  const updateData: any = {
    time: formattedTime,
    is_verified: false,
  }

  if (newDate) {
    updateData.date = newDate
  }

  const { error } = await supabase
    .from('Matches')
    .update(updateData)
    .eq('ride_id', groupId)

  if (error) {
    throw createError(error, 'Failed to update group time')
  }

  return { formattedTime }
}

export const updateGroupVoucherRecords = async ({
  supabase,
  groupId,
  newVoucher,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  newVoucher: string
}) => {
  const normalizedVoucher = normalizeVoucherInput(newVoucher)

  const { error } = await supabase
    .from('Matches')
    .update({ voucher: normalizedVoucher || '' })
    .eq('ride_id', groupId)

  if (error) {
    throw createError(error, 'Failed to update group voucher')
  }

  return { normalizedVoucher }
}

export const updateFlightRecord = async ({
  supabase,
  flightId,
  updates,
}: {
  supabase: GroupsSupabaseClient
  flightId: number
  updates: {
    flight_no?: string
    airline_iata?: string
    airport?: string
    to_airport?: boolean
    date?: string
    time_range?: string
  }
}) => {
  const flightUpdates: any = {}

  if (updates.flight_no !== undefined)
    flightUpdates.flight_no = updates.flight_no
  if (updates.airline_iata !== undefined) {
    flightUpdates.airline_iata = updates.airline_iata
  }
  if (updates.airport !== undefined) flightUpdates.airport = updates.airport
  if (updates.to_airport !== undefined) {
    flightUpdates.to_airport = updates.to_airport
  }
  if (updates.date !== undefined) flightUpdates.date = updates.date

  if (updates.time_range !== undefined) {
    const [earliest, latest] = updates.time_range
      .split(' - ')
      .map((time) => time.trim())
    if (earliest) flightUpdates.earliest_time = earliest
    if (latest) flightUpdates.latest_time = latest
  }

  if (Object.keys(flightUpdates).length === 0) {
    return
  }

  const { error } = await supabase
    .from('Flights')
    .update(flightUpdates)
    .eq('flight_id', flightId)

  if (error) {
    throw createError(error, 'Failed to update rider details')
  }
}

export const removeGroupMatch = async ({
  supabase,
  groupId,
  userId,
  flightId,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  userId: string
  flightId: number
}) => {
  const { error } = await supabase
    .from('Matches')
    .delete()
    .eq('ride_id', groupId)
    .eq('user_id', userId)
    .eq('flight_id', flightId)

  if (error) {
    throw createError(error, 'Failed to remove rider from group')
  }
}

const deleteRiderMatches = async ({
  supabase,
  userId,
  flightId,
}: {
  supabase: GroupsSupabaseClient
  userId: string
  flightId: number
}) => {
  const { data, error } = await supabase
    .from('Matches')
    .delete()
    .eq('user_id', userId)
    .eq('flight_id', flightId)
    .select('id')

  if (error) {
    throw createError(error, 'Failed to remove rider from original group')
  }

  return data || []
}

const findExistingGroupMatch = async ({
  supabase,
  rideId,
  userId,
  flightId,
}: {
  supabase: GroupsSupabaseClient
  rideId: number
  userId: string
  flightId: number
}) => {
  const { data, error } = await supabase
    .from('Matches')
    .select('ride_id, user_id, flight_id')
    .eq('user_id', userId)
    .eq('flight_id', flightId)
    .eq('ride_id', rideId)
    .maybeSingle()

  if (error) {
    throw createError(error, 'Failed to check for an existing group match')
  }

  return data
}

const upsertManualGroupMatch = async ({
  supabase,
  rideId,
  userId,
  flightId,
  date,
  time,
  voucher,
  isSubsidized,
  uberType,
}: {
  supabase: GroupsSupabaseClient
  rideId: number
  userId: string
  flightId: number
  date: string
  time: string
  voucher: string
  isSubsidized: boolean
  uberType: string
}) => {
  const existingMatch = await findExistingGroupMatch({
    supabase,
    rideId,
    userId,
    flightId,
  })

  const payload = {
    ride_id: rideId,
    user_id: userId,
    flight_id: flightId,
    date,
    time,
    source: 'manual',
    voucher,
    contingency_voucher: null,
    is_verified: false,
    is_subsidized: isSubsidized,
    uber_type: uberType,
  }

  if (existingMatch) {
    const { error } = await supabase
      .from('Matches')
      .update(payload)
      .eq('ride_id', rideId)
      .eq('user_id', userId)
      .eq('flight_id', flightId)

    if (error) {
      throw createError(error, 'Failed to add rider to group')
    }

    return
  }

  const { error } = await supabase.from('Matches').insert(payload)
  if (error) {
    throw createError(error, 'Failed to add rider to group')
  }
}

export const updateGroupMatchesMetadata = async ({
  supabase,
  groupId,
  updates,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  updates: {
    time?: string
    is_verified?: boolean
    uber_type?: string | null
    is_subsidized?: boolean | null
    subsidized_override?: boolean
    uber_type_override?: boolean
  }
}) => {
  const { error } = await supabase
    .from('Matches')
    .update(updates)
    .eq('ride_id', groupId)

  if (error) {
    throw createError(error, 'Failed to update group matches')
  }
}

export const setMatchingStatus = async ({
  supabase,
  flightIds,
  status,
}: {
  supabase: GroupsSupabaseClient
  flightIds: number[] | number
  status: 'matched' | 'unmatched'
}) => {
  const ids = Array.isArray(flightIds) ? flightIds : [flightIds]
  if (ids.length === 0) return

  const { error } = await supabase
    .from('Flights')
    .update({ matching_status: status })
    .in('flight_id', ids)

  if (error) {
    throw createError(error, 'Failed to update flight match status')
  }
}

export const deleteGroupRecords = async ({
  supabase,
  groupId,
  flightIds = [],
  markFlightsUnmatched = false,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  flightIds?: number[]
  markFlightsUnmatched?: boolean
}) => {
  await runAdminGroupsRpc({
    supabase,
    name: 'delete_group_records',
    params: {
      p_group_id: groupId,
      p_flight_ids: flightIds,
      p_mark_flights_unmatched: markFlightsUnmatched,
    },
    fallback: 'Failed to delete group records',
  })
}

export const saveGroupOverrideRecords = async ({
  supabase,
  groupId,
  isSubsidized,
  uberType,
  subsidizedOverride,
  uberTypeOverride,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  isSubsidized: boolean
  uberType: string
  subsidizedOverride: boolean
  uberTypeOverride: boolean
}) => {
  const { error } = await supabase
    .from('Matches')
    .update({
      is_subsidized: isSubsidized,
      uber_type: uberType,
      subsidized_override: subsidizedOverride,
      uber_type_override: uberTypeOverride,
      is_verified: false,
    })
    .eq('ride_id', groupId)

  if (error) {
    throw createError(error, 'Failed to update group overrides')
  }
}

export const confirmChangeLogEntries = async ({
  supabase,
  changeLogIds,
}: {
  supabase: GroupsSupabaseClient
  changeLogIds: string[]
}) => {
  if (changeLogIds.length === 0) return

  const { error } = await supabase
    .from('ChangeLog')
    .update({ confirmed: true })
    .in('id', changeLogIds)

  if (error) {
    throw createError(error, 'Failed to confirm change log entries')
  }
}

export const createGroupRecords = async ({
  supabase,
  rideDate,
  riders,
  formattedTime,
  voucher,
  contingencyVoucher,
  assignVoucher,
  uberType,
  isSubsidized,
}: {
  supabase: GroupsSupabaseClient
  rideDate: string
  riders: Rider[]
  formattedTime: string
  voucher: string
  contingencyVoucher: string
  assignVoucher: boolean
  uberType: string
  isSubsidized: boolean
}) => {
  const normalizedVoucher = assignVoucher ? normalizeVoucherInput(voucher) : ''

  const data = await runAdminGroupsRpc<{
    success: true
    rideId?: number
    normalizedVoucher?: string
  }>({
    supabase,
    name: 'create_group_records',
    params: {
      p_ride_date: rideDate,
      p_riders: riders,
      p_formatted_time: formattedTime,
      p_normalized_voucher: normalizedVoucher,
      p_contingency_voucher: contingencyVoucher,
      p_assign_voucher: assignVoucher,
      p_uber_type: uberType,
      p_is_subsidized: isSubsidized,
    },
    fallback: 'Failed to create group records',
  })

  return {
    rideId: typeof data.rideId === 'number' ? data.rideId : null,
    normalizedVoucher:
      typeof data.normalizedVoucher === 'string'
        ? data.normalizedVoucher
        : normalizedVoucher,
  }
}

export const addUnmatchedFlight = async ({
  supabase,
  payload,
}: {
  supabase: GroupsSupabaseClient
  payload: Record<string, unknown>
}) => {
  const normalizedPayload = normalizeFlightWritePayload(payload)
  const userId =
    typeof payload.user_id === 'string' && payload.user_id.trim() !== ''
      ? payload.user_id
      : null

  if (!userId) {
    throw createError(
      { message: 'User ID is required for unmatched flights.' },
      'Failed to create flight',
    )
  }

  const { data, error } = await supabase
    .from('Flights')
    .insert({
      ...normalizedPayload,
      user_id: userId,
      matching_status: 'unmatched',
    })
    .select('flight_id')
    .single()

  if (error) {
    throw createError(error, 'Failed to create flight')
  }

  return {
    flightId: data?.flight_id ?? null,
  }
}
