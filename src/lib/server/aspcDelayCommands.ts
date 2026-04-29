import 'server-only'

import { calculateBagUnits, canAccommodateRider } from '@/utils/bagCapacity'

type SupabaseClient = any

function createError(message: string, status = 400, details?: unknown) {
  const error = new Error(message) as Error & {
    status?: number
    details?: unknown
  }
  error.status = status
  error.details = details
  return error
}

async function runDelayRpc<T extends Record<string, any>>({
  supabase,
  name,
  params,
  fallbackMessage,
}: {
  supabase: SupabaseClient
  name: string
  params: Record<string, unknown>
  fallbackMessage: string
}) {
  const { data, error } = await supabase.rpc(name, params)

  if (error) {
    throw createError(error.message || fallbackMessage, 400, error)
  }

  if (!data || data.success !== true) {
    const status = Number(data?.status)
    throw createError(
      data?.error || fallbackMessage,
      Number.isFinite(status) ? status : 400,
      data,
    )
  }

  return data as T
}

function parseLocalDateTimeMs(
  dateStr: string | null | undefined,
  timeStr: string | null | undefined,
): number | null {
  const d = (dateStr ?? '').trim()
  if (!d) return null
  const raw = (timeStr ?? '').trim()
  const t = raw.length >= 5 ? raw.slice(0, 5) : raw
  if (!/^\d{1,2}:\d{2}$/.test(t)) return null
  const [y, mo, day] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  if ([y, mo, day, h, mi].some((n) => Number.isNaN(n))) return null
  return new Date(y, mo - 1, day, h, mi, 0, 0).getTime()
}

function isNewDelayEtaBeforeOriginalGroup(args: {
  originalMatchDate: string | null | undefined
  originalMatchTime: string | null | undefined
  fallbackFlightDate: string | null | undefined
  newEtaDate: string
  newEtaTime: string
  newEtaTimeEarliest?: string
  newEtaTimeLatest?: string
}): boolean {
  const originalDate =
    args.originalMatchDate?.trim() || args.fallbackFlightDate?.trim() || ''
  const originalMs = parseLocalDateTimeMs(originalDate, args.originalMatchTime)
  const useRange = Boolean(
    args.newEtaTimeEarliest?.trim() && args.newEtaTimeLatest?.trim(),
  )
  const newLatestTime = useRange ? args.newEtaTimeLatest! : args.newEtaTime
  const newMs = parseLocalDateTimeMs(args.newEtaDate, newLatestTime)
  if (originalMs == null || newMs == null) return false
  return newMs < originalMs
}

