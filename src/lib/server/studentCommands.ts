import 'server-only'

import { normalizeFlightWritePayload } from '@/lib/server/flightWritePayload'
import { canEditFlight } from '@/utils/flightValidation'
import { isGroupReady } from '@/utils/groupReadiness'
import {
  isMatched,
  MATCHING_STATUS,
  type MatchingStatus,
} from '@/utils/matchingStatus'
import {
  toOwnUnmatchedFlightDto,
  toResultMatchDto,
  toUnmatchedFlightDto,
  type UnmatchedGroupDto,
} from '@/contracts/readModels'

type SupabaseClient = any

const createError = (message: string, status = 400, details?: unknown) => {
  const error = new Error(message) as Error & {
    status?: number
    details?: unknown
  }
  error.status = status
  error.details = details
  return error
}

const getFirst = <T>(value: T | T[] | null | undefined): T | null => {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

const hasRequiredProfileValue = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' && value.trim() !== 'Unknown'

const getMissingProfileFields = (profile: {
  firstname?: unknown
  lastname?: unknown
  school?: unknown
  email?: unknown
  phonenumber?: unknown
}) => {
  const missingFields: string[] = []

  if (!hasRequiredProfileValue(profile.firstname))
    missingFields.push('first name')
  if (!hasRequiredProfileValue(profile.lastname))
    missingFields.push('last name')
  if (!hasRequiredProfileValue(profile.school)) missingFields.push('school')
  if (!hasRequiredProfileValue(profile.email)) missingFields.push('email')
  if (!hasRequiredProfileValue(profile.phonenumber))
    missingFields.push('phone number')

  return missingFields
}

const assertCompleteProfileForFlight = async (
  supabase: SupabaseClient,
  userId: string,
) => {
  const { data: profile, error } = await supabase
    .from('Users')
    .select('firstname, lastname, school, email, phonenumber')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw createError(error.message, 400, error)
  }

  if (!profile) {
    throw createError(
      'Please complete your profile before submitting a flight.',
      403,
    )
  }

  const missingFields = getMissingProfileFields(profile)
  if (missingFields.length > 0) {
    throw createError(
      `Please complete your profile before submitting a flight: ${missingFields.join(', ')}.`,
      403,
    )
  }
}

const assertRideMembership = async ({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId: number
}) => {
  const { data: rideMatches, error } = await supabase
    .from('Matches')
    .select('user_id')
    .eq('ride_id', rideId)

  if (error) {
    throw createError(error.message, 400, error)
  }

  const isMember = (rideMatches || []).some(
    (match: { user_id: string }) => match.user_id === userId,
  )

  if (!isMember) {
    throw createError('You are not a member of this ride.', 403)
  }

  return rideMatches || []
}

export async function acceptMatchRequest({
  supabase,
  requestId,
}: {
  supabase: SupabaseClient
  requestId: string
}) {
  const { data, error } = await supabase.rpc('accept_match_request', {
    p_request_id: requestId,
  })

  if (error) {
    const message = error.message || 'Failed to accept match request.'
    const normalizedMessage = message.toLowerCase()
    const status = normalizedMessage.includes('not found')
      ? 404
      : normalizedMessage.includes('not allowed') ||
          normalizedMessage.includes('authentication')
        ? 403
        : normalizedMessage.includes('no longer pending') ||
            normalizedMessage.includes('already matched') ||
            normalizedMessage.includes('stale') ||
            normalizedMessage.includes('conflict')
          ? 409
          : 400

    throw createError(message, status, error)
  }

  if (!data || data.success !== true) {
    const status = Number(data?.status)
    throw createError(
      data?.error || 'Failed to accept match request.',
      Number.isFinite(status) ? status : 400,
      data,
    )
  }

  return {
    success: true,
    rideId:
      typeof data.rideId === 'number'
        ? data.rideId
        : typeof data.ride_id === 'number'
          ? data.ride_id
          : null,
  }
}

