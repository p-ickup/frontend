/**
 * Admin tooling: riders reported missing via ASPC Ready (`reported_missing_user_ids`),
 * cross-referenced with delay logs (`ChangeLog` ASPC_DELAY) and ready-for-pickup.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export type MatchRowForNoShow = {
  ride_id: number
  user_id: string
  reported_missing_user_ids?: string[] | null
  ready_for_pickup_at?: string | null
}

export type NoShowRiderInfo = {
  reporterCount: number
  reporterUserIds: string[]
  /** Full names of riders who reported this person missing (sorted). */
  reporterNames: string[]
  /** Red: reported missing, no delay log for this ride. Orange: delay form and/or new flight on delay. */
  flag: 'red' | 'orange'
  submittedDelayForRide: boolean
  hadNewFlightOnDelay: boolean
  /** The reported-missing rider submitted ASPC Ready for this ride (has ready_for_pickup_at). */
  missingRiderSubmittedReady: boolean
}

type ChangeLogDelayRow = {
  actor_user_id: string
  target_group_id: string | number | null
  metadata?: Record<string, unknown> | null
}

/** For each (ride_id, missing_user_id), set of reporter user_ids on that ride. */
export function aggregateMissingReports(
  matches: MatchRowForNoShow[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const m of matches) {
    const missing = m.reported_missing_user_ids || []
    for (const raw of missing) {
      const missingId = String(raw)
      if (!missingId || missingId === String(m.user_id)) continue
      const key = `${m.ride_id}:${missingId}`
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(String(m.user_id))
    }
  }
  return map
}

export function parseNoShowKey(
  key: string,
): { rideId: number; missingId: string } | null {
  const i = key.indexOf(':')
  if (i <= 0) return null
  const rideId = Number(key.slice(0, i))
  const missingId = key.slice(i + 1)
  if (Number.isNaN(rideId) || !missingId) return null
  return { rideId, missingId }
}

function normGroupId(v: string | number | null | undefined): string | null {
  if (v === null || v === undefined) return null
  return String(v)
}

function delayLogMatchesRide(
  log: ChangeLogDelayRow,
  rideId: number,
  missingUserId: string,
): boolean {
  if (String(log.actor_user_id) !== missingUserId) return false
  return normGroupId(log.target_group_id) === String(rideId)
}

function metadataHasNewFlight(
  meta: Record<string, unknown> | null | undefined,
): boolean {
  if (!meta || typeof meta !== 'object') return false
  if (meta.new_flight_no != null && String(meta.new_flight_no).trim() !== '')
    return true
  if (
    meta.new_flight_airport != null &&
    String(meta.new_flight_airport).trim() !== ''
  )
    return true
  return false
}

function missingRiderHasReadySubmission(
  matches: MatchRowForNoShow[],
  rideId: number,
  missingUserId: string,
): boolean {
  return matches.some(
    (m) =>
      m.ride_id === rideId &&
      String(m.user_id) === missingUserId &&
      Boolean(m.ready_for_pickup_at?.trim()),
  )
}

async function fetchReporterNames(
  client: SupabaseClient,
  reporterIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (reporterIds.length === 0) return map
  const { data: users, error } = await client
    .from('Users')
    .select('user_id, firstname, lastname')
    .in('user_id', reporterIds)
  if (error) {
    console.error(
      '[adminMatchNoShows] Users fetch for reporters failed:',
      error,
    )
    return map
  }
  for (const u of users || []) {
    const id = String((u as { user_id: string }).user_id)
    const fn = (u as { firstname?: string | null }).firstname?.trim() || ''
    const ln = (u as { lastname?: string | null }).lastname?.trim() || ''
    const full = `${fn} ${ln}`.trim() || '—'
    map.set(id, full)
  }
  return map
}

/**
 * Fetches ASPC_DELAY rows for the given ride_ids and builds a lookup:
 * key `${rideId}:${missingUserId}` → display info for admins.
 */
