import 'server-only'

import { toAdminSummaryDto, type AdminSummaryDto } from '@/contracts/readModels'

type SupabaseClient = any

type AdminProfile = {
  admin_scope?: string | null
  school?: string | null
}

type LastRun = {
  finished_at: string | null
  status: string
  target: string | null
} | null

const createError = (message: string, details?: unknown) => {
  const error = new Error(message) as Error & { details?: unknown }
  error.details = details
  return error
}

const firstRelated = <T>(value: T | T[] | null | undefined): T | null =>
  Array.isArray(value) ? value[0] || null : value || null

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  })

  return `${datePart} – ${timePart} PT`
}

const fetchLastRun = async (supabase: SupabaseClient): Promise<LastRun> => {
  const { data, error } = await supabase
    .from('AlgorithmStatus')
    .select('finished_at, status, target')
    .in('status', ['success', 'failed'])
    .not('finished_at', 'is', null)
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw createError(error.message, error)
  return data || null
}

const fetchNextScheduledRun = async (supabase: SupabaseClient) => {
  const { data, error } = await supabase
    .from('AlgorithmStatus')
    .select('scheduled_for, target')
    .eq('status', 'scheduled')
    .not('scheduled_for', 'is', null)
    .order('scheduled_for', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) throw createError(error.message, error)
  return data || null
}

const fetchUnmatchedFlightsCount = async ({
  supabase,
  startDate,
  endDate,
}: {
  supabase: SupabaseClient
  startDate: string
  endDate: string
}) => {
  const { count, error } = await supabase
    .from('Flights')
    .select('flight_id', { count: 'exact', head: true })
    .in('matching_status', ['submitted', 'unmatched'])
    .gte('date', startDate)
    .lt('date', endDate)

  if (error) throw createError(error.message, error)
  return count || 0
}

const fetchMatchRate = async ({
  supabase,
  adminScope,
  lastRun,
}: {
  supabase: SupabaseClient
  adminScope: string | null
  lastRun: LastRun
}) => {
  if (!lastRun?.finished_at || !adminScope) {
    return { matchRate: 0, matchedRiders: 0, totalRiders: 0 }
  }

  const startDate = new Date(lastRun.finished_at)
  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + 15)

  const { data: flights, error: flightsError } = await supabase
    .from('Flights')
    .select('flight_id, user_id, Users:Users!Flights_user_id_fkey(school)')
    .gte('date', startDate.toISOString().split('T')[0])
    .lte('date', endDate.toISOString().split('T')[0])

  if (flightsError) throw createError(flightsError.message, flightsError)

  const scopedFlights = (flights || []).filter((flight: any) => {
    const user = firstRelated<{ school?: string | null }>(flight.Users)
    return user?.school === adminScope
  })
  const flightIds = scopedFlights.map((flight: any) => flight.flight_id)

  let matchedFlightIds = new Set<number>()
  if (flightIds.length > 0) {
    const { data: matches, error: matchesError } = await supabase
      .from('Matches')
      .select('flight_id')
      .in('flight_id', flightIds)

    if (matchesError) throw createError(matchesError.message, matchesError)
    matchedFlightIds = new Set(
      (matches || []).map((match: any) => Number(match.flight_id)),
    )
  }

  const uniqueUsers = new Set(
    scopedFlights.map((flight: any) => flight.user_id).filter(Boolean),
  )
  const matchedUsers = new Set(
    scopedFlights
      .filter((flight: any) => matchedFlightIds.has(flight.flight_id))
      .map((flight: any) => flight.user_id)
      .filter(Boolean),
  )
  const totalRiders = uniqueUsers.size
  const matchedRiders = matchedUsers.size

  return {
    matchRate:
      totalRiders > 0 ? Math.round((matchedRiders / totalRiders) * 100) : 0,
    matchedRiders,
    totalRiders,
  }
}

export async function getAdminDashboardSummary({
  supabase,
  profile,
  unmatchedStartDate,
  unmatchedEndDate,
}: {
  supabase: SupabaseClient
  profile: AdminProfile
  unmatchedStartDate: string
  unmatchedEndDate: string
}): Promise<AdminSummaryDto> {
  const lastRunPromise = fetchLastRun(supabase)
  const scheduledRunPromise = fetchNextScheduledRun(supabase)
  const unmatchedCountPromise = fetchUnmatchedFlightsCount({
    supabase,
    startDate: unmatchedStartDate,
    endDate: unmatchedEndDate,
  })
  const matchRatePromise = lastRunPromise.then((lastRun) =>
    fetchMatchRate({
      supabase,
      adminScope: profile.admin_scope?.trim() || null,
      lastRun,
    }),
  )

  const [lastRun, scheduledRun, unmatchedFlightsCount, matchRate] =
    await Promise.all([
      lastRunPromise,
      scheduledRunPromise,
      unmatchedCountPromise,
      matchRatePromise,
    ])

  return toAdminSummaryDto({
    school: profile.school || '',
    ...matchRate,
    unmatchedFlightsCount,
    algorithmLastRan: lastRun?.finished_at
      ? formatDateTime(lastRun.finished_at)
      : 'Never',
    lastRunStatus: lastRun
      ? `${lastRun.status === 'success' ? 'Completed' : 'Failed'} (${lastRun.target || 'All'})`
      : '',
    nextScheduledRunDate: scheduledRun?.scheduled_for
      ? formatDateTime(scheduledRun.scheduled_for)
      : 'N/A',
    nextScheduledRunTarget: scheduledRun?.target || '',
  })
}