export async function rejectMatchRequest({
  supabase,
  userId,
  requestId,
}: {
  supabase: SupabaseClient
  userId: string
  requestId: string
}) {
  const { data: request, error: requestError } = await supabase
    .from('MatchRequests')
    .select('id, sender_id, receiver_id')
    .eq('id', requestId)
    .maybeSingle()

  if (requestError) {
    throw createError(requestError.message, 400, requestError)
  }

  if (!request) {
    throw createError('Match request not found.', 404)
  }

  if (request.receiver_id !== userId) {
    throw createError('You are not allowed to reject this request.', 403)
  }

  const { error: updateError } = await supabase
    .from('MatchRequests')
    .update({ status: 'rejected' })
    .eq('id', requestId)

  if (updateError) {
    throw createError(updateError.message, 400, updateError)
  }

  return { success: true }
}

export async function sendMatchRequest({
  supabase,
  userId,
  receiverId,
  senderFlightId,
  receiverFlightId,
}: {
  supabase: SupabaseClient
  userId: string
  receiverId: string
  senderFlightId: number
  receiverFlightId: number
}) {
  if (userId === receiverId) {
    throw createError('You cannot send a match request to yourself.', 400)
  }

  const [senderFlightRes, receiverFlightRes, existingRequestRes] =
    await Promise.all([
      supabase
        .from('Flights')
        .select('flight_id, user_id, matching_status')
        .eq('flight_id', senderFlightId)
        .maybeSingle(),
      supabase
        .from('Flights')
        .select('flight_id, user_id, matching_status')
        .eq('flight_id', receiverFlightId)
        .maybeSingle(),
      supabase
        .from('MatchRequests')
        .select('id')
        .eq('sender_id', userId)
        .eq('receiver_id', receiverId)
        .eq('sender_flight_id', senderFlightId)
        .eq('receiver_flight_id', receiverFlightId)
        .eq('status', 'pending')
        .maybeSingle(),
    ])

  if (senderFlightRes.error) {
    throw createError(senderFlightRes.error.message, 400, senderFlightRes.error)
  }
  if (receiverFlightRes.error) {
    throw createError(
      receiverFlightRes.error.message,
      400,
      receiverFlightRes.error,
    )
  }
  if (existingRequestRes.error) {
    throw createError(
      existingRequestRes.error.message,
      400,
      existingRequestRes.error,
    )
  }

  const senderFlight = senderFlightRes.data
  const receiverFlight = receiverFlightRes.data

  if (!senderFlight || senderFlight.user_id !== userId) {
    throw createError('You can only send requests from your own flight.', 403)
  }
  if (!receiverFlight || receiverFlight.user_id !== receiverId) {
    throw createError('Receiver flight not found.', 404)
  }
  if (
    isMatched(senderFlight.matching_status as MatchingStatus) ||
    isMatched(receiverFlight.matching_status as MatchingStatus)
  ) {
    throw createError('One of these flights is already matched.', 409)
  }
  if (existingRequestRes.data) {
    throw createError('A pending request already exists for this pairing.', 409)
  }

  const { error } = await supabase.from('MatchRequests').insert([
    {
      sender_id: userId,
      receiver_id: receiverId,
      sender_flight_id: senderFlightId,
      receiver_flight_id: receiverFlightId,
      status: 'pending',
    },
  ])

  if (error) {
    throw createError(error.message, 400, error)
  }

  return { success: true }
}

export async function listIncomingMatchRequests({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
  const { data, error } = await supabase
    .from('MatchRequests')
    .select(
      `id,
      sender_flight:Flights!MatchRequests_sender_flight_id_fkey(
        flight_id, airport, earliest_time, latest_time, date, user_id, to_airport,
        Users (firstname, lastname)
      )
    `,
    )
    .eq('receiver_id', userId)
    .eq('status', 'pending')

  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    requests: data || [],
  }
}

export async function cancelOwnMatch({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId: number
}) {
  const { data: matchRow } = await supabase
    .from('Matches')
    .select('date, Flights!matches_flight_id_fk(date)')
    .eq('ride_id', rideId)
    .eq('user_id', userId)
    .maybeSingle()

  const flightRecord = getFirst(
    matchRow?.Flights as { date?: string } | { date?: string }[] | null,
  )
  const flightDate = matchRow?.date ?? flightRecord?.date ?? ''
  const cancelledAfterDeadline = !canEditFlight(flightDate)

  const { data, error } = await supabase.rpc('cancel_own_match', {
    p_ride_id: rideId,
    p_cancelled_after_deadline: cancelledAfterDeadline,
  })

  if (error) {
    const message = error.message || 'Failed to cancel match.'
    const normalizedMessage = message.toLowerCase()
    const status = normalizedMessage.includes('not found')
      ? 404
      : normalizedMessage.includes('not allowed') ||
          normalizedMessage.includes('authentication')
        ? 403
        : normalizedMessage.includes('stale')
          ? 409
          : 400

    throw createError(message, status, error)
  }

  if (!data || data.success !== true) {
    const status = Number(data?.status)
    throw createError(
      data?.error || 'Failed to cancel match.',
      Number.isFinite(status) ? status : 400,
      data,
    )
  }

  return { success: true }
}

