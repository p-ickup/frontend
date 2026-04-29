import 'server-only'

import { canEditFlight } from '@/utils/flightValidation'
import { isGroupReady } from '@/utils/groupReadiness'

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
        .select('flight_id, user_id, matched')
        .eq('flight_id', senderFlightId)
        .maybeSingle(),
      supabase
        .from('Flights')
        .select('flight_id, user_id, matched')
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
  if (senderFlight.matched || receiverFlight.matched) {
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
      `*,
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
  rideId,
}: {
  supabase: SupabaseClient
  rideId: number
}) {
  const { data, error } = await supabase.rpc('cancel_own_match', {
    p_ride_id: rideId,
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
  const { data, error } = await supabase
    .from('Flights')
    .insert([
      {
        user_id: userId,
        ...payload,
        matched: null,
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

  const { error } = await supabase
    .from('Flights')
    .update({
      ...payload,
      matched: null,
    })
    .eq('flight_id', flightId)

  if (error) {
    throw createError(error.message, error.code === '23505' ? 409 : 400, error)
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

  const { error } = await supabase
    .from('Flights')
    .delete()
    .eq('flight_id', flightId)

  if (error) {
    throw createError(error.message, 400, error)
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
  const [
    { data: myFlightsData },
    { data: pendingMatchData },
    flightRes,
    matchRes,
  ] = await Promise.all([
    supabase
      .from('Flights')
      .select('*')
      .eq('user_id', userId)
      .eq('matched', false)
      .eq('opt_in', true),
    supabase
      .from('MatchRequests')
      .select('receiver_flight_id')
      .eq('sender_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('Flights')
      .select('*, Users:Users!Flights_user_id_fkey(firstname, lastname, email)')
      .eq('opt_in', true)
      .eq('matched', false)
      .neq('user_id', userId),
    supabase
      .from('Matches')
      .select(
        'ride_id, time, is_subsidized, flight:Flights(flight_id, airport, earliest_time, latest_time, date, user_id, matched, to_airport, opt_in, Users(firstname, lastname, email))',
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
          flights: [],
          time: match.time,
        }
      }
      if (match.flight && Array.isArray(match.flight)) {
        acc[rideId].flights.push(...match.flight)
      } else if (match.flight) {
        acc[rideId].flights.push(match.flight)
      }
      return acc
    },
    {} as Record<number, any>,
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
    myFlights: myFlightsData || [],
    pendingRequests: (pendingMatchData || []).map(
      (request: { receiver_flight_id: number }) => request.receiver_flight_id,
    ),
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
      *,
      Flights (*),
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
    matches: data || [],
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
        Flights (airport, to_airport, date),
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
      Flights (airport, to_airport, date)
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
        Flights (
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
      Flights (airport, to_airport, date)
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
        .select('*, user:Users(user_id, firstname)')
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
    .select('*, user:Users(user_id, firstname)')
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
    .select('flight_id, Flights(date, to_airport, airport)')
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

export async function markGroupReadyIfEligible({
  supabase,
  userId,
  rideId,
}: {
  supabase: SupabaseClient
  userId: string
  rideId: number
}) {
  const rideMatches = await assertRideMembership({ supabase, userId, rideId })

  const { data: fullRideMatches, error } = await supabase
    .from('Matches')
    .select(
      'user_id, ready_for_pickup_at, ready_for_pickup_status, reported_missing_user_ids, group_ready_at',
    )
    .eq('ride_id', rideId)

  if (error) {
    throw createError(error.message, 400, error)
  }

  const existingGroupReadyAt = (fullRideMatches || []).find(
    (match: { group_ready_at?: string | null }) => match.group_ready_at,
  )?.group_ready_at

  if (existingGroupReadyAt) {
    return {
      success: true,
      updated: false,
      groupReadyAt: existingGroupReadyAt,
    }
  }

  if (!isGroupReady(fullRideMatches || rideMatches)) {
    return {
      success: true,
      updated: false,
      groupReadyAt: null,
    }
  }

  const groupReadyAt = new Date().toISOString()
  const { error: updateError } = await supabase
    .from('Matches')
    .update({ group_ready_at: groupReadyAt })
    .eq('ride_id', rideId)

  if (updateError) {
    throw createError(updateError.message, 400, updateError)
  }

  return {
    success: true,
    updated: true,
    groupReadyAt,
  }
}
