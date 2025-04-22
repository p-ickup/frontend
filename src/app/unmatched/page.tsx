'use client'

import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Tables = Database['public']['Tables']
type Flight = Tables['Flights']['Row']
type User = Tables['Users']['Row']

interface FlightWithUser extends Flight {
  Users: User | null
}

interface GroupedMatch {
  ride_id: number
  flights: FlightWithUser[]
}

export default function UnmatchedPage() {
  const supabase = createBrowserClient()
  const [flights, setFlights] = useState<FlightWithUser[]>([])
  const [groups, setGroups] = useState<GroupedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedFlight, setSelectedFlight] = useState<FlightWithUser | null>(
    null,
  )
  const [selectedGroup, setSelectedGroup] = useState<GroupedMatch | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [userEligible, setUserEligible] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('You must be logged in to view this page.')
        setLoading(false)
        return
      }

      setUserId(user.id)

      const { data: myStatus, error: myStatusError } = await supabase
        .from('Flights')
        .select('matched, opt_in')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (
        !myStatusError &&
        myStatus?.matched === false &&
        myStatus?.opt_in === true
      ) {
        setUserEligible(true)
      }

      const { data: flightData, error: flightError } = await supabase
        .from('Flights')
        .select('*, Users:Users!Flights_user_id_fkey(firstname, lastname)')
        .eq('opt_in', true)
        .eq('matched', false)
        .neq('user_id', user.id)

      const { data: matchData, error: matchError } = await supabase
        .from('Matches')
        .select(
          'ride_id, flight_id, flight:Flights(*, Users(firstname, lastname))',
        )

      if (flightError || matchError) {
        console.error('Error fetching data:', flightError || matchError)
        setError('Error fetching flight or match data.')
        setLoading(false)
        return
      }

      setFlights(flightData || [])

      const reduced = (matchData as any[]).reduce(
        (acc, match) => {
          const rideId = match.ride_id
          if (!acc[rideId]) acc[rideId] = { ride_id: rideId, flights: [] }
          if (match.flight && Array.isArray(match.flight)) {
            acc[rideId].flights.push(...match.flight)
          } else if (match.flight) {
            acc[rideId].flights.push(match.flight)
          }
          return acc
        },
        {} as Record<number, GroupedMatch>,
      )

      const grouped = (Object.values(reduced) as GroupedMatch[]).filter(
        (group) => group.flights.length < 4,
      )

      setGroups(grouped)
      setLoading(false)
    }

    fetchData()
  }, [supabase])

  const sendMatchRequest = async (
    receiverId: string,
    receiverFlightId: number,
  ) => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      alert('You must be logged in to send requests.')
      return
    }

    const { data: myFlight, error: myFlightError } = await supabase
      .from('Flights')
      .select('flight_id')
      .eq('user_id', user.id)
      .eq('matched', false)
      .limit(1)
      .single()

    if (myFlightError || !myFlight) {
      alert('Could not find your unmatched flight.')
      return
    }

    const { error } = await supabase.from('MatchRequests').insert([
      {
        sender_id: user.id,
        receiver_id: receiverId,
        sender_flight_id: myFlight.flight_id,
        receiver_flight_id: receiverFlightId,
        status: 'pending',
      },
    ])

    if (error) {
      console.error('Failed to send match request:', error.message)
      alert('Failed to send request.')
    } else {
      alert('Match request sent!')
    }

    setShowConfirmation(false)
    setSelectedFlight(null)
    setSelectedGroup(null)
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <div className="mb-6 flex justify-end">
        <Link href="/MatchRequestsPage">
          <button className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
            View Incoming Match Requests
          </button>
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">
        Match Groups (Under 4 Members)
      </h1>

      {groups.map((group) => (
        <div key={group.ride_id} className="mb-6 rounded bg-white p-4 shadow">
          <h2 className="text-lg font-semibold">
            Group Ride ID: {group.ride_id}
          </h2>
          <ul className="mt-2">
            {group.flights.map((flight, index) => (
              <li key={index} className="text-sm text-gray-800">
                {flight.Users?.firstname} {flight.Users?.lastname} —{' '}
                {flight.airport} on {flight.date} ({flight.earliest_time} -{' '}
                {flight.latest_time})
              </li>
            ))}
          </ul>
          <button
            className={`mt-3 rounded px-4 py-2 text-white ${userEligible ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'}`}
            disabled={!userEligible}
            onClick={() => {
              if (userEligible) {
                setSelectedGroup(group)
                setShowConfirmation(true)
              }
            }}
          >
            {userEligible ? 'Request to Join' : 'Already Matched'}
          </button>
        </div>
      ))}

      <h1 className="mb-6 mt-10 text-2xl font-bold">Unmatched Flights</h1>

      {flights.length === 0 ? (
        <p>No unmatched flights found.</p>
      ) : (
        <ul className="space-y-4">
          {flights.map((flight) => (
            <li
              key={flight.flight_id}
              className="flex items-start justify-between rounded-lg bg-white p-4 shadow"
            >
              <div className="flex-1">
                <p>
                  <strong>User:</strong>{' '}
                  {flight.Users
                    ? `${flight.Users.firstname} ${flight.Users.lastname}`
                    : 'Unknown user'}
                </p>
                <p>
                  <strong>Flight Date:</strong> {flight.date}
                </p>
                <p>
                  <strong>Earliest Time:</strong> {flight.earliest_time}
                </p>
                <p>
                  <strong>Latest Time:</strong> {flight.latest_time}
                </p>
                <p>
                  <strong>Airport:</strong> {flight.airport}
                </p>
              </div>

              <div className="ml-4 mt-2 shrink-0">
                <button
                  className={`rounded px-4 py-2 text-white ${userEligible ? 'bg-blue-600 hover:bg-blue-700' : 'cursor-not-allowed bg-gray-300'}`}
                  disabled={!userEligible}
                  onClick={() => {
                    if (userEligible) {
                      setSelectedFlight(flight)
                      setShowConfirmation(true)
                    }
                  }}
                >
                  {userEligible ? 'Send Request' : 'Already Matched'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showConfirmation && selectedFlight && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[90%] max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              Send a match request to{' '}
              {selectedFlight.Users
                ? `${selectedFlight.Users.firstname} ${selectedFlight.Users.lastname}`
                : 'this user'}
            </h2>
            <p className="mb-6">
              Are you sure you want to send a request to ride with{' '}
              {selectedFlight.Users
                ? `${selectedFlight.Users.firstname} ${selectedFlight.Users.lastname}`
                : 'this user'}
              ?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                className="rounded border px-4 py-2 hover:bg-gray-100"
                onClick={() => {
                  setShowConfirmation(false)
                  setSelectedFlight(null)
                }}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={() =>
                  sendMatchRequest(
                    selectedFlight.user_id,
                    selectedFlight.flight_id,
                  )
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmation && selectedGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[90%] max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              Send a match request to the group (via{' '}
              {selectedGroup.flights[0].Users?.firstname}{' '}
              {selectedGroup.flights[0].Users?.lastname})?
            </h2>
            <div className="flex justify-end space-x-3">
              <button
                className="rounded border px-4 py-2 hover:bg-gray-100"
                onClick={() => {
                  setShowConfirmation(false)
                  setSelectedGroup(null)
                }}
              >
                Cancel
              </button>
              <button
                className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                onClick={() =>
                  sendMatchRequest(
                    selectedGroup.flights[0].user_id,
                    selectedGroup.flights[0].flight_id,
                  )
                }
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
