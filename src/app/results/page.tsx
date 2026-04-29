'use client'
import CommentSection from '@/components/results/CommentSection'
import RedirectButton from '@/components/buttons/RedirectButton'
import EmptyState from '@/components/results/EmptyState'
import MatchCard from '@/components/results/MatchCard'
import type { Database } from '@/lib/database.types'
import { postJson, requestJson } from '@/utils/api'
import { isGroupReady } from '@/utils/groupReadiness'
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'

type Tables = Database['public']['Tables']
type User = Tables['Users']['Row']
type Match = Tables['Matches']['Row']

export interface MatchWithDetails extends Match {
  Flights: Database['public']['Tables']['Flights']['Row']
  Users: Database['public']['Tables']['Users']['Row']
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
  const { user, isAuthenticated, signInWithGoogle } = useAuth()

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true)

      if (!user) {
        console.error('No authenticated user found')
        return
      }

      const result = await requestJson<{
        success: boolean
        matches: MatchWithDetails[]
      }>('/api/results')

      if (!result.matches || result.matches.length === 0) {
        setMatches({ upcoming: {}, previous: {} })
        setRideReadiness({})
        return
      }

      const matchesWithDetails = result.matches

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
      const rideIds = Array.from(
        new Set(matchesWithDetails.map((match) => match.ride_id)),
      )
      for (const rideId of rideIds) {
        const rideMatches = matchesWithDetails.filter(
          (match) => match.ride_id === rideId,
        )
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
          try {
            await postJson('/api/matches/mark-group-ready', { rideId })
          } catch (updateError) {
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
    } catch (error) {
      console.error('Error details:', error)
      setMatches({ upcoming: {}, previous: {} })
      setRideReadiness({})
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      // console.log('Current User ID:', user.id);
      void fetchMatches()
    } else {
      setLoading(false)
    }
  }, [user, fetchMatches])

  const deleteMatch = async (rideId: number) => {
    if (!user) {
      console.error('No authenticated user found')
      return
    }

    try {
      await postJson('/api/matches/cancel', { rideId })
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