export async function createOwnFlight({
  supabase,
  userId,
  payload,
}: {
  supabase: SupabaseClient
  userId: string
  payload: Record<string, unknown>
}) {
  const normalizedPayload = normalizeFlightWritePayload(payload)

  if (normalizedPayload.date && !canEditFlight(normalizedPayload.date)) {
    throw createError(
      'The submission deadline for this service period has passed.',
      403,
    )
  }

  await assertCompleteProfileForFlight(supabase, userId)

  const { data, error } = await supabase
    .from('Flights')
    .insert([
      {
        ...normalizedPayload,
        user_id: userId,
        matching_status: MATCHING_STATUS.submitted,
      },
    ])
    .select('flight_id')
    .single()

  if (error) {
    throw createError(error.message, error.code === '23505' ? 409 : 400, error)
  }

  return {
    success: true,
    flightId: data?.flight_id ?? null,
  }
}

export async function updateOwnFlight({
  supabase,
  userId,
  flightId,
  payload,
}: {
  supabase: SupabaseClient
  userId: string
  flightId: number
  payload: Record<string, unknown>
}) {
  const { data: existingFlight, error: fetchError } = await supabase
    .from('Flights')
    .select('flight_id, user_id, date')
    .eq('flight_id', flightId)
    .maybeSingle()

  if (fetchError) {
    throw createError(fetchError.message, 400, fetchError)
  }

  if (!existingFlight || existingFlight.user_id !== userId) {
    throw createError('Flight not found.', 404)
  }

  if (!canEditFlight(existingFlight.date)) {
    throw createError('This flight can no longer be edited.', 403)
  }

  await assertCompleteProfileForFlight(supabase, userId)

  const normalizedPayload = normalizeFlightWritePayload(payload)
  if (Object.keys(normalizedPayload).length === 0) {
    throw createError('At least one editable flight field is required.', 400)
  }

  if (
    typeof normalizedPayload.date === 'string' &&
    !canEditFlight(normalizedPayload.date)
  ) {
    throw createError(
      'The submission deadline for the updated service period has passed.',
      403,
    )
  }

  const { data, error } = await supabase.rpc('update_own_flight_tx', {
    p_flight_id: flightId,
    p_fields: normalizedPayload,
  })

  if (error) {
    const message = error.message || 'Failed to update flight.'
    const normalizedMessage = message.toLowerCase()
    const status = normalizedMessage.includes('not found')
      ? 404
      : normalizedMessage.includes('not allowed') ||
          normalizedMessage.includes('authentication')
        ? 403
        : normalizedMessage.includes('match') ||
            normalizedMessage.includes('stale')
          ? 409
          : 400

    throw createError(message, status, error)
  }

  if (!data || data.success !== true) {
    const status = Number(data?.status)
    throw createError(
      data?.error || 'Failed to update flight.',
      Number.isFinite(status) ? status : 400,
      data,
    )
  }

  return { success: true }
}

export async function deleteOwnFlight({
  supabase,
  userId,
  flightId,
}: {
  supabase: SupabaseClient
  userId: string
  flightId: number
}) {
  const { data: existingFlight, error: fetchError } = await supabase
    .from('Flights')
    .select('flight_id, user_id, date')
    .eq('flight_id', flightId)
    .maybeSingle()

  if (fetchError) {
    throw createError(fetchError.message, 400, fetchError)
  }

  if (!existingFlight || existingFlight.user_id !== userId) {
    throw createError('Flight not found.', 404)
  }

  if (!canEditFlight(existingFlight.date)) {
    throw createError('This flight can no longer be deleted.', 403)
  }

  const { data, error } = await supabase.rpc('delete_own_flight_tx', {
    p_flight_id: flightId,
  })

  if (error) {
    const message = error.message || 'Failed to delete flight.'
    const normalizedMessage = message.toLowerCase()
    const status = normalizedMessage.includes('not found')
      ? 404
      : normalizedMessage.includes('not allowed') ||
          normalizedMessage.includes('authentication')
        ? 403
        : normalizedMessage.includes('match') ||
            normalizedMessage.includes('stale')
          ? 409
          : 400

    throw createError(message, status, error)
  }

  if (!data || data.success !== true) {
    const status = Number(data?.status)
    throw createError(
      data?.error || 'Failed to delete flight.',
      Number.isFinite(status) ? status : 400,
      data,
    )
  }

  return { success: true }
}

