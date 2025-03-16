'use client'
import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import type { Database } from '@/lib/database.types'

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

interface MatchWithDetails extends Match {
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

interface MatchCardProps {
  matches: MatchWithDetails[]
  upcoming: boolean
}

const getAirportAddress = (airport: string): string => {
  const airports: Record<string, string> = {
    LAX: 'World Way, Los Angeles, CA 90045',
    SNA: '18601 Airport Way, Santa Ana, CA 92707',
  }
  return airports[airport] || ''
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

// Simplified MatchCard component
const MatchCard = ({ matches, upcoming }: MatchCardProps) => {
  // Use the first match for common information
  const firstMatch = matches[0]

  return (
    <div className="mb-6 w-full max-w-3xl rounded-xl border border-gray-100 bg-white p-5 shadow-md transition-all hover:shadow-lg">
      <div className="flex justify-between">
        <div className="flex flex-col gap-3">
          <div>
            <p className="flex items-center gap-1 font-medium text-indigo-600">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {new Date(firstMatch.created_at).toLocaleDateString()},{' '}
              {firstMatch.Flights.airport}
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-800">
              You are matched with{' '}
              {matches.length === 1
                ? firstMatch.Users.firstname
                : `${matches.length} people`}
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-medium text-gray-800">
                {firstMatch.Flights.airport}
              </span>
              <span className="text-sm text-gray-500">
                {getAirportAddress(firstMatch.Flights.airport)}
              </span>
            </p>
            <p className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium text-gray-800">
                ${firstMatch.Flights.max_price}
              </span>
            </p>
          </div>

          {upcoming && (
            <button className="mt-1 flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              Set a Reminder
            </button>
          )}
        </div>

        {/* Right side with contact info and profile pictures */}
        <div className="flex flex-col items-end gap-3">
          <p className="text-sm font-medium text-indigo-600">
            Other Riders Contact Information
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            {matches.map((match) => (
              <div
                key={match.Users.user_id}
                className="relative flex flex-col items-center gap-1 rounded-xl p-1 transition-all duration-300 hover:scale-105 hover:cursor-pointer hover:shadow-md hover:shadow-gray-600"
              >
                <p className="text-center text-sm font-medium text-gray-700">
                  {match.Users.firstname}
                </p>
                <div className="relative overflow-hidden rounded-full">
                  <Image
                    src={match.Users.photo_url || '/images/profileIcon.webp'}
                    alt={`${match.Users.firstname}'s profile`}
                    width={60}
                    height={60}
                    className="rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
          {upcoming && (
            <button
              className="mt-3 flex items-center gap-1 rounded-lg border border-red-200 bg-white 
            px-4 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 active:bg-red-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancel Match
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const EmptyState = ({ type }: { type: 'upcoming' | 'previous' }) => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-3">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
          />
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No {type} matches found
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        {type === 'upcoming'
          ? "You don't have any upcoming matches. Create a new match to get started!"
          : "You haven't completed any rides yet."}
      </p>
      {type === 'upcoming' && (
        <RedirectButton label="Find a Match" route="/questionnaires" />
      )}
    </div>
  )
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
      console.log('Supabase client:', !!supabase)
      const { data: matches, error } = await supabase
        .from('Matches')
        .select('*')
      console.log('Read result:', { matches, error })

      if (!matches) {
        setMatches({ upcoming: {}, previous: {} })
        return
      }

      // Group into upcoming and previous, and then by ride_id
      const now = new Date()
      const grouped = mockMatches.reduce<GroupedMatches>(
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
