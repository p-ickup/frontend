'use client'
import CommentSection from '@/components/results/CommentSection'
import RedirectButton from '@/components/buttons/RedirectButton'
import EmptyState from '@/components/results/EmptyState'
import MatchCard from '@/components/results/MatchCard'
import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import { isGroupReady } from '@/utils/groupReadiness'
import { useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type Tables = Database['public']['Tables']
type User = Tables['Users']['Row']
type Match = Tables['Matches']['Row']

export interface MatchWithDetails extends Match {
  Flights: Database['public']['Tables']['Flights']['Row']
  Users: Database['public']['Tables']['Users']['Row']
  Comments: Database['public']['Tables']['Comments']['Row'][] // Add this line
}

interface GroupedMatches {
  upcoming: {
    [ride_id: number]: MatchWithDetails[]
  }
  previous: {
    [ride_id: number]: MatchWithDetails[]
  }
}

const groupMatchesByRideId = (matches: MatchWithDetails[]) => {
  const grouped: { [key: number]: MatchWithDetails[] } = {}

  matches.forEach((match) => {
    const rideId = match.ride_id
    if (!grouped[rideId]) {
      grouped[rideId] = []
    }
    grouped[rideId].push(match)
  })

  return grouped
}

export default function Results() {
  const [matches, setMatches] = useState<GroupedMatches>({
    upcoming: {},
    previous: {},
  })
  const [rideReadiness, setRideReadiness] = useState<
    Record<number, { isReady: boolean; matchDateTime: Date | null }>
  >({})
  const [showPrevious, setShowPrevious] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()
  const { user, isAuthenticated, signInWithGoogle } = useAuth()

  useEffect(() => {
    if (user) {
      // console.log('Current User ID:', user.id);
      void fetchMatches()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchMatches = async () => {
    try {
      setLoading(true)

      if (!user) {
        console.error('No authenticated user found')
        return
      }

      const { data: userRideIds, error: rideError } = await supabase
        .from('Matches')
        .select('ride_id')
        .eq('user_id', user.id)

      if (rideError) throw rideError
      if (!userRideIds || userRideIds.length === 0) {
        setMatches({ upcoming: {}, previous: {} })
        setRideReadiness({})
        return
      }

      // Step 2: Get all matches for those rides with user and flight details
      const { data: allMatches, error: matchError } = await supabase
        .from('Matches')
        .select(
          `
        *,
        Flights (*),
        Users (*),
        Comments (
          *,
          Users (
            firstname
          )
        )
      `,
        )
        .in(
          'ride_id',
          userRideIds.map((r) => r.ride_id),
        )

      // const { data: allMatches, error: matchError } = await supabase
      //   .from('Matches')
      //   .select(
      //     `
      //   *,
      //   Flights (*),
      //   Users (*)
      // `,
      //   )
      //   .in(
      //     'ride_id',
      //     userRideIds.map((r) => r.ride_id),
      //   )

      if (matchError) throw matchError
      if (!allMatches) throw new Error('No matches found')

      // Include your own match so solo rides still appear (otherwise filtering
      // out user_id === you removes every row when you're alone on a ride).
      const matchesWithDetails: MatchWithDetails[] =
        allMatches as MatchWithDetails[]

      // Group into upcoming and previous, and then by ride_id
      const now = new Date()
      const grouped = matchesWithDetails.reduce<GroupedMatches>(
        (acc, match) => {
          // Use match date and time if available, otherwise fall back to flight date
          let matchDateTime: Date

          if (match.date && match.time) {
            // Parse date manually to avoid timezone issues
            const [year, month, day] = match.date.split('-').map(Number)
            const [hours, minutes] = match.time.split(':').map(Number)
            matchDateTime = new Date(year, month - 1, day, hours, minutes)
          } else if (match.Flights?.date) {
            // Fallback to flight date if match date/time not available
            const [year, month, day] = match.Flights.date.split('-').map(Number)
            matchDateTime = new Date(year, month - 1, day)
          } else {
            // Skip matches without meaningful date information
            return acc
          }
          const rideId = match.ride_id

          // Determine if upcoming or previous (keep in upcoming with comment section for 1hr after match time)
          const oneHourAfterMatch = new Date(
            matchDateTime.getTime() + 60 * 60 * 1000,
          )
          const category = oneHourAfterMatch > now ? 'upcoming' : 'previous'

          // Initialize the ride_id array if it doesn't exist
          if (!acc[category][rideId]) {
            acc[category][rideId] = []
          }

          // Add the match to the appropriate group
          acc[category][rideId].push(match)

          return acc
        },
        { upcoming: {}, previous: {} },
      )

      const readiness: Record<
        number,
        { isReady: boolean; matchDateTime: Date | null }
      > = {}
      const rideIds = Array.from(new Set(allMatches.map((m) => m.ride_id)))
      for (const rideId of rideIds) {
        const rideMatches = allMatches.filter((m) => m.ride_id === rideId)
        const firstMatch = rideMatches[0]
        let matchDateTime: Date | null = null
        if (firstMatch?.date && firstMatch?.time) {
          const [y, mo, d] = firstMatch.date.split('-').map(Number)
          const [h, min] = firstMatch.time.split(':').map(Number)
          matchDateTime = new Date(y, mo - 1, d, h, min)
        } else if (firstMatch?.Flights?.date) {
          const [y, mo, d] = firstMatch.Flights.date.split('-').map(Number)
          matchDateTime = new Date(y, mo - 1, d)
        }
        const groupReadyAt = (
          rideMatches[0] as { group_ready_at?: string | null }
        )?.group_ready_at
        const computedReady = isGroupReady(rideMatches)
        const timePassed =
          matchDateTime != null &&
          matchDateTime.getTime() + 15 * 60 * 1000 < Date.now()
        const isReady = groupReadyAt != null || computedReady || timePassed

        if (computedReady && groupReadyAt == null) {
          const { error: updateError } = await supabase
            .from('Matches')
            .update({ group_ready_at: new Date().toISOString() })
            .eq('ride_id', rideId)
          if (updateError) {
            console.error(
              `[results] Failed to set group_ready_at for ride ${rideId}:`,
              updateError,
            )
          }
        }

        readiness[rideId] = { isReady, matchDateTime }
      }
      setRideReadiness(readiness)
      setMatches(grouped)
      console.log('Grouped matches:', grouped)
    } catch (error) {
      console.error('Error details:', error)
      setMatches({ upcoming: {}, previous: {} })
      setRideReadiness({})
    } finally {
      setLoading(false)
    }
  }

  const deleteMatch = async (rideId: number) => {
    if (!user) {
      console.error('No authenticated user found')
      return
    }

    try {
      // 1. Fetch user's match and flight for this ride
      const { data: userMatch, error: fetchMatchError } = await supabase
        .from('Matches')
        .select(
          `
          id,
          flight_id,
          date,
          time,
          is_subsidized,
          Flights (
            airport,
            to_airport,
            date,
            earliest_time
          )
        `,
        )
        .eq('ride_id', rideId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchMatchError) {
        console.error('Error fetching user match:', fetchMatchError)
        throw fetchMatchError
      }
      if (!userMatch) {
        throw new Error('Match not found')
      }

      const flight = Array.isArray(userMatch.Flights)
        ? userMatch.Flights[0]
        : userMatch.Flights
      const airport = (flight as { airport: string })?.airport || 'LAX'
      const toAirport = (flight as { to_airport: boolean })?.to_airport ?? true
      const flightDate = (flight as { date: string })?.date
      const matchDate = userMatch.date || flightDate || ''
      const matchTime =
        userMatch.time ||
        (flight as { earliest_time?: string })?.earliest_time ||
        '12:00:00'

      // 2. Compute fee-related fields
      // Everyone who cancels has a match, so they're past the matching deadline by definition.
      const cancelledAfterDeadline = true

      const [year, month, day] = matchDate.split('-').map(Number)
      const [hours, minutes] = matchTime.split(':').map(Number)
      const matchDateTime = new Date(year, month - 1, day, hours, minutes)
      const oneHourBeforeMatch = new Date(
        matchDateTime.getTime() - 60 * 60 * 1000,
      )
      const cancelledBefore1hr = new Date() <= oneHourBeforeMatch

      // 3. Insert into match_cancellations (audit for fee billing)
      const { error: insertError } = await supabase
        .from('match_cancellations')
        .insert({
          ride_id: rideId,
          user_id: user.id,
          flight_id: userMatch.flight_id,
          match_date: matchDate,
          match_time: matchTime.length === 5 ? `${matchTime}:00` : matchTime,
          airport,
          to_airport: toAirport,
          is_subsidized: userMatch.is_subsidized ?? null,
          cancelled_after_deadline: cancelledAfterDeadline,
          cancelled_before_1hr: cancelledBefore1hr,
          cancellation_type: 'student_initiated',
        })

      if (insertError) {
        console.error('Error logging cancellation:', insertError)
        // Don't throw - proceed with deletion; audit is best-effort
      }

      // 4. Get all matches for this ride (need flight_id to update Flights when deleting all)
      const { data: allRideMatches, error: fetchAllError } = await supabase
        .from('Matches')
        .select('user_id, flight_id')
        .eq('ride_id', rideId)

      if (fetchAllError) {
        console.error('Error fetching ride matches:', fetchAllError)
        throw fetchAllError
      }

      // 5. Delete matches
      if (allRideMatches && allRideMatches.length <= 2) {
        const { error: deleteAllError } = await supabase
          .from('Matches')
          .delete()
          .eq('ride_id', rideId)

        if (deleteAllError) {
          console.error('Error deleting all matches:', deleteAllError)
          throw deleteAllError
        }
      } else {
        const { error: deleteUserError } = await supabase
          .from('Matches')
          .delete()
          .eq('ride_id', rideId)
          .eq('user_id', user.id)

        if (deleteUserError) {
          console.error('Error deleting user match:', deleteUserError)
          throw deleteUserError
        }
      }

      // 6. Set Flights.matched = false for all affected users
      // When we deleted all matches (<=2), every user in the ride is now unmatched.
      // When we deleted only one match (>2), only the cancelling user is unmatched.
      const flightIdsToUpdate =
        allRideMatches && allRideMatches.length <= 2
          ? allRideMatches.map((m) => m.flight_id)
          : [userMatch.flight_id]

      for (const fid of flightIdsToUpdate) {
        const { error: updateFlightError } = await supabase
          .from('Flights')
          .update({ matched: false })
          .eq('flight_id', fid)

        if (updateFlightError) {
          console.error(
            `Error updating flight ${fid} matched status:`,
            updateFlightError,
          )
        }
      }

      await fetchMatches()
    } catch (error) {
      console.error('Error in delete operation:', error)
      throw error
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
          <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
          <div
            className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
            style={{ animationDelay: '1s' }}
          ></div>
        </div>

        <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="mb-6 text-4xl font-bold text-gray-900">
              Your Matches
            </h1>
            <p className="mb-8 text-xl text-gray-600">
              Sign in to view your travel matches and companions
            </p>
            <div className="rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
              <EmptyState type="login" onLogin={signInWithGoogle} />
              <div className="mt-6">
                <RedirectButton label="Back to Home" route="/" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading)
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="flex items-center space-x-4 rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
            <span className="text-lg font-medium text-gray-700">
              Loading Matches...
            </span>
          </div>
        </div>
      </div>
    )

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div
          className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="animate-float absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col">
        {/* Header Section */}
        <div className="relative px-6 pb-6 pt-8">
          <div className="mx-auto max-w-6xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Your Matches
            </h1>
            <p className="text-xl text-gray-600">
              Connect with your travel companions and plan your journey together
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="relative flex-1 px-6 pb-8">
          <div className="mx-auto max-w-6xl">
            {/* Upcoming Matches Section */}
            <div className="mb-8">
              <div className="mb-6 rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
                <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold text-gray-800">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-teal-100 to-teal-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6 text-teal-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </span>
                  Upcoming Matches
                </h2>
                {Object.keys(matches.upcoming).length > 0 ? (
                  (() => {
                    const groupedUpcoming = groupMatchesByRideId(
                      Object.values(matches.upcoming).flat(),
                    )

                    return Object.entries(groupedUpcoming).map(
                      ([rideId, matchesForRide]) => (
                        <div key={rideId} className="mb-8">
                          <MatchCard
                            matches={matchesForRide}
                            upcoming={true}
                            onDelete={deleteMatch}
                            rideId={parseInt(rideId)}
                            isGroupReady={
                              rideReadiness[parseInt(rideId)]?.isReady ?? false
                            }
                          />
                          <CommentSection rideId={parseInt(rideId)} />
                        </div>
                      ),
                    )
                  })()
                ) : (
                  <EmptyState type="upcoming" />
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mb-8 flex justify-center">
              <RedirectButton
                label="View Unmatched Flights"
                route="/unmatched"
                color="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                size="px-6 py-3 text-lg font-medium"
              />
            </div>

            {/* Toggle Previous Matches Button */}
            <div className="mb-8 flex justify-center">
              <button
                onClick={() => setShowPrevious(!showPrevious)}
                className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 px-6 py-3 font-semibold shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-white hover:shadow-xl"
              >
                {showPrevious ? 'Hide' : 'Show'} Previous Matches
                <svg
                  className={`h-5 w-5 transform transition-transform ${
                    showPrevious ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
            </div>

            {/* Previous Matches Section */}
            {showPrevious && (
              <div className="mb-8">
                <div className="rounded-2xl bg-white/80 p-6 shadow-lg backdrop-blur-sm">
                  <h2 className="mb-4 flex items-center gap-3 text-2xl font-bold text-gray-800">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-gray-100 to-gray-200">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-6 w-6 text-gray-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </span>
                    Previous Matches
                  </h2>
                  {Object.keys(matches.previous).length > 0 ? (
                    (() => {
                      // Group the previous matches by ride_id
                      const groupedPrevious = groupMatchesByRideId(
                        Object.values(matches.previous).flat(),
                      )

                      // Render a MatchCard for each group of matches with the same ride_id
                      return Object.entries(groupedPrevious).map(
                        ([rideId, matchesForRide]) => (
                          <MatchCard
                            key={rideId}
                            matches={matchesForRide}
                            upcoming={false}
                            rideId={parseInt(rideId)}
                            isGroupReady={
                              rideReadiness[parseInt(rideId)]?.isReady ?? false
                            }
                          />
                        ),
                      )
                    })()
                  ) : (
                    <EmptyState type="previous" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Back to Home Button
          <div className="flex justify-center">
            <RedirectButton 
              label="Back to Home" 
              route="/"
              color="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
              size="px-6 py-3 text-lg font-medium"
            />
          </div> */}
        </div>
      </div>
    </div>
  )
}