export async function reportReadyStatus({
  supabase,
  rideId,
  everyoneReady,
  missingUserIds,
}: {
  supabase: SupabaseClient
  rideId: number
  everyoneReady: boolean
  missingUserIds: string[]
}) {
  const status = everyoneReady ? 'ready' : 'reporting_missing'
  const { data, error } = await supabase.rpc('report_ready_status', {
    p_ride_id: rideId,
    p_status: status,
    p_missing_user_ids: missingUserIds,
  })

  if (error) {
    const message = error.message || 'Failed to submit ready status.'
    const normalizedMessage = message.toLowerCase()
    const statusCode =
      normalizedMessage.includes('ride not found') ||
      normalizedMessage.includes('not found')
        ? 404
        : normalizedMessage.includes('not a member') ||
            normalizedMessage.includes('authentication')
          ? 403
          : 400

    throw createError(message, statusCode, error)
  }

  if (!data || data.success !== true) {
    const statusCode = Number(data?.status)
    throw createError(
      data?.error || 'Failed to submit ready status.',
      Number.isFinite(statusCode) ? statusCode : 400,
      data,
    )
  }

  return {
    success: true,
    nowReady: Boolean(data.nowReady ?? data.now_ready),
  }
}

export async function getUnmatchedOptions({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
  const [{ data: myFlightsData }, flightRes, matchRes] = await Promise.all([
    supabase
      .from('Flights')
      .select('flight_id, airport, date, earliest_time, latest_time')
      .eq('user_id', userId)
      .eq('matching_status', MATCHING_STATUS.unmatched)
      .eq('opt_in', true),
    supabase
      .from('Flights')
      .select(
        'flight_id, user_id, airport, date, earliest_time, latest_time, to_airport, opt_in, Users:Users!Flights_user_id_fkey(firstname, lastname, email)',
      )
      .eq('opt_in', true)
      .eq('matching_status', MATCHING_STATUS.unmatched)
      .neq('user_id', userId),
    supabase
      .from('Matches')
      .select(
        'ride_id, time, flight:Flights!matches_flight_id_fk(flight_id, user_id, airport, date, earliest_time, latest_time, to_airport, opt_in, Users!Flights_user_id_fkey(firstname, lastname, email))',
      )
      .eq('is_subsidized', false),
  ])

  if (flightRes.error || matchRes.error) {
    throw createError(
      flightRes.error?.message ||
        matchRes.error?.message ||
        'Failed to load unmatched options.',
      400,
      flightRes.error || matchRes.error,
    )
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const flights = (flightRes.data || [])
    .filter((flight: any) => {
      const flightDate = new Date(flight.date)
      flightDate.setHours(0, 0, 0, 0)
      return flightDate >= today
    })
    .map(toUnmatchedFlightDto)
    .sort((left: any, right: any) => {
      const dateA = new Date(left.date).getTime()
      const dateB = new Date(right.date).getTime()
      if (dateA !== dateB) return dateA - dateB
      const timeA = left.earliest_time || '00:00'
      const timeB = right.earliest_time || '00:00'
      return timeA.localeCompare(timeB)
    })

  const reduced = (matchRes.data as any[]).reduce(
    (acc, match) => {
      const rideId = match.ride_id
      if (!acc[rideId]) {
        acc[rideId] = {
          ride_id: rideId,
          flights: [] as ReturnType<typeof toUnmatchedFlightDto>[],
          time: match.time,
        }
      }
      if (match.flight && Array.isArray(match.flight)) {
        acc[rideId].flights.push(...match.flight.map(toUnmatchedFlightDto))
      } else if (match.flight) {
        acc[rideId].flights.push(toUnmatchedFlightDto(match.flight))
      }
      return acc
    },
    {} as Record<number, UnmatchedGroupDto>,
  )

  const groups = Object.values(reduced)
    .filter((group: any) => {
      return (
        group.flights.length > 0 &&
        group.flights.length < 4 &&
        group.flights.every((flight: any) => {
          const flightDate = new Date(flight.date)
          flightDate.setHours(0, 0, 0, 0)
          const todayCheck = new Date()
          todayCheck.setHours(0, 0, 0, 0)
          return flightDate >= todayCheck
        }) &&
        group.flights.some((flight: any) => flight.opt_in === true)
      )
    })
    .sort((left: any, right: any) => {
      const dateA = new Date(left.flights[0]?.date || '').getTime()
      const dateB = new Date(right.flights[0]?.date || '').getTime()
      if (dateA !== dateB) return dateA - dateB
      const timeA = left.time || '00:00'
      const timeB = right.time || '00:00'
      return timeA.localeCompare(timeB)
    })

  return {
    success: true,
    flights,
    groups,
    myFlights: (myFlightsData || []).map(toOwnUnmatchedFlightDto),
    userEligible: (myFlightsData || []).length > 0,
  }
}

type RideEntry = {
  ride_id: number
  label: string
}

const buildRideEntries = (
  userMatches: Array<{
    ride_id: number
    date: string | null
    time: string | null
    Flights: unknown
  }>,
) => {
  const now = new Date()
  const rideEntries = (userMatches || []).map((match) => {
    const flight = getFirst(match.Flights) as {
      airport?: string
      to_airport?: boolean
      date?: string
    } | null
    const date = match.date || flight?.date || ''
    const time = match.time || '00:00'
    const formattedDate = date
      ? new Date(`${date}T00:00:00`).toLocaleDateString()
      : 'Unknown'
    const directionPrefix = flight?.to_airport ? 'School → ' : ''
    const sortKey = date && time ? new Date(`${date}T${time}`).getTime() : 0

    return {
      ride_id: match.ride_id,
      label: `${directionPrefix}${flight?.airport || 'Airport'} | ${formattedDate}`,
      sortKey,
    }
  })

  const seenRideIds = new Set<number>()
  const deduped = rideEntries.filter((entry) => {
    if (seenRideIds.has(entry.ride_id)) return false
    seenRideIds.add(entry.ride_id)
    return true
  })

  return deduped
    .sort((left, right) => {
      const leftUpcoming = left.sortKey >= now.getTime()
      const rightUpcoming = right.sortKey >= now.getTime()
      if (leftUpcoming && !rightUpcoming) return -1
      if (!leftUpcoming && rightUpcoming) return 1
      if (leftUpcoming && rightUpcoming) return left.sortKey - right.sortKey
      return right.sortKey - left.sortKey
    })
    .map(({ ride_id, label }) => ({ ride_id, label }))
}

export async function getResultsMatches({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
  const { data: userRideIds, error: rideError } = await supabase
    .from('Matches')
    .select('ride_id')
    .eq('user_id', userId)

  if (rideError) {
    throw createError(rideError.message, 400, rideError)
  }

  const rideIds = Array.from(
    new Set((userRideIds || []).map((row: { ride_id: number }) => row.ride_id)),
  )

  if (rideIds.length === 0) {
    return {
      success: true,
      matches: [],
    }
  }

  const { data, error } = await supabase
    .from('Matches')
    .select(
      `
      ride_id,
      user_id,
      date,
      time,
      voucher,
      contingency_voucher,
      uber_type,
      ready_for_pickup_at,
      reported_missing_user_ids,
      group_ready_at,
      Flights!matches_flight_id_fk (airport, date, to_airport),
      Users (
        user_id,
        firstname,
        lastname,
        phonenumber,
        photo_url,
        email
      )
    `,
    )
    .in('ride_id', rideIds)

  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    matches: (data || []).map(toResultMatchDto),
  }
}

export async function getAspcReadyData({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId?: number | null
}) {
  if (rideId) {
    const { data, error } = await supabase
      .from('Matches')
      .select(
        `
        ride_id,
        user_id,
        date,
        time,
        ready_for_pickup_at,
        ready_for_pickup_status,
        reported_missing_user_ids,
        group_ready_at,
        uber_type,
        voucher,
        contingency_voucher,
        Flights!matches_flight_id_fk (airport, to_airport, date),
        Users (user_id, firstname)
      `,
      )
      .eq('ride_id', rideId)

    if (error) {
      throw createError(error.message, 400, error)
    }

    const matches = (data || []) as Array<{ user_id: string }>
    const isMember = matches.some((match) => match.user_id === userId)
    if (!isMember) {
      throw createError('You are not a member of this ride.', 403)
    }

    return {
      success: true,
      matches: data || [],
      userRides: [] as RideEntry[],
    }
  }

  const { data: userMatches, error } = await supabase
    .from('Matches')
    .select(
      `
      ride_id,
      date,
      time,
      group_ready_at,
      Flights!matches_flight_id_fk (airport, to_airport, date)
    `,
    )
    .eq('user_id', userId)

  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    matches: [] as any[],
    userRides: buildRideEntries((userMatches || []) as any[]),
  }
}

export async function getAspcDelayData({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId?: number | null
}) {
  if (rideId) {
    const { data, error } = await supabase
      .from('Matches')
      .select(
        `
        ride_id,
        user_id,
        date,
        time,
        Flights!matches_flight_id_fk (
          airport,
          to_airport,
          date,
          flight_no,
          airline_iata,
          earliest_time,
          latest_time
        )
      `,
      )
      .eq('ride_id', rideId)
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      throw createError(error.message, 400, error)
    }
    if (!data) {
      throw createError('You are not part of this ride.', 404)
    }

    const flight = getFirst(data.Flights) as {
      airport: string
      to_airport: boolean
      date: string
      flight_no: string
      airline_iata: string
      earliest_time?: string
      latest_time?: string
    } | null

    if (!flight) {
      throw createError('No flight found for this match.', 404)
    }

    return {
      success: true,
      userRides: [] as RideEntry[],
      currentFlight: {
        airport: flight.airport,
        to_airport: flight.to_airport,
        date: flight.date,
        flight_no: flight.flight_no ?? '',
        airline_iata: flight.airline_iata ?? '',
        earliest_time: flight.earliest_time,
        latest_time: flight.latest_time,
      },
      defaultEtaDate: flight.date,
    }
  }

  const { data: userMatches, error } = await supabase
    .from('Matches')
    .select(
      `
      ride_id,
      date,
      time,
      Flights!matches_flight_id_fk (airport, to_airport, date)
    `,
    )
    .eq('user_id', userId)

  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    userRides: buildRideEntries((userMatches || []) as any[]),
    currentFlight: null,
    defaultEtaDate: '',
  }
}

