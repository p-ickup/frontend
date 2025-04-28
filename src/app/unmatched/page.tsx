'use client'

import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

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
  const [pendingRequests, setPendingRequests] = useState<number[]>([])
  const [myFlights, setMyFlights] = useState<Flight[]>([])
  const [selectedMyFlightId, setSelectedMyFlightId] = useState<number | null>(
    null,
  )

  const fetchData = useCallback(async () => {
    setLoading(true)

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

    const { data: myFlightsData } = await supabase
      .from('Flights')
      .select('*')
      .eq('user_id', user.id)
      .eq('matched', false)
      .eq('opt_in', true)

    if (myFlightsData) {
      setMyFlights(myFlightsData)
      const hasUnmatchedOptInFlight = myFlightsData.length > 0
      setUserEligible(hasUnmatchedOptInFlight)
    }

    const { data: pendingMatchData } = await supabase
      .from('MatchRequests')
      .select('receiver_flight_id')
      .eq('sender_id', user.id)
      .eq('status', 'pending')

    if (pendingMatchData) {
      setPendingRequests(
        pendingMatchData.map(
          (req: { receiver_flight_id: number }) => req.receiver_flight_id,
        ),
      )
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
        'ride_id, flight_id, flight:Flights(flight_id, airport, earliest_time, latest_time, date, user_id, matched, to_airport, Users(firstname, lastname))',
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
      (group) => {
        return group.flights.length < 4
      },
    )

    setGroups(grouped)
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const sendMatchRequest = async (
    receiverId: string,
    receiverFlightId: number,
  ) => {
    if (selectedMyFlightId === null) {
      alert('Please select a flight before confirming.')
      return
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      alert('You must be logged in to send requests.')
      return
    }

    const { error } = await supabase.from('MatchRequests').insert([
      {
        sender_id: user.id,
        receiver_id: receiverId,
        sender_flight_id: selectedMyFlightId,
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

    // 🔥 Refresh page data immediately
    await fetchData()

    setShowConfirmation(false)
    setSelectedFlight(null)
    setSelectedGroup(null)
    setSelectedMyFlightId(null)
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

      <h1 className="mb-6 text-2xl font-bold">Groups Available to Join</h1>

      {groups.map((group) => {
        const firstFlight = group.flights[0]
        const direction = firstFlight?.to_airport
          ? `School → ${firstFlight.airport}`
          : `${firstFlight.airport} → School`

        const isPending = pendingRequests.includes(firstFlight.flight_id)
        const isUserInGroup = group.flights.some(
          (flight) => flight.user_id === userId,
        )

        return (
          <div key={group.ride_id} className="mb-6 rounded bg-white p-4 shadow">
            <h2 className="text-lg font-semibold">
              {direction} — {firstFlight?.date}
            </h2>
            <ul className="mt-2">
              {group.flights.map((flight, index) => (
                <li key={index} className="text-sm text-gray-800">
                  {flight.Users?.firstname} {flight.Users?.lastname} — (
                  {flight.earliest_time} - {flight.latest_time})
                </li>
              ))}
            </ul>
            <button
              className={`mt-3 rounded px-4 py-2 text-white ${
                userEligible && !isPending && !isUserInGroup
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'cursor-not-allowed bg-gray-300'
              }`}
              disabled={!userEligible || isPending || isUserInGroup}
              onClick={() => {
                if (userEligible && !isPending && !isUserInGroup) {
                  setSelectedGroup(group)
                  setShowConfirmation(true)
                }
              }}
            >
              {isUserInGroup
                ? 'Already in Group'
                : userEligible && !isPending
                  ? 'Request to Join'
                  : 'Request Pending'}
            </button>
          </div>
        )
      })}

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
                  <strong>Direction:</strong>{' '}
                  {flight.to_airport
                    ? `School → ${flight.airport}`
                    : `${flight.airport} → School`}
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
                  {userEligible
                    ? 'Send Request'
                    : 'All Your Flights Are Matched'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showConfirmation && (selectedFlight || selectedGroup) && (
        <ConfirmationModal
          title={
            selectedGroup
              ? `Send a match request to the group (via ${selectedGroup.flights[0].Users?.firstname} ${selectedGroup.flights[0].Users?.lastname})?`
              : selectedFlight
                ? `Send a match request to ${selectedFlight.Users ? `${selectedFlight.Users.firstname} ${selectedFlight.Users.lastname}` : 'this user'}?`
                : ''
          }
          onConfirm={() => {
            if (selectedGroup) {
              sendMatchRequest(
                selectedGroup.flights[0].user_id,
                selectedGroup.flights[0].flight_id,
              )
            } else if (selectedFlight) {
              sendMatchRequest(selectedFlight.user_id, selectedFlight.flight_id)
            }
          }}
          onCancel={() => {
            setShowConfirmation(false)
            setSelectedFlight(null)
            setSelectedGroup(null)
            setSelectedMyFlightId(null)
          }}
          myFlights={myFlights}
          selectedMyFlightId={selectedMyFlightId}
          setSelectedMyFlightId={setSelectedMyFlightId}
        />
      )}
    </div>
  )
}

function ConfirmationModal({
  title,
  onConfirm,
  onCancel,
  myFlights,
  selectedMyFlightId,
  setSelectedMyFlightId,
}: {
  title: string
  onConfirm: () => void
  onCancel: () => void
  myFlights: Flight[]
  selectedMyFlightId: number | null
  setSelectedMyFlightId: (id: number) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-[90%] max-w-md rounded bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>

        {/* Flight selection */}
        <div className="mb-4 space-y-2">
          {myFlights.map((flight) => (
            <label
              key={flight.flight_id}
              className="flex items-center space-x-2"
            >
              <input
                type="radio"
                name="selectedFlight"
                value={flight.flight_id}
                checked={selectedMyFlightId === flight.flight_id}
                onChange={() => setSelectedMyFlightId(flight.flight_id)}
              />
              <span className="text-sm">
                {flight.date} — {flight.airport} ({flight.earliest_time} -{' '}
                {flight.latest_time})
              </span>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            className="rounded border px-4 py-2 hover:bg-gray-100"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={onConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
