import { postJson, requestJson } from '@/utils/api'

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
  flightId,
}: {
  supabase: GroupsSupabaseClient
  flightId: number
}): Promise<Rider | null> => {
  const result = await requestJson<{ rider: Rider }>(
    `/api/admin/lookup?kind=rider&flightId=${flightId}`,
  )
  return result.rider
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
  flightId,
}: {
  supabase: GroupsSupabaseClient
  groupId: number
  userId: string
  flightId: number
}) => {
  await runAdminGroupCommand('remove_group_match', {
    groupId,
    userId,
    flightId,
  })
}

export const removeRiderToUnmatched = async ({
  groupId,
  userId,
  flightId,
  remainingGroupUpdates,
  changeMetadata,
}: {
  supabase: GroupsSupabaseClient
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
  await runAdminGroupCommand('remove_rider_to_unmatched', {
    groupId,
    userId,
    flightId,
    remainingGroupUpdates,
    changeMetadata,
  })
}

export const moveRiderToCorral = async ({
  groupId,
  userId,
  flightId,
  remainingGroupUpdates,
  changeMetadata,
}: {
  supabase: GroupsSupabaseClient
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
  await runAdminGroupCommand('move_rider_to_corral', {
    groupId,
    userId,
    flightId,
    remainingGroupUpdates,
    changeMetadata,
  })
}

export const moveRiderToGroup = async (payload: {
  destinationGroupId: number
  sourceGroupId?: number
  userId: string
  flightId: number
  date: string
  time: string
  voucher: string
  isSubsidized: boolean
  uberType: string
  destinationGroupUpdates: Record<string, unknown>
  sourceGroupUpdates?: Record<string, unknown>
  changeLogIds: string[]
  sourceMetadata?: Record<string, unknown>
  destinationMetadata: Record<string, unknown>
  changeBatchId: string
}) => runAdminGroupCommand('move_rider_to_group', payload)

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

export const setMatchingStatus = async ({
  flightIds,
  matchingStatus,
}: {
  supabase: GroupsSupabaseClient
  flightIds: number[] | number
  matchingStatus: 'matched' | 'unmatched'
}) => {
  await runAdminGroupCommand('mark_flights_matched_state', {
    flightIds,
    matchingStatus,
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