async function logAspcDelayToChangeLog(
  supabase: SupabaseClient,
  args: {
    userId: string
    rideId: number
    flightId: number
    reasonForDelay: string
    oldFlightDate: string
    oldMatchDate: string | null
    oldMatchTime: string | null
    newEtaDate: string
    newEtaTime: string
    newEtaTimeEarliest?: string
    newEtaTimeLatest?: string
    newFlight?: {
      airport: string
      flight_no: string
      date: string
      time: string
    } | null
    outcome:
      | 'groups_available'
      | 'solo_ride_created'
      | 'kept_original_group_eta_earlier'
      | 'delay_no_group_unmatched'
    newRideId?: number
    contingencyVoucherAssigned?: boolean
    assignedContingencyVoucher?: string
  },
) {
  try {
    const { data: profile } = await supabase
      .from('Users')
      .select('firstname, lastname')
      .eq('user_id', args.userId)
      .maybeSingle()

    const actorRole = 'Rider'
    const riderName =
      `${profile?.firstname ?? ''} ${profile?.lastname ?? ''}`.trim()

    const metadata: Record<string, unknown> = {
      source: 'aspc_delay',
      reason_for_delay: args.reasonForDelay,
      old_flight_date: args.oldFlightDate,
      old_match_date: args.oldMatchDate,
      old_match_time: args.oldMatchTime ? args.oldMatchTime.slice(0, 8) : null,
      new_eta_date: args.newEtaDate,
      new_eta_time: (args.newEtaTime ?? '').slice(0, 8),
      outcome: args.outcome,
      rider_flight_id: args.flightId,
    }

    if (args.newEtaTimeEarliest && args.newEtaTimeLatest) {
      metadata.new_eta_time_earliest = args.newEtaTimeEarliest.slice(0, 8)
      metadata.new_eta_time_latest = args.newEtaTimeLatest.slice(0, 8)
    }
    if (args.newFlight) {
      metadata.new_flight_airport = args.newFlight.airport
      metadata.new_flight_no = args.newFlight.flight_no
      metadata.new_flight_date = args.newFlight.date
      metadata.new_flight_time = args.newFlight.time
    }
    if (args.newRideId != null) {
      metadata.new_ride_id = args.newRideId
    }
    if (args.outcome === 'solo_ride_created') {
      metadata.contingency_voucher_assigned =
        args.contingencyVoucherAssigned === true
      if (args.contingencyVoucherAssigned && args.assignedContingencyVoucher) {
        metadata.assigned_contingency_voucher = args.assignedContingencyVoucher
      }
    }
    if (riderName) {
      metadata.rider_name = riderName
    }

    await supabase.from('ChangeLog').insert({
      actor_user_id: args.userId,
      actor_role: actorRole,
      action: 'ASPC_DELAY',
      target_group_id: args.rideId,
      target_user_id: args.userId,
      metadata,
      ignored_error: false,
      confirmed: true,
    })
  } catch (error) {
    console.error('[ASPC delay] ChangeLog insert error:', error)
  }
}

