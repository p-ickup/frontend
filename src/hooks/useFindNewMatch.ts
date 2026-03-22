'use client'

import { calculateBagUnits, canAccommodateRider } from '@/utils/bagCapacity'
import { createBrowserClient } from '@/utils/supabase'
import { useCallback, useState } from 'react'

type SupabaseBrowserClient = ReturnType<typeof createBrowserClient>

/** Local calendar date + HH:MM → epoch ms; null if inputs are unusable */
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

/**
 * True when the rider’s new ETA (using the latest bound of a range) is strictly
 * before the original match pickup — they can still make the original group.
 */
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

export interface FindNewMatchParams {
  rideId: string
  userId: string
  reasonForDelay: string
  newEtaDate: string
  newEtaTime: string
  /** When delay is on a different day, use time range instead of single time */
  newEtaTimeEarliest?: string
  newEtaTimeLatest?: string
  /** If user said flight changed, optional new flight details */
  newFlight?: {
    airport: string
    flight_no: string
    date: string
    time: string
  } | null
}

/** Log rider-submitted delay (new ETA / flight) to ChangeLog; actor is the rider. Fails silently if RLS blocks insert. */
async function logAspcDelayToChangeLog(
  supabase: SupabaseBrowserClient,
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
    newFlight?: FindNewMatchParams['newFlight']
    outcome:
      | 'groups_available'
      | 'solo_ride_created'
      | 'kept_original_group_eta_earlier'
      | 'delay_no_group_unmatched'
    newRideId?: number
    /** Solo path: true only when contingency voucher was written onto the new match */
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

    const p = profile as { firstname?: string; lastname?: string } | null
    // Always log as rider context — admins using the rider flow should not show as Admin in changelog
    const actorRole = 'Rider'
    const riderName = `${p?.firstname ?? ''} ${p?.lastname ?? ''}`.trim()

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

    const { error } = await supabase.from('ChangeLog').insert({
      actor_user_id: args.userId,
      actor_role: actorRole,
      action: 'ASPC_DELAY',
      target_group_id: args.rideId,
      target_user_id: args.userId,
      metadata,
      ignored_error: false,
      confirmed: true,
    })

    if (error) {
      console.error('[ASPC delay] ChangeLog insert failed:', error.message)
    }
  } catch (e) {
    console.error('[ASPC delay] ChangeLog insert error:', e)
  }
}

export interface AvailableGroup {
  rideId: number
  date: string
  time: string
  rideType: string
  rideTime: string
  riderCount: number
}

export interface FindNewMatchResult {
  success: boolean
  error?: string
  /** Available groups (date, time, rider count only) */
  availableGroups?: AvailableGroup[]
  /** Previous match was marked subsidized (before delay flow) */
  wasSubsidized?: boolean
  /** Contingency URL/code stored on the match before this flow (if any) */
  contingencyVoucher?: string | null
  /**
   * Solo / no alternate group: true only when that code was written onto your match.
   * Use this (not wasSubsidized alone) to decide whether to show the voucher UI.
   */
  contingencyVoucherApplied?: boolean
  /**
   * Solo path: why the contingency voucher was not applied (user-facing bullets).
   * Empty when a voucher was applied or groups were available.
   */
  contingencyVoucherNotAppliedReasons?: string[]
  /**
   * Solo path: whether the match had a non-empty contingency_voucher before this flow
   * (helps the UI explain declines when the hook reasons array is missing).
   */
  hadContingencyVoucherOnFile?: boolean
  /**
   * New ETA is before original group pickup — rider stays on the same ride (no solo / no contingency).
   */
  keptOriginalGroupBecauseEarlierEta?: boolean
  /**
   * No alternate group and no contingency: match deleted, flight set unmatched (same as declining groups).
   */
  movedToUnmatched?: boolean
}

/**
 * Reasons to show when no contingency voucher was applied after a delay (solo / no group).
 * Merges API reasons with safe fallbacks so the UI never shows a blank explanation.
 */
