'use client'
import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import type { Database } from '@/lib/database.types'
import MatchCard from '@/components/results/MatchCard'
import EmptyState from '@/components/results/EmptyState'

const mockMatches: MatchWithDetails[] = [
  {
    ride_id: 101,
    created_at: '2023-11-30T14:20:00Z',
    user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    flight_id: 1001,
    Flights: {
      flight_id: 1001,
      created_at: '2023-10-15T09:00:00Z',
      user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      flight_no: 'AA123',
      bag_no: 2,
      max_price: 47,
      max_dropoff: 5,
      airport: 'LAX',
      earliest_time: '14:00',
      latest_time: '15:00',
      date: '2023-11-30',
      to_airport: false,
    },
    Users: {
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      created_at: '2023-12-15T14:45:00Z',
      firstname: 'Mike',
      phonenumber: '555-987-6543',
      lastname: 'Smith',
      school: 'Claremont McKenna',
      photo_url: '/images/profileIcon.webp',
      instagram: '@mikesmith',
    },
  },
  {
    ride_id: 103,
    created_at: '2025-05-14T13:30:00Z',
    user_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    flight_id: 1002,
    Flights: {
      flight_id: 1002,
      created_at: '2025-04-10T11:30:00Z',
      user_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      flight_no: 'DL456',
      bag_no: 1,
      max_price: 47,
      max_dropoff: 3,
      airport: 'LAX',
      earliest_time: '13:00',
      latest_time: '14:00',
      date: '2025-05-14',
      to_airport: true,
    },
    Users: {
      user_id: '6ba7b811-9dad-11d1-80b4-00c04fd430c8',
      created_at: '2024-02-10T16:20:00Z',
      firstname: 'Kellie',
      phonenumber: '555-444-5555',
      lastname: 'Chen',
      school: 'Scripps College',
      photo_url: '/images/profileIcon.webp',
      instagram: '@kellitravels',
    },
  },
  {
    ride_id: 103,
    created_at: '2025-05-14T13:30:00Z',
    user_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
    flight_id: 1002,
    Flights: {
      flight_id: 1002,
      created_at: '2025-04-10T11:30:00Z',
      user_id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8',
      flight_no: 'DL456',
      bag_no: 1,
      max_price: 47,
      max_dropoff: 3,
      airport: 'LAX',
      earliest_time: '13:00',
      latest_time: '14:00',
      date: '2025-05-14',
      to_airport: true,
    },
    Users: {
      user_id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      created_at: '2024-03-05T12:10:00Z',
      firstname: 'Yunju',
      phonenumber: '555-666-7777',
      lastname: 'Lee',
      school: 'Pitzer College',
      photo_url: '/images/profileIcon.webp',
      instagram: '@yunjulee',
    },
  },
  {
    ride_id: 106,
    created_at: '2025-01-19T21:45:00Z',
    user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    flight_id: 1003,
    Flights: {
      flight_id: 1003,
      created_at: '2024-12-20T16:00:00Z',
      user_id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      flight_no: 'UA789',
      bag_no: 3,
      max_price: 47,
      max_dropoff: 4,
      airport: 'LAX',
      earliest_time: '21:00',
      latest_time: '22:00',
      date: '2025-01-19',
      to_airport: true,
    },
    Users: {
      user_id: '6ba7b812-9dad-11d1-80b4-00c04fd430c8',
      created_at: '2024-03-05T12:10:00Z',
      firstname: 'Yunju',
      phonenumber: '555-666-7777',
      lastname: 'Lee',
      school: 'Pitzer College',
      photo_url: '/images/profileIcon.webp',
      instagram: '@yunjulee',
    },
  },
]

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
      <PickupHeader />

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

        <RedirectButton label="Back to Home" route="/home" />
      </div>
    </div>
  )
}