export async function buildNoShowLookup(
  /** Use browser/server Supabase client; typed loosely to avoid deep generic recursion. */
  supabase: unknown,
  matches: MatchRowForNoShow[],
): Promise<Map<string, NoShowRiderInfo>> {
  const client = supabase as SupabaseClient
  const result = new Map<string, NoShowRiderInfo>()
  const aggregates = aggregateMissingReports(matches)
  if (aggregates.size === 0) return result

  const parseKey = parseNoShowKey

  const rideIds = Array.from(
    new Set(
      Array.from(aggregates.keys())
        .map((k) => parseKey(k)?.rideId)
        .filter((n): n is number => n != null && !Number.isNaN(n)),
    ),
  )

  if (rideIds.length === 0) return result

  const allReporterIds = Array.from(
    new Set(Array.from(aggregates.values()).flatMap((s) => Array.from(s))),
  )

  const [reporterNameByUserId, logsResult] = await Promise.all([
    fetchReporterNames(client, allReporterIds),
    client
      .from('ChangeLog')
      .select('actor_user_id, target_group_id, metadata')
      .eq('action', 'ASPC_DELAY')
      .in('target_group_id', rideIds),
  ])

  const { data: logs, error } = logsResult
  if (error) {
    console.error('[adminMatchNoShows] ChangeLog fetch failed:', error)
  }

  let delayLogs: ChangeLogDelayRow[] = (logs || []) as ChangeLogDelayRow[]

  // Retry with string ride ids if column is text (avoids empty results).
  if (delayLogs.length === 0 && rideIds.length > 0) {
    const { data: logs2, error: err2 } = await client
      .from('ChangeLog')
      .select('actor_user_id, target_group_id, metadata')
      .eq('action', 'ASPC_DELAY')
      .in(
        'target_group_id',
        rideIds.map((id) => String(id)),
      )
    if (!err2 && logs2?.length) {
      delayLogs = logs2 as ChangeLogDelayRow[]
    }
  }

  for (const [key, reporters] of Array.from(aggregates.entries())) {
    const parsed = parseKey(key)
    if (!parsed) continue
    const { rideId, missingId } = parsed
    const reporterUserIds = Array.from(reporters)
    const reporterCount = reporterUserIds.length
    const reporterNames = reporterUserIds
      .map((id) => reporterNameByUserId.get(id) || '—')
      .sort((a, b) => a.localeCompare(b))

    let submittedDelayForRide = false
    let hadNewFlightOnDelay = false

    for (const log of delayLogs) {
      if (!delayLogMatchesRide(log, rideId, missingId)) continue
      submittedDelayForRide = true
      if (metadataHasNewFlight(log.metadata)) hadNewFlightOnDelay = true
    }

    const flag: 'red' | 'orange' =
      submittedDelayForRide || hadNewFlightOnDelay ? 'orange' : 'red'

    const missingRiderSubmittedReady = missingRiderHasReadySubmission(
      matches,
      rideId,
      missingId,
    )

    result.set(key, {
      reporterCount,
      reporterUserIds,
      reporterNames,
      flag,
      submittedDelayForRide,
      hadNewFlightOnDelay,
      missingRiderSubmittedReady,
    })
  }

  return result
}

export function noShowTooltip(info: NoShowRiderInfo): string {
  const n = info.reporterCount
  const names =
    info.reporterNames.length > 0
      ? info.reporterNames.join(', ')
      : 'Unknown reporters'

  // Line 1: how many + who
  const line1 = n === 1 ? `1 reporter: ${names}.` : `${n} reporters: ${names}.`

  // Line 2: ready-for-pickup form on this match
  const line2 = info.missingRiderSubmittedReady
    ? 'They later submitted the ready-for-pickup (ASPC Ready) form on this match.'
    : 'They have not submitted the ready-for-pickup form on this match yet.'

  const lines = [line1, line2]

  // Line 3: only when they have NOT submitted ready — delay / flight change
  if (!info.missingRiderSubmittedReady) {
    if (info.hadNewFlightOnDelay) {
      lines.push(
        'They submitted a delay form with a new flight (or flight change) logged.',
      )
    } else if (info.submittedDelayForRide) {
      lines.push('They submitted a delay form for this ride (ChangeLog).')
    } else {
      lines.push(
        'No delay form or flight change logged for this rider on this ride.',
      )
    }
  }

  return lines.join('\n')
}