export async function reportDelay({
  supabase,
  rideId,
  userId,
  reasonForDelay,
  newEtaDate,
  newEtaTime,
  newEtaTimeEarliest,
  newEtaTimeLatest,
  newFlight,
}: {
  supabase: SupabaseClient
  rideId: string
  userId: string
  reasonForDelay: string
  newEtaDate: string
  newEtaTime: string
  newEtaTimeEarliest?: string
  newEtaTimeLatest?: string
  newFlight?: {
    airport: string
    flight_no: string
    date: string
    time: string
  } | null
}) {
  const rid = parseInt(rideId, 10)
  if (Number.isNaN(rid)) {
    throw createError('Invalid ride.', 400)
  }

  const { data: currentMatch, error: fetchMatchError } = await supabase
    .from('Matches')
    .select(
      `
      ride_id,
      user_id,
      flight_id,
      date,
      time,
      is_subsidized,
      voucher,
      uber_type,
      contingency_voucher,
      Flights (
        airport,
        to_airport,
        date,
        bag_no,
        bag_no_large
      ),
      Users ( school )
      `,
    )
    .eq('ride_id', rid)
    .eq('user_id', userId)
    .maybeSingle()

  if (fetchMatchError) {
    throw createError(fetchMatchError.message, 400, fetchMatchError)
  }
  if (!currentMatch) {
    throw createError('Match not found.', 404)
  }

  const flight = Array.isArray(currentMatch.Flights)
    ? currentMatch.Flights[0]
    : currentMatch.Flights
  if (!flight) {
    throw createError('Flight not found.', 404)
  }

  const airport = flight.airport
  const toAirport = flight.to_airport
  const bagNo = flight.bag_no ?? 0
  const bagNoLarge = flight.bag_no_large ?? 0
  const wasSubsidized =
    Boolean(currentMatch.voucher?.trim()) ||
    currentMatch.uber_type?.toLowerCase() === 'connect'
  const contingencyVoucher = currentMatch.contingency_voucher ?? null
  const oldMatchDate = currentMatch.date ?? null
  const oldMatchTime = currentMatch.time ?? null
  const flightId = currentMatch.flight_id
  const userSchool = Array.isArray(currentMatch.Users)
    ? currentMatch.Users[0]
    : currentMatch.Users
  const isPomonaUser = (userSchool?.school ?? '') === 'Pomona'

  const newEtaBeforeOriginalGroup = isNewDelayEtaBeforeOriginalGroup({
    originalMatchDate: oldMatchDate,
    originalMatchTime: oldMatchTime,
    fallbackFlightDate: flight.date,
    newEtaDate,
    newEtaTime,
    newEtaTimeEarliest,
    newEtaTimeLatest,
  })

  if (newEtaBeforeOriginalGroup) {
    await runDelayRpc({
      supabase,
      name: 'aspc_delay_keep_original_group',
      params: {
        p_ride_id: rid,
        p_user_id: userId,
        p_flight_id: flightId,
        p_reason_for_delay: reasonForDelay,
        p_old_flight_date: flight.date,
        p_old_match_date: oldMatchDate,
        p_old_match_time: oldMatchTime,
        p_new_eta_date: newEtaDate,
        p_new_eta_time: newEtaTime,
        p_new_eta_time_earliest: newEtaTimeEarliest ?? null,
        p_new_eta_time_latest: newEtaTimeLatest ?? null,
        p_new_flight: newFlight ?? null,
      },
      fallbackMessage: 'Failed to keep the rider on the original group.',
    })

    return {
      success: true,
      wasSubsidized,
      keptOriginalGroupBecauseEarlierEta: true,
    }
  }

  const useRange = newEtaTimeEarliest && newEtaTimeLatest
  const timeStart = useRange ? newEtaTimeEarliest : newEtaTime
  const timeEnd = useRange ? newEtaTimeLatest : newEtaTime

  const parseMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number)
    return (hours ?? 0) * 60 + (minutes ?? 0)
  }

  const toTimeString = (minutes: number) => {
    const hours = Math.floor(minutes / 60) % 24
    const mins = minutes % 60
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`
  }

  const startMins = parseMinutes(timeStart) - 5
  const endMins = parseMinutes(timeEnd) + 6 * 60
  const windowStart = toTimeString(Math.max(0, startMins))
  const windowEnd = toTimeString(endMins)

  const { data: flightsData, error: flightsError } = await supabase
    .from('Flights')
    .select('flight_id, airport, to_airport, date, bag_no, bag_no_large')
    .eq('date', newEtaDate)
    .eq('airport', airport)
    .eq('to_airport', toAirport)

  if (flightsError) {
    throw createError(flightsError.message, 400, flightsError)
  }

  const flightIds = (flightsData ?? []).map(
    (candidate: any) => candidate.flight_id,
  )

  let matchesData: any[] = []
  if (flightIds.length > 0) {
    const { data, error: matchesError } = await supabase
      .from('Matches')
      .select(
        'ride_id, date, time, uber_type, voucher, is_subsidized, flight_id, Flights(flight_id, bag_no, bag_no_large)',
      )
      .in('flight_id', flightIds)
      .neq('ride_id', rid)

    if (matchesError) {
      throw createError(matchesError.message, 400, matchesError)
    }

    matchesData = data ?? []
  }

  const byRide = new Map<
    number,
    {
      date: string
      time: string
      uber_type: string | null
      voucher: string | null
      is_subsidized: boolean | null
      flightIds: number[]
      bagUnits: number
    }
  >()

  for (const match of matchesData) {
    const matchFlight = Array.isArray(match.Flights)
      ? match.Flights[0]
      : match.Flights
    if (!matchFlight) continue

    const rideIdKey = match.ride_id
    const matchDate = match.date ?? newEtaDate
    const matchTime = (match.time ?? '00:00').slice(0, 5)
    const bagUnits = calculateBagUnits(
      matchFlight.bag_no_large ?? 0,
      matchFlight.bag_no ?? 0,
    )

    if (!byRide.has(rideIdKey)) {
      byRide.set(rideIdKey, {
        date: matchDate,
        time: matchTime,
        uber_type: match.uber_type,
        voucher: match.voucher,
        is_subsidized: match.is_subsidized,
        flightIds: [match.flight_id],
        bagUnits,
      })
    } else {
      const existing = byRide.get(rideIdKey)!
      existing.flightIds.push(match.flight_id)
      existing.bagUnits += bagUnits
    }
  }

  const candidateRideIds = Array.from(byRide.keys())
  const rideIdToMatchCount = new Map<number, number>()

  if (candidateRideIds.length > 0) {
    const { data: countData } = await supabase
      .from('Matches')
      .select('ride_id')
      .in('ride_id', candidateRideIds)

    for (const row of (countData ?? []) as { ride_id: number }[]) {
      rideIdToMatchCount.set(
        row.ride_id,
        (rideIdToMatchCount.get(row.ride_id) ?? 0) + 1,
      )
    }
  }

  const userBagUnits = calculateBagUnits(bagNoLarge, bagNo)
  const availableGroups: Array<{
    rideId: number
    date: string
    time: string
    rideType: string
    rideTime: string
    riderCount: number
  }> = []

  for (const [candidateRideId, group] of Array.from(byRide.entries())) {
    const riderCount =
      rideIdToMatchCount.get(candidateRideId) ?? group.flightIds.length
    if (riderCount >= 6) continue

    const groupTime = group.time.slice(0, 5)
    if (groupTime < windowStart || groupTime > windowEnd) continue

    const groupHasVoucherOrConnect =
      Boolean(group.voucher?.trim()) ||
      group.uber_type?.toLowerCase() === 'connect'
    if (!isPomonaUser && groupHasVoucherOrConnect) continue

    const canFit = canAccommodateRider(
      riderCount,
      group.bagUnits,
      bagNoLarge,
      bagNo,
    )
    if (!canFit) continue

    availableGroups.push({
      rideId: candidateRideId,
      date: group.date,
      time: groupTime,
      rideType: group.uber_type ?? 'X',
      rideTime: groupTime,
      riderCount,
    })
  }

  availableGroups.sort((left, right) =>
    left.rideTime.localeCompare(right.rideTime),
  )

  if (availableGroups.length > 0) {
    await logAspcDelayToChangeLog(supabase, {
      userId,
      rideId: rid,
      flightId,
      reasonForDelay,
      oldFlightDate: flight.date,
      oldMatchDate,
      oldMatchTime,
      newEtaDate,
      newEtaTime,
      newEtaTimeEarliest,
      newEtaTimeLatest,
      newFlight,
      outcome: 'groups_available',
    })

    return {
      success: true,
      availableGroups,
      wasSubsidized,
    }
  }

  const soloTime = newEtaTimeEarliest || newEtaTime
  const soloTimeFormatted = soloTime.length === 5 ? `${soloTime}:00` : soloTime
  const codeOnFile =
    Boolean(contingencyVoucher) && String(contingencyVoucher).trim() !== ''
  const rawContingencyCode =
    wasSubsidized && codeOnFile ? String(contingencyVoucher).trim() : ''
  const soloMatchVoucher = rawContingencyCode
  const voucherAssigned = soloMatchVoucher.length > 0

  const contingencyVoucherNotAppliedReasons: string[] = []
  if (!voucherAssigned) {
    if (!wasSubsidized) {
      contingencyVoucherNotAppliedReasons.push(
        'Your match was not subsidized before this delay, so a contingency voucher could not be applied.',
      )
    }
    if (!codeOnFile) {
      contingencyVoucherNotAppliedReasons.push(
        'No contingency voucher was on file for your ride before this change.',
      )
    }
    if (contingencyVoucherNotAppliedReasons.length === 0) {
      contingencyVoucherNotAppliedReasons.push(
        'A contingency voucher could not be applied. If this seems wrong, contact ASPC.',
      )
    }
  }

  if (!voucherAssigned) {
    await runDelayRpc({
      supabase,
      name: 'aspc_delay_move_to_unmatched',
      params: {
        p_ride_id: rid,
        p_user_id: userId,
        p_flight_id: flightId,
        p_reason_for_delay: reasonForDelay,
        p_old_flight_date: flight.date,
        p_old_match_date: oldMatchDate,
        p_old_match_time: oldMatchTime,
        p_new_eta_date: newEtaDate,
        p_new_eta_time: newEtaTime,
        p_new_eta_time_earliest: newEtaTimeEarliest ?? null,
        p_new_eta_time_latest: newEtaTimeLatest ?? null,
        p_new_flight: newFlight ?? null,
      },
      fallbackMessage: 'Failed to move the rider back to unmatched.',
    })

    return {
      success: true,
      availableGroups: [],
      wasSubsidized,
      contingencyVoucher: null,
      contingencyVoucherApplied: false,
      contingencyVoucherNotAppliedReasons,
      hadContingencyVoucherOnFile: codeOnFile,
      movedToUnmatched: true,
    }
  }

  const soloResult = await runDelayRpc<{ success: true; rideId?: number }>({
    supabase,
    name: 'aspc_delay_create_solo_ride',
    params: {
      p_ride_id: rid,
      p_user_id: userId,
      p_flight_id: flightId,
      p_reason_for_delay: reasonForDelay,
      p_old_flight_date: flight.date,
      p_old_match_date: oldMatchDate,
      p_old_match_time: oldMatchTime,
      p_new_eta_date: newEtaDate,
      p_new_eta_time: soloTimeFormatted,
      p_new_eta_time_earliest: newEtaTimeEarliest ?? null,
      p_new_eta_time_latest: newEtaTimeLatest ?? null,
      p_new_flight: newFlight ?? null,
      p_contingency_voucher: soloMatchVoucher,
      p_is_subsidized: wasSubsidized,
    },
    fallbackMessage: 'Failed to create a solo delay ride.',
  })

  return {
    success: true,
    availableGroups: [],
    wasSubsidized,
    contingencyVoucher,
    contingencyVoucherApplied: true,
    contingencyVoucherNotAppliedReasons: [],
    hadContingencyVoucherOnFile: codeOnFile,
    newRideId:
      typeof soloResult.rideId === 'number' ? soloResult.rideId : undefined,
  }
}

export async function joinDelayGroup({
  supabase,
  currentRideId,
  userId,
  selectedRideId,
}: {
  supabase: SupabaseClient
  currentRideId: number
  userId: string
  selectedRideId: number
}) {
  const [matchRes, userRes] = await Promise.all([
    supabase
      .from('Matches')
      .select('date, time, uber_type, voucher, is_subsidized')
      .eq('ride_id', selectedRideId)
      .limit(1)
      .maybeSingle(),
    supabase.from('Users').select('school').eq('user_id', userId).maybeSingle(),
  ])

  if (matchRes.error || !matchRes.data) {
    throw createError(
      matchRes.error?.message ?? 'No match found for that ride.',
      400,
      matchRes.error,
    )
  }

  const groupSubsidized =
    Boolean(matchRes.data.voucher?.trim()) ||
    matchRes.data.uber_type?.toLowerCase() === 'connect'
  const userSchool = userRes.data?.school ?? ''
  if (groupSubsidized && userSchool !== 'Pomona') {
    throw createError(
      'Only Pomona College students can join ASPC-subsidized groups.',
      403,
    )
  }

  await runDelayRpc({
    supabase,
    name: 'aspc_delay_join_group',
    params: {
      p_current_ride_id: currentRideId,
      p_user_id: userId,
      p_selected_ride_id: selectedRideId,
    },
    fallbackMessage: 'Failed to join the selected delay group.',
  })

  return { success: true }
}

export async function declineDelayGroups({
  supabase,
  currentRideId,
  userId,
}: {
  supabase: SupabaseClient
  currentRideId: number
  userId: string
}) {
  await runDelayRpc({
    supabase,
    name: 'aspc_delay_decline_groups',
    params: {
      p_current_ride_id: currentRideId,
      p_user_id: userId,
    },
    fallbackMessage: 'Failed to decline available delay groups.',
  })

  return { success: true }
}