export function getContingencyVoucherDeclineReasons(
  result: FindNewMatchResult,
): string[] {
  if (result.keptOriginalGroupBecauseEarlierEta) return []
  const hasGroups = (result.availableGroups?.length ?? 0) > 0
  if (hasGroups || result.contingencyVoucherApplied === true) return []

  const fromApi = result.contingencyVoucherNotAppliedReasons
  const merged: string[] = fromApi && fromApi.length > 0 ? [...fromApi] : []

  if (merged.length > 0) return Array.from(new Set(merged))

  if (result.wasSubsidized === false) {
    merged.push(
      'Your match was not subsidized before this delay, so a contingency voucher could not be applied.',
    )
  }
  if (result.hadContingencyVoucherOnFile === false) {
    merged.push(
      'No contingency voucher was on file for your ride before this change.',
    )
  }
  if (
    result.wasSubsidized === true &&
    result.hadContingencyVoucherOnFile === true
  ) {
    merged.push(
      'If you expected a voucher, try again or contact ASPC—there may have been a sync issue.',
    )
  }
  if (merged.length === 0) {
    merged.push(
      'A contingency voucher could not be applied. You must have been on a subsidized match with a voucher already on file before this delay.',
    )
  }
  return Array.from(new Set(merged))
}

/**
 * Find new match: list groups to join or create a solo ride.
 * - Finds groups on same date/airport/direction in time window (5 min before to 6 hours after) that can accommodate their bags.
 * - If any: returns availableGroups; user chooses one and joinGroup() updates their Match to that ride.
 * - If none and no contingency applies: deletes the rider’s match and sets their flight unmatched
 *   (they can use the unmatched flow)—same as explicitly declining all groups.
 * - If none but contingency applies: creates a new Rides row (solo) and keeps the code on
 *   `contingency_voucher` (main `voucher` stays empty).
 * - If the rider’s new ETA is strictly before the original group pickup, they are kept on the
 *   original ride (no rematch, no solo) — that is not treated as a delay for matching purposes.
 */
