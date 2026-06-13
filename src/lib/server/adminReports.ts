import 'server-only'

import {
  buildNoShowLookup,
  parseNoShowKey,
  type NoShowRiderInfo,
} from '@/utils/adminMatchNoShows'

type SupabaseClient = any

export async function getAdminCancellations({
  supabase,
  startDate,
  endDate,
}: {
  supabase: SupabaseClient
  startDate: string
  endDate: string
}) {
  const { data: rows, error } = await supabase
    .from('match_cancellations')
    .select(
      'id, ride_id, user_id, flight_id, cancelled_at, match_date, match_time, airport, to_airport, is_subsidized, cancelled_after_deadline, cancelled_before_1hr, cancellation_type',
    )
    .gte('cancelled_at', `${startDate}T00:00:00`)
    .lte('cancelled_at', `${endDate}T23:59:59`)
    .order('cancelled_at', { ascending: false })

  if (error) throw error

  const userIds = Array.from(
    new Set((rows || []).map((row: any) => String(row.user_id))),
  )
  const { data: users, error: usersError } = userIds.length
    ? await supabase
        .from('Users')
        .select('user_id, firstname, lastname, email')
        .in('user_id', userIds)
    : { data: [], error: null }
  if (usersError) throw usersError

  const usersMap = new Map(
    (users || []).map((user: any) => [String(user.user_id), user]),
  )

  return (rows || []).map((row: any) => {
    const user = usersMap.get(String(row.user_id)) as any
    return {
      ...row,
      firstname: user?.firstname,
      lastname: user?.lastname,
      email: user?.email,
    }
  })
}

export async function getAdminNoShows({
  supabase,
  startDate,
  endDate,
}: {
  supabase: SupabaseClient
  startDate: string
  endDate: string
}) {
  type MatchRow = {
    ride_id: number
    user_id: string
    reported_missing_user_ids: string[] | null
    date: string | null
    ready_for_pickup_at: string | null
  }

  const all: MatchRow[] = []
  const pageSize = 1000
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('Matches')
      .select(
        'ride_id, user_id, reported_missing_user_ids, date, ready_for_pickup_at',
      )
      .gte('date', startDate)
      .lte('date', endDate)
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...(data as MatchRow[]))
    if (data.length < pageSize) break
  }

  const usersPerRide = new Map<number, Set<string>>()
  const rideDateById = new Map<number, string | null>()
  for (const match of all) {
    const users = usersPerRide.get(match.ride_id) || new Set<string>()
    users.add(match.user_id)
    usersPerRide.set(match.ride_id, users)
    if (!rideDateById.has(match.ride_id) && match.date) {
      rideDateById.set(match.ride_id, match.date)
    }
  }

  const lookup = await buildNoShowLookup(supabase, all)
  const parsed = Array.from(lookup.entries())
    .map(([key, info]) => {
      const value = parseNoShowKey(key)
      return value
        ? { rideId: value.rideId, missingUserId: value.missingId, info }
        : null
    })
    .filter(
      (
        row,
      ): row is {
        rideId: number
        missingUserId: string
        info: NoShowRiderInfo
      } => row !== null,
    )

  parsed.sort((a, b) => {
    const aDate = rideDateById.get(a.rideId) || ''
    const bDate = rideDateById.get(b.rideId) || ''
    return (
      bDate.localeCompare(aDate) ||
      a.rideId - b.rideId ||
      a.missingUserId.localeCompare(b.missingUserId)
    )
  })

  const userIds = Array.from(new Set(parsed.map((row) => row.missingUserId)))
  const { data: users, error: usersError } = userIds.length
    ? await supabase
        .from('Users')
        .select('user_id, firstname, lastname')
        .in('user_id', userIds)
    : { data: [], error: null }
  if (usersError) throw usersError
  const names = new Map(
    (users || []).map((user: any) => [
      String(user.user_id),
      `${user.firstname || ''} ${user.lastname || ''}`.trim() ||
        String(user.user_id),
    ]),
  )

  return parsed.map((row) => ({
    rideId: row.rideId,
    missingUserId: row.missingUserId,
    name: names.get(row.missingUserId) || row.missingUserId,
    matchDate: rideDateById.get(row.rideId) || null,
    reporterCount: row.info.reporterCount,
    rideRosterSize: usersPerRide.get(row.rideId)?.size || 0,
    info: row.info,
  }))
}
