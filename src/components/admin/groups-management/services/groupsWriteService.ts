import { postJson } from '@/utils/api'

import type { ChangeLogEntry, Rider } from '../types'

type GroupsSupabaseClient = any

const createError = (error: any, fallback: string) => {
  const message = error?.message || fallback
  const details = error?.details || error?.hint
  return new Error(details ? `${message} (${details})` : message)
}

const runAdminGroupCommand = async <T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> => {
  return postJson<T>('/api/admin/groups/command', { action, payload })
}

export const normalizeVoucherInput = (voucher: string): string => {
  const trimmed = voucher.trim()
  if (!trimmed) return ''

  const prefix = 'https://r.uber.com/'
  if (trimmed.startsWith(prefix)) {
    return trimmed
  }

  return `${prefix}${trimmed.replace(/^\/+/, '')}`
}

export const logChangeLogEntry = async ({
  actorUserId,
  action,
  metadata,
  targetGroupId,
  targetUserId,
  changeBatchId,
  confirmed = false,
}: {
  supabase: GroupsSupabaseClient
  actorUserId: string
  action: ChangeLogEntry['action']
  metadata?: any
  targetGroupId?: number
  targetUserId?: string
  changeBatchId?: string
  confirmed?: boolean
}) => {
  await runAdminGroupCommand('log_change_log_entry', {
    actorUserId,
    action,
    metadata,
    targetGroupId,
    targetUserId,
    changeBatchId,
    confirmed,
  })
}

export const updateGroupTimeRecords = async ({
  groupId,
  newTime,
  newDate,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  newTime: string
  newDate?: string
}) =>
  runAdminGroupCommand<{ formattedTime: string }>('update_group_time', {
    groupId,
    newTime,
    newDate,
  })

export const updateGroupVoucherRecords = async ({
  groupId,
  newVoucher,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  newVoucher: string
}) =>
  runAdminGroupCommand<{ normalizedVoucher: string }>('update_group_voucher', {
    groupId,
    newVoucher,
  })

export const fetchRiderByFlightId = async ({
  supabase,
  flightId,
}: {
  supabase: GroupsSupabaseClient
  flightId: number
}): Promise<Rider | null> => {
  const { data: flightData, error: flightError } = await supabase
    .from('Flights')
    .select(
      'flight_id, user_id, flight_no, airline_iata, airport, to_airport, date, earliest_time, latest_time, original_unmatched',
    )
    .eq('flight_id', flightId)
    .single()

  if (flightError || !flightData) {
    return null
  }

  const { data: userData } = await supabase
    .from('Users')
    .select('firstname, lastname')
    .eq('user_id', flightData.user_id)
    .single()

  return {
    user_id: flightData.user_id,
    flight_id: flightData.flight_id,
    name: userData ? `${userData.firstname} ${userData.lastname}` : 'Unknown',
    phone: '',
    checked_bags: 0,
    carry_on_bags: 0,
    time_range:
      flightData.earliest_time && flightData.latest_time
        ? `${flightData.earliest_time} - ${flightData.latest_time}`
        : '',
    airport: flightData.airport || '',
    to_airport: flightData.to_airport ?? true,
    date: flightData.date || '',
    flight_no: flightData.flight_no || '',
    airline_iata: flightData.airline_iata || '',
    original_unmatched: flightData.original_unmatched ?? false,
  }
}

export const updateFlightRecord = async ({
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
  await runAdminGroupCommand('update_flight_record', { flightId, updates })
}

export const removeGroupMatch = async ({
  groupId,
  userId,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  userId: string
}) => {
  await runAdminGroupCommand('remove_group_match', { groupId, userId })
}

export const deleteRiderMatches = async ({
  userId,
  flightId,
}: {
  supabase: GroupsSupabaseClient
  userId: string
  flightId: number
}) => {
  const result = await runAdminGroupCommand<{ data: any[] }>(
    'delete_rider_matches',
    {
      userId,
      flightId,
    },
  )

  return result.data || []
}

export const upsertManualGroupMatch = async ({
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
  await runAdminGroupCommand('upsert_manual_group_match', {
    rideId,
    userId,
    flightId,
    date,
    time,
    voucher,
    isSubsidized,
    uberType,
  })
}

export const updateGroupMatchesMetadata = async ({
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
  await runAdminGroupCommand('update_group_matches_metadata', {
    groupId,
    updates,
  })
}

export const markFlightsMatchedState = async ({
  flightIds,
  matched,
}: {
  supabase: GroupsSupabaseClient
  flightIds: number[] | number
  matched: boolean
}) => {
  await runAdminGroupCommand('mark_flights_matched_state', {
    flightIds,
    matched,
  })
}

export const deleteGroupRecords = async ({
  groupId,
  flightIds = [],
  markFlightsUnmatched = false,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  flightIds?: number[]
  markFlightsUnmatched?: boolean
}) => {
  await runAdminGroupCommand('delete_group_records', {
    groupId,
    flightIds,
    markFlightsUnmatched,
  })
}

export const saveGroupOverrideRecords = async ({
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
  await runAdminGroupCommand('save_group_override_records', {
    groupId,
    isSubsidized,
    uberType,
    subsidizedOverride,
    uberTypeOverride,
  })
}

export const confirmChangeLogEntries = async ({
  changeLogIds,
}: {
  supabase: GroupsSupabaseClient
  changeLogIds: string[]
}) => {
  await runAdminGroupCommand('confirm_change_log_entries', { changeLogIds })
}

export const createGroupRecords = async ({
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
}) =>
  runAdminGroupCommand<{ rideId: number; normalizedVoucher: string }>(
    'create_group_records',
    {
      rideDate,
      riders,
      formattedTime,
      voucher,
      contingencyVoucher,
      assignVoucher,
      uberType,
      isSubsidized,
    },
  )

export const addUnmatchedFlight = async ({
  flight,
}: {
  flight: Record<string, unknown>
}) => {
  return runAdminGroupCommand<{ flightId: number | null }>(
    'add_unmatched_flight',
    {
      flight,
    },
  )
}

export const sendAllMatchEmailsBatch = async (rideId: number) => {
  try {
    const result = await postJson<any>('/api/admin/send-match-emails', {
      ride_ids: [rideId],
    })

    if (!result.success) {
      throw new Error(result.message || 'Failed to send emails')
    }
    if (result.failed > 0) {
      const total = result.total ?? (result.sent || 0) + result.failed
      throw new Error(
        `Failed to send to ${result.failed} of ${total} recipients. Try again or check email addresses.`,
      )
    }
  } catch (error) {
    throw createError(error, 'Failed to send emails')
  }
}