export function useFindNewMatch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const findNewMatch = useCallback(
    async (params: FindNewMatchParams): Promise<FindNewMatchResult> => {
      setLoading(true)
      setError(null)
      const supabase = createBrowserClient()

      try {
        const rid = parseInt(params.rideId, 10)
        if (Number.isNaN(rid)) {
          return { success: false, error: 'Invalid ride.' }
        }

        // 1) Fetch current match + flight + user school for airport, direction, bag counts, subsidy, Pomona check
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
          .eq('user_id', params.userId)
          .maybeSingle()

        if (fetchMatchError) {
          return { success: false, error: fetchMatchError.message }
        }
        if (!currentMatch) {
          return { success: false, error: 'Match not found.' }
        }

        const flight = Array.isArray(currentMatch.Flights)
          ? currentMatch.Flights[0]
          : currentMatch.Flights
        if (!flight) {
          return { success: false, error: 'Flight not found.' }
        }

        const airport = (flight as { airport: string }).airport
        const toAirport = (flight as { to_airport: boolean }).to_airport
        const bagNo = (flight as { bag_no: number }).bag_no ?? 0
        const bagNoLarge =
          (flight as { bag_no_large: number }).bag_no_large ?? 0
        const wasSubsidized =
          Boolean(
            (currentMatch as { voucher?: string | null }).voucher?.trim(),
          ) ||
          (
            currentMatch as { uber_type?: string | null }
          ).uber_type?.toLowerCase() === 'connect'
        const contingencyVoucher =
          (currentMatch as { contingency_voucher?: string | null })
            .contingency_voucher ?? null
        const oldMatchDate =
          (currentMatch as { date?: string | null }).date ?? null
        const oldMatchTime =
          (currentMatch as { time?: string | null }).time ?? null
        const flightId = (currentMatch as { flight_id: number }).flight_id
        const userSchool = (
          currentMatch as {
            Users?: { school: string } | { school: string }[] | null
          }
        ).Users
        const schoolObj = Array.isArray(userSchool) ? userSchool[0] : userSchool
        const isPomonaUser = (schoolObj?.school ?? '') === 'Pomona'

        const newEtaBeforeOriginalGroup = isNewDelayEtaBeforeOriginalGroup({
          originalMatchDate: oldMatchDate,
          originalMatchTime: oldMatchTime,
          fallbackFlightDate: (flight as { date: string }).date,
          newEtaDate: params.newEtaDate,
          newEtaTime: params.newEtaTime,
          newEtaTimeEarliest: params.newEtaTimeEarliest,
          newEtaTimeLatest: params.newEtaTimeLatest,
        })

        if (newEtaBeforeOriginalGroup) {
          await logAspcDelayToChangeLog(supabase, {
            userId: params.userId,
            rideId: rid,
            flightId,
            reasonForDelay: params.reasonForDelay,
            oldFlightDate: (flight as { date: string }).date,
            oldMatchDate,
            oldMatchTime,
            newEtaDate: params.newEtaDate,
            newEtaTime: params.newEtaTime,
            newEtaTimeEarliest: params.newEtaTimeEarliest,
            newEtaTimeLatest: params.newEtaTimeLatest,
            newFlight: params.newFlight ?? undefined,
            outcome: 'kept_original_group_eta_earlier',
          })
          const { error: clearReasonErr } = await supabase
            .from('Matches')
            .update({ reason_for_delay: null } as Record<string, unknown>)
            .eq('ride_id', rid)
            .eq('user_id', params.userId)
          if (clearReasonErr) {
            console.error(
              '[ASPC delay] Could not clear reason_for_delay:',
              clearReasonErr.message,
            )
          }
          return {
            success: true,
            wasSubsidized,
            keptOriginalGroupBecauseEarlierEta: true,
          }
        }

        // 2) Time window: 5 min before earliest to 6 hours after latest (single time = both)
        const useRange = params.newEtaTimeEarliest && params.newEtaTimeLatest
        const timeStart = useRange
          ? params.newEtaTimeEarliest!
          : params.newEtaTime
        const timeEnd = useRange ? params.newEtaTimeLatest! : params.newEtaTime

        const parseMinutes = (t: string) => {
          const [h, m] = t.split(':').map(Number)
          return (h ?? 0) * 60 + (m ?? 0)
        }
        const toTimeString = (mins: number) => {
          const h = Math.floor(mins / 60) % 24
          const m = mins % 60
          return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        }

        const startMins = parseMinutes(timeStart) - 5
        const endMins = parseMinutes(timeEnd) + 6 * 60
        const windowStart = toTimeString(Math.max(0, startMins))
        const windowEnd = toTimeString(endMins)

        // 4) Fetch Flights on same date, airport, direction; then Matches for those flight_ids (exclude current ride)
        const { data: flightsData, error: flightsError } = await supabase
          .from('Flights')
          .select('flight_id, airport, to_airport, date, bag_no, bag_no_large')
          .eq('date', params.newEtaDate)
          .eq('airport', airport)
          .eq('to_airport', toAirport)

        if (flightsError) {
          return { success: false, error: flightsError.message }
        }

        const flightIds = (flightsData ?? []).map(
          (f: { flight_id: number }) => f.flight_id,
        )

        let matchesData: unknown[] = []
        if (flightIds.length > 0) {
          const { data, error: matchesError } = await supabase
            .from('Matches')
            .select(
              'ride_id, date, time, uber_type, voucher, is_subsidized, flight_id, Flights(flight_id, bag_no, bag_no_large)',
            )
            .in('flight_id', flightIds)
            .neq('ride_id', rid)

          if (matchesError) {
            return { success: false, error: matchesError.message }
          }
          matchesData = data ?? []
        }

        type MatchRow = {
          ride_id: number
          date: string | null
          time: string | null
          uber_type: string | null
          voucher: string | null
          is_subsidized: boolean | null
          flight_id: number
          Flights:
            | { flight_id: number; bag_no: number; bag_no_large: number }
            | { flight_id: number; bag_no: number; bag_no_large: number }[]
            | null
        }
        const matches: MatchRow[] = matchesData as unknown as MatchRow[]

        // Group by ride_id; use one match's date, time, uber_type, voucher, is_subsidized (they share per ride)
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

        for (const m of matches) {
          const f = Array.isArray(m.Flights) ? m.Flights[0] : m.Flights
          if (!f) continue
          const rideId = m.ride_id
          const date = m.date ?? params.newEtaDate
          const time = (m.time ?? '00:00').slice(0, 5) // HH:MM
          const bagUnits = calculateBagUnits(f.bag_no_large ?? 0, f.bag_no ?? 0)

          if (!byRide.has(rideId)) {
            byRide.set(rideId, {
              date,
              time,
              uber_type: m.uber_type,
              voucher: m.voucher,
              is_subsidized: m.is_subsidized,
              flightIds: [m.flight_id],
              bagUnits,
            })
          } else {
            const g = byRide.get(rideId)!
            g.flightIds.push(m.flight_id)
            g.bagUnits += bagUnits
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

        // Filter: not full (< 6), time in window, can accommodate user's bags
        const userBagUnits = calculateBagUnits(bagNoLarge, bagNo)
        const availableGroups: AvailableGroup[] = []

        for (const [rideId, g] of Array.from(byRide.entries())) {
          const riderCount =
            rideIdToMatchCount.get(rideId) ?? g.flightIds.length
          if (riderCount >= 6) continue

          const groupTime = g.time.slice(0, 5)
          if (groupTime < windowStart || groupTime > windowEnd) continue

          // Non-Pomona users cannot join groups covered by Pomona (ASPC subsidized)
          const groupHasVoucherOrConnect =
            Boolean(g.voucher?.trim()) ||
            g.uber_type?.toLowerCase() === 'connect'
          if (!isPomonaUser && groupHasVoucherOrConnect) continue

          const canFit = canAccommodateRider(
            riderCount,
            g.bagUnits,
            bagNoLarge,
            bagNo,
          )
          if (!canFit) continue

          availableGroups.push({
            rideId,
            date: g.date,
            time: groupTime,
            rideType: g.uber_type ?? 'X',
            rideTime: groupTime,
            riderCount,
          })
        }

        // Sort by time
        availableGroups.sort((a, b) => a.rideTime.localeCompare(b.rideTime))

        if (availableGroups.length > 0) {
          await logAspcDelayToChangeLog(supabase, {
            userId: params.userId,
            rideId: rid,
            flightId,
            reasonForDelay: params.reasonForDelay,
            oldFlightDate: (flight as { date: string }).date,
            oldMatchDate,
            oldMatchTime,
            newEtaDate: params.newEtaDate,
            newEtaTime: params.newEtaTime,
            newEtaTimeEarliest: params.newEtaTimeEarliest,
            newEtaTimeLatest: params.newEtaTimeLatest,
            newFlight: params.newFlight ?? undefined,
            outcome: 'groups_available',
          })
          return {
            success: true,
            availableGroups,
            wasSubsidized,
          }
        }

        // No available group: contingency solo ride OR remove match (unmatched)
        const soloTime = params.newEtaTimeEarliest || params.newEtaTime
        const soloTimeFormatted =
          soloTime.length === 5 ? `${soloTime}:00` : soloTime

        const codeOnFile =
          Boolean(contingencyVoucher) &&
          String(contingencyVoucher).trim() !== ''

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
          const { error: deleteError } = await supabase
            .from('Matches')
            .delete()
            .eq('ride_id', rid)
            .eq('user_id', params.userId)

          if (deleteError) {
            return { success: false, error: deleteError.message }
          }

          const { error: flightUnmatchError } = await supabase
            .from('Flights')
            .update({ matched: false })
            .eq('flight_id', flightId)

          if (flightUnmatchError) {
            return { success: false, error: flightUnmatchError.message }
          }

          await logAspcDelayToChangeLog(supabase, {
            userId: params.userId,
            rideId: rid,
            flightId,
            reasonForDelay: params.reasonForDelay,
            oldFlightDate: (flight as { date: string }).date,
            oldMatchDate,
            oldMatchTime,
            newEtaDate: params.newEtaDate,
            newEtaTime: params.newEtaTime,
            newEtaTimeEarliest: params.newEtaTimeEarliest,
            newEtaTimeLatest: params.newEtaTimeLatest,
            newFlight: params.newFlight ?? undefined,
            outcome: 'delay_no_group_unmatched',
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

        const { data: rideData, error: rideError } = await supabase
          .from('Rides')
          .insert({ ride_date: params.newEtaDate })
          .select('ride_id')
          .single()

        if (rideError || !rideData) {
          return {
            success: false,
            error: rideError?.message ?? 'Failed to create new ride.',
          }
        }

        const newRideId = rideData.ride_id

        const { error: updateSoloError } = await supabase
          .from('Matches')
          .update({
            ride_id: newRideId,
            date: params.newEtaDate,
            time: soloTimeFormatted,
            uber_type: 'X',
            /** Contingency must not be promoted to main Uber voucher field */
            voucher: null,
            is_subsidized: wasSubsidized,
            contingency_voucher: soloMatchVoucher,
          })
          .eq('ride_id', rid)
          .eq('user_id', params.userId)

        if (updateSoloError) {
          return { success: false, error: updateSoloError.message }
        }

        await logAspcDelayToChangeLog(supabase, {
          userId: params.userId,
          rideId: rid,
          flightId,
          reasonForDelay: params.reasonForDelay,
          oldFlightDate: (flight as { date: string }).date,
          oldMatchDate,
          oldMatchTime,
          newEtaDate: params.newEtaDate,
          newEtaTime: params.newEtaTime,
          newEtaTimeEarliest: params.newEtaTimeEarliest,
          newEtaTimeLatest: params.newEtaTimeLatest,
          newFlight: params.newFlight ?? undefined,
          outcome: 'solo_ride_created',
          newRideId: newRideId,
          contingencyVoucherAssigned: true,
          assignedContingencyVoucher: soloMatchVoucher,
        })

        return {
          success: true,
          availableGroups: [],
          wasSubsidized,
          contingencyVoucher: contingencyVoucher,
          contingencyVoucherApplied: true,
          contingencyVoucherNotAppliedReasons: [],
          hadContingencyVoucherOnFile: codeOnFile,
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const joinGroup = useCallback(
    async (params: {
      currentRideId: number
      userId: string
      selectedRideId: number
    }): Promise<{ success: boolean; error?: string }> => {
      setLoading(true)
      setError(null)
      const supabase = createBrowserClient()
      try {
        const [matchRes, userRes] = await Promise.all([
          supabase
            .from('Matches')
            .select('date, time, uber_type, voucher, is_subsidized')
            .eq('ride_id', params.selectedRideId)
            .limit(1)
            .maybeSingle(),
          supabase
            .from('Users')
            .select('school')
            .eq('user_id', params.userId)
            .maybeSingle(),
        ])

        const matchRow = matchRes.data
        const fetchMatchError = matchRes.error
        if (fetchMatchError || !matchRow) {
          return {
            success: false,
            error: fetchMatchError?.message ?? 'No match found for that ride.',
          }
        }

        const groupSubsidized =
          Boolean((matchRow as { voucher?: string | null }).voucher?.trim()) ||
          (
            matchRow as { uber_type?: string | null }
          ).uber_type?.toLowerCase() === 'connect'
        const userSchool =
          (userRes.data as { school?: string } | null)?.school ?? ''
        if (groupSubsidized && userSchool !== 'Pomona') {
          return {
            success: false,
            error:
              'Only Pomona College students can join ASPC-subsidized groups.',
          }
        }

        const r = matchRow as {
          date: string | null
          time: string | null
          uber_type: string | null
          voucher: string | null
          is_subsidized: boolean | null
        }
        const timeFormatted =
          (r.time ?? '00:00').length === 5
            ? `${r.time}:00`
            : (r.time ?? '00:00:00')
        const groupVoucher = r.voucher && r.voucher !== 'NA' ? r.voucher : null

        const { error: updateError } = await supabase
          .from('Matches')
          .update({
            ride_id: params.selectedRideId,
            date: r.date ?? undefined,
            time: timeFormatted,
            uber_type: r.uber_type ?? 'X',
            voucher: groupVoucher,
            is_subsidized: groupSubsidized,
          })
          .eq('ride_id', params.currentRideId)
          .eq('user_id', params.userId)

        if (updateError) {
          return { success: false, error: updateError.message }
        }
        return { success: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const declineAllGroups = useCallback(
    async (params: {
      currentRideId: number
      userId: string
    }): Promise<{ success: boolean; error?: string }> => {
      setLoading(true)
      setError(null)
      const supabase = createBrowserClient()
      try {
        const { data: matchRow, error: fetchError } = await supabase
          .from('Matches')
          .select('flight_id')
          .eq('ride_id', params.currentRideId)
          .eq('user_id', params.userId)
          .maybeSingle()

        if (fetchError || !matchRow) {
          return {
            success: false,
            error: fetchError?.message ?? 'Match not found.',
          }
        }

        const flightId = (matchRow as { flight_id: number }).flight_id

        const { error: deleteError } = await supabase
          .from('Matches')
          .delete()
          .eq('ride_id', params.currentRideId)
          .eq('user_id', params.userId)

        if (deleteError) {
          return { success: false, error: deleteError.message }
        }

        const { error: flightError } = await supabase
          .from('Flights')
          .update({ matched: false })
          .eq('flight_id', flightId)

        if (flightError) {
          return { success: false, error: flightError.message }
        }

        return { success: true }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  return { findNewMatch, joinGroup, declineAllGroups, loading, error }
}