export async function getRideComments({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId: number
}) {
  await assertRideMembership({ supabase, userId, rideId })

  const [{ data: currentUser, error: userError }, { data: comments, error }] =
    await Promise.all([
      supabase
        .from('Users')
        .select('user_id, firstname')
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('Comments')
        .select(
          'id, ride_id, match_id, user_id, comment, created_at, user:Users(user_id, firstname)',
        )
        .eq('ride_id', rideId)
        .order('created_at', { ascending: true }),
    ])

  if (userError) {
    throw createError(userError.message, 400, userError)
  }
  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    comments: comments || [],
    currentUser: currentUser || null,
  }
}

export async function createRideComment({
  supabase,
  userId,
  rideId,
  comment,
}: {
  supabase: SupabaseClient
  userId: string
  rideId: number
  comment: string
}) {
  await assertRideMembership({ supabase, userId, rideId })

  const trimmedComment = comment.trim()
  if (!trimmedComment) {
    throw createError('Comment cannot be empty.', 400)
  }

  const { data, error } = await supabase
    .from('Comments')
    .insert({
      ride_id: rideId,
      user_id: userId,
      comment: trimmedComment,
    })
    .select(
      'id, ride_id, match_id, user_id, comment, created_at, user:Users(user_id, firstname)',
    )
    .single()

  if (error || !data) {
    throw createError(error?.message || 'Failed to create comment.', 400, error)
  }

  return {
    success: true,
    comment: data,
  }
}

