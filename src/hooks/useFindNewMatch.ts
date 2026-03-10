'use client'

import { useSubsidyLogic } from '@/hooks/useSubsidyLogic'
import { calculateBagUnits, canAccommodateRider } from '@/utils/bagCapacity'
import { createBrowserClient } from '@/utils/supabase'
import { useCallback, useState } from 'react'

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
  /** If no match and user was subsidized, show this voucher */
  wasSubsidized?: boolean
  contingencyVoucher?: string | null
}

/**
 * Find new match: list groups to join or create a solo ride.
 * - Finds groups on same date/airport/direction in time window (5 min before to 6 hours after) that can accommodate their bags.
 * - If any: returns availableGroups; user chooses one and joinGroup() updates their Match to that ride.
 * - If none: creates a new Rides row (solo group) and updates their Match row to it; returns contingency voucher if subsidized.
 */
export function useFindNewMatch() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { computeGroupSubsidized } = useSubsidyLogic()

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
        const userSchool = (
          currentMatch as {
            Users?: { school: string } | { school: string }[] | null
          }
        ).Users
        const schoolObj = Array.isArray(userSchool) ? userSchool[0] : userSchool
        const isPomonaUser = (schoolObj?.school ?? '') === 'Pomona'

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
          return {
            success: true,
            availableGroups,
            wasSubsidized,
          }
        }

        // No available group: create a new Rides row (solo group) and update user's Match to it
        const soloTime = params.newEtaTimeEarliest || params.newEtaTime
        const soloTimeFormatted =
          soloTime.length === 5 ? `${soloTime}:00` : soloTime

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

        const { subsidized: soloSubsidized, assignVoucher: soloAssignVoucher } =
          computeGroupSubsidized({
            date: params.newEtaDate,
            toAirport,
            airport,
            riderCount: 1,
            riderSchools: [schoolObj?.school ?? ''],
            uberType: 'X',
          })
        const soloMatchVoucher =
          soloAssignVoucher && wasSubsidized && contingencyVoucher
            ? contingencyVoucher
            : ''

        const { error: updateSoloError } = await supabase
          .from('Matches')
          .update({
            ride_id: newRideId,
            date: params.newEtaDate,
            time: soloTimeFormatted,
            uber_type: 'X',
            voucher: soloMatchVoucher,
            is_subsidized: soloSubsidized,
          })
          .eq('ride_id', rid)
          .eq('user_id', params.userId)

        if (updateSoloError) {
          return { success: false, error: updateSoloError.message }
        }

        return {
          success: true,
          availableGroups: [],
          wasSubsidized,
          contingencyVoucher,
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Something went wrong'
        setError(message)
        return { success: false, error: message }
      } finally {
        setLoading(false)
      }
    },
    [computeGroupSubsidized],
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
