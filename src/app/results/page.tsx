'use client'
import RedirectButton from '@/components/buttons/RedirectButton'
import EmptyState from '@/components/results/EmptyState'
import MatchCard from '@/components/results/MatchCard'
import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

type Tables = Database['public']['Tables']
type User = Tables['Users']['Row']
type Flight = Tables['Flights']['Row']
type Match = Tables['Matches']['Row']

export interface MatchWithDetails extends Match {
  Flights: Flight
  Users: User
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
  const [showPrevious, setShowPrevious] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserClient()

  useEffect(() => {
    void fetchMatches()
  }, [])

  const fetchMatches = async () => {
    try {
      // Get current authenticated user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()
      if (userError) throw userError
      if (!user) throw new Error('No user found')

      // Step 1: Find all ride IDs where the user has a match
      const { data: userRideIds, error: rideError } = await supabase
        .from('Matches')
        .select('ride_id')
        .eq('user_id', user.id)

      if (rideError) throw rideError
      if (!userRideIds || userRideIds.length === 0) {
        setMatches({ upcoming: {}, previous: {} })
        return
      }

      // Step 2: Get all matches for those rides with user and flight details
      const { data: allMatches, error: matchError } = await supabase
        .from('Matches')
        .select(
          `
        *,
        Flights (*),
        Users (*)
      `,
        )
        .in(
          'ride_id',
          userRideIds.map((r) => r.ride_id),
        )
      console.log('All matches:', allMatches)

      if (matchError) throw matchError
      if (!allMatches) throw new Error('No matches found')

      // Convert to MatchWithDetails array
      const matchesWithDetails: MatchWithDetails[] = allMatches.filter(
        (match) => match.user_id !== user.id,
      )

      // Group into upcoming and previous, and then by ride_id
      const now = new Date()
      const grouped = matchesWithDetails.reduce<GroupedMatches>(
        (acc, match) => {
          const matchDate = new Date(match.created_at)
          const rideId = match.ride_id

          // Determine if upcoming or previous
          const category = matchDate > now ? 'upcoming' : 'previous'

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
      setMatches(grouped)
      console.log('Grouped matches:', grouped)
    } catch (error) {
      console.error('Error details:', error)
      setMatches({ upcoming: {}, previous: {} })
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-50 font-sans text-black">
      {/* Header at the top */}

      <div className="mx-auto flex w-full max-w-5xl flex-col items-center p-6">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Your Matches</h1>

        {loading ? (
          <div className="flex items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <>
            {/* Upcoming Matches Section */}
            <div className="w-full max-w-3xl">
              <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-800">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-600"
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
                  // Group the upcoming matches by ride_id
                  const groupedUpcoming = groupMatchesByRideId(
                    Object.values(matches.upcoming).flat(),
                  )

                  // Render a MatchCard for each group of matches with the same ride_id
                  return Object.entries(groupedUpcoming).map(
                    ([rideId, matchesForRide]) => (
                      <MatchCard
                        key={rideId}
                        matches={matchesForRide}
                        upcoming={true}
                      />
                    ),
                  )
                })()
              ) : (
                <EmptyState type="upcoming" />
              )}
            </div>

            <RedirectButton label="View Unmatched Flights" route="/unmatched" />

            {/* Toggle Previous Matches Button */}
            <button
              onClick={() => setShowPrevious(!showPrevious)}
              className="mt-8 flex items-center gap-2 rounded-lg border border-gray-200 bg-white 
                px-4 py-2 font-medium shadow-sm transition-colors hover:bg-gray-100 active:bg-gray-200"
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

            {/* Previous Matches Section */}
            {showPrevious && (
              <div className="mt-6 w-full max-w-3xl">
                <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold text-gray-800">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5 text-gray-600"
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
                        />
                      ),
                    )
                  })()
                ) : (
                  <EmptyState type="previous" />
                )}
              </div>
            )}
          </>
        )}

        <RedirectButton label="Back to Home" route="/" />
      </div>
    </div>
  )
}