export async function getFeedbackRides({
  supabase,
  userId,
}: {
  supabase: SupabaseClient
  userId: string
}) {
  const { data, error } = await supabase
    .from('Matches')
    .select(
      'flight_id, Flights!matches_flight_id_fk(date, to_airport, airport)',
    )
    .eq('user_id', userId)

  if (error) {
    throw createError(error.message, 400, error)
  }

  const deduped = Array.from(
    new Map(
      (data || []).map((ride: any) => [
        String(ride.flight_id),
        {
          flight_id: String(ride.flight_id),
          Flights: getFirst(ride.Flights),
        },
      ]),
    ).values(),
  )

  return {
    success: true,
    rides: deduped,
  }
}

export async function submitFeedback({
  supabase,
  userId,
  flightId,
  overall,
  convenience,
  comments,
}: {
  supabase: SupabaseClient
  userId: string
  flightId: number
  overall: number
  convenience: number
  comments?: string
}) {
  const { data: matchedRide, error: rideError } = await supabase
    .from('Matches')
    .select('user_id, flight_id')
    .eq('flight_id', flightId)
    .eq('user_id', userId)
    .maybeSingle()

  if (rideError) {
    throw createError(rideError.message, 400, rideError)
  }
  if (!matchedRide) {
    throw createError('Selected match not found.', 404)
  }

  const { error } = await supabase.from('Feedback').insert([
    {
      user_id: userId,
      flight_id: flightId,
      overall,
      convenience,
      comments: comments?.trim() || null,
    },
  ])

  if (error) {
    throw createError(error.message, 400, error)
  }

  return { success: true }
}

export async function saveOwnProfile({
  supabase,
  userId,
  profile,
}: {
  supabase: SupabaseClient
  userId: string
  profile: {
    email: string
    firstname: string
    lastname: string
    school: string
    phonenumber: string
    sms_opt_in: boolean
    photo_url: string
    instagram: string | null
  }
}) {
  const missingFields = getMissingProfileFields(profile)
  if (missingFields.length > 0) {
    throw createError(
      `Please complete your profile: ${missingFields.join(', ')}.`,
      400,
    )
  }

  const payload = {
    user_id: userId,
    email: profile.email,
    firstname: profile.firstname,
    lastname: profile.lastname,
    school: profile.school,
    phonenumber: profile.phonenumber,
    sms_opt_in: profile.sms_opt_in,
    photo_url: profile.photo_url,
    instagram: profile.instagram,
  }

  const { error } = await supabase
    .from('Users')
    .upsert([payload], { onConflict: 'user_id' })

  if (error) {
    throw createError(error.message, 400, error)
  }

  return {
    success: true,
    profile: payload,
  }
}

export async function markGroupsReadyIfEligible({
  supabase,
  userId,
  rideIds,
}: {
  supabase: SupabaseClient
  userId: string
  rideIds: number[]
}) {
  const uniqueRideIds = Array.from(
    new Set(rideIds.filter((rideId) => Number.isInteger(rideId) && rideId > 0)),
  )

  if (uniqueRideIds.length === 0) {
    return { success: true, results: [] }
  }

  const { data, error } = await supabase
    .from('Matches')
    .select(
      'ride_id, user_id, ready_for_pickup_at, reported_missing_user_ids, group_ready_at',
    )
    .in('ride_id', uniqueRideIds)

  if (error) {
    throw createError(error.message, 400, error)
  }

  const matchesByRideId = new Map<number, any[]>()
  for (const match of data || []) {
    const rideMatches = matchesByRideId.get(match.ride_id) || []
    rideMatches.push(match)
    matchesByRideId.set(match.ride_id, rideMatches)
  }

  for (const rideId of uniqueRideIds) {
    const rideMatches = matchesByRideId.get(rideId) || []
    if (!rideMatches.some((match) => match.user_id === userId)) {
      throw createError('You are not a member of this ride.', 403)
    }
  }

  const results = await Promise.all(
    uniqueRideIds.map(async (rideId) => {
      const rideMatches = matchesByRideId.get(rideId) || []
      const existingGroupReadyAt = rideMatches.find(
        (match) => match.group_ready_at,
      )?.group_ready_at

      if (existingGroupReadyAt) {
        return { rideId, updated: false, groupReadyAt: existingGroupReadyAt }
      }

      if (!isGroupReady(rideMatches)) {
        return { rideId, updated: false, groupReadyAt: null }
      }

      const groupReadyAt = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('Matches')
        .update({ group_ready_at: groupReadyAt })
        .eq('ride_id', rideId)
        .is('group_ready_at', null)

      if (updateError) {
        throw createError(updateError.message, 400, updateError)
      }

      return { rideId, updated: true, groupReadyAt }
    }),
  )

  return { success: true, results }
}
