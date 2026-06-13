'use client'

import RedirectButton from '@/components/buttons/RedirectButton'
import { postJson, requestJson } from '@/utils/api'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import EmptyState from '@/components/results/EmptyState'
import type {
  OwnUnmatchedFlightDto,
  UnmatchedFlightDto,
  UnmatchedGroupDto,
  UnmatchedOptionsResponseDto,
} from '@/contracts/readModels'
import { useUnmatchedInitialData } from '@/providers/InitialPageDataProvider'

const matchRequestsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_MATCH_REQUESTS === 'true'

export default function UnmatchedPage() {
  const initialData = useUnmatchedInitialData()
  const initialDataRef = useRef(initialData)
  const { user, isAuthenticated, isLoading: authLoading } = useAuth()
  const [flights, setFlights] = useState<UnmatchedFlightDto[]>([])
  const [groups, setGroups] = useState<UnmatchedGroupDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedFlight, setSelectedFlight] =
    useState<UnmatchedFlightDto | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [userEligible, setUserEligible] = useState(false)
  const [myFlights, setMyFlights] = useState<OwnUnmatchedFlightDto[]>([])
  const [selectedMyFlightId, setSelectedMyFlightId] = useState<number | null>(
    null,
  )
  const [showGroups, setShowGroups] = useState(false)
  const [showIndividuals, setShowIndividuals] = useState(false)

  // Function to convert military time to 12-hour format
  const formatTime = (militaryTime: string | null | undefined) => {
    if (!militaryTime) return 'N/A'

    const [hours, minutes] = militaryTime.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours

    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  const fetchData = useCallback(async () => {
    setLoading(true)

    if (!user) {
      setLoading(false)
      return
    }

    try {
      const result =
        initialDataRef.current ??
        (await requestJson<UnmatchedOptionsResponseDto>(
          '/api/unmatched/options',
        ))
      initialDataRef.current = null

      setFlights(result.flights)
      setGroups(result.groups)
      setMyFlights(result.myFlights)
      setUserEligible(result.userEligible)
      setLoading(false)
      return
    } catch (fetchError) {
      console.error('Error fetching data:', fetchError)
      setError('Error fetching flight or match data.')
      setLoading(false)
      return
    }
  }, [user])

  useEffect(() => {
    if (user) {
      void fetchData()
    } else {
      setLoading(false)
    }
  }, [user, fetchData])

  const sendMatchRequest = async (
    receiverId: string,
    receiverFlightId: number,
  ) => {
    if (selectedMyFlightId === null) {
      alert('Please select a flight before confirming.')
      return
    }

    if (!user) {
      alert('You must be logged in to send requests.')
      return
    }

    try {
      await postJson('/api/match-requests/send', {
        receiverId,
        senderFlightId: selectedMyFlightId,
        receiverFlightId,
      })
    } catch (error) {
      console.error('Failed to send match request:', error)
      alert('Failed to send request.')
      return
    }

    alert('Match request sent!')

    // 🔥 Refresh page data immediately
    await fetchData()

    setShowConfirmation(false)
    setSelectedFlight(null)
    setSelectedMyFlightId(null)
  }

  // Show loading state while checking authentication
  if (authLoading) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="flex items-center space-x-4 rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
            <span className="text-lg font-medium text-gray-700">
              Loading...
            </span>
          </div>
        </div>
      </div>
    )
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="mb-6 text-4xl font-bold text-gray-900">
              Unmatched Flights
            </h1>
            <p className="mb-8 text-xl text-gray-600">
              Sign in to find other travelers who need rides
            </p>
            <div className="rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
              <EmptyState type="login" />
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
              Loading Unmatched Flights...
            </span>
          </div>
        </div>
      </div>
    )
  if (error)
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <p className="font-medium text-red-600">{error}</p>
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
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
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
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <div>
                  <h1 className="text-4xl font-bold text-gray-900">
                    Unmatched Flights
                  </h1>
                  <p className="text-xl text-gray-600">
                    Find other travelers who need rides
                  </p>
                </div>
              </div>
              <RedirectButton
                label="View Incoming Requests"
                route="/MatchRequestsPage"
                color="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                size="px-6 py-3 text-lg font-medium"
              />
            </div>
          </div>
        </div>
        {/* Content Section */}
        <div className="relative flex-1 px-6 pb-8">
          <div className="mx-auto max-w-6xl">
            {/* Non-Subsidized Groups Section */}
            {groups.length > 0 && (
              <div className="mb-8">
                <button
                  onClick={() => setShowGroups(!showGroups)}
                  className="mb-4 flex w-full items-center justify-between rounded-xl bg-white/80 p-4 shadow-lg transition-all hover:shadow-xl"
                >
                  <div className="text-left">
                    <h2 className="text-left text-2xl font-bold text-gray-900">
                      Groups Looking for Riders ({groups.length})
                    </h2>
                    <p className="text-left text-sm text-gray-600">
                      These groups have been matched but need more people to
                      split costs (not ASPC subsidized)
                    </p>
                  </div>
                  <svg
                    className={`h-6 w-6 text-gray-600 transition-transform ${showGroups ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showGroups && (
                  <div className="space-y-4">
                    {groups.map((group) => {
                      const firstFlight = group.flights[0]
                      const direction = firstFlight?.to_airport
                        ? `School → ${firstFlight.airport}`
                        : `${firstFlight.airport} → School`

                      return (
                        <div
                          key={group.ride_id}
                          className="group relative rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-purple-100 to-purple-200">
                                  <svg
                                    className="h-5 w-5 text-purple-600"
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
                                <div>
                                  <h3 className="text-xl font-bold text-gray-900">
                                    {direction}
                                  </h3>
                                  <p className="text-gray-600">
                                    {firstFlight?.date}
                                  </p>
                                  {group.time && (
                                    <p className="text-sm font-medium text-purple-600">
                                      Ride Time: {formatTime(group.time)}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <h4 className="font-semibold text-gray-800">
                                  Current Members ({group.flights.length}):
                                </h4>
                                <ul className="space-y-1">
                                  {group.flights.map((flight, index) => (
                                    <li
                                      key={index}
                                      className="flex items-center gap-2 text-sm text-gray-700"
                                    >
                                      <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                                      {flight.opt_in ? (
                                        <>
                                          <span className="font-medium">
                                            {flight.Users?.firstname}{' '}
                                            {flight.Users?.lastname}
                                          </span>
                                          {flight.Users?.email && (
                                            <span className="text-gray-500">
                                              ({flight.Users.email})
                                            </span>
                                          )}
                                          <span className="text-gray-500">
                                            — Available:{' '}
                                            {formatTime(flight.earliest_time)} -{' '}
                                            {formatTime(flight.latest_time)}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="italic text-gray-500">
                                          Anonymous Rider
                                        </span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                <p className="mt-3 text-sm italic text-gray-600">
                                  💡 Contact members directly to coordinate
                                  joining this ride
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Individual Flights Section */}
            <div className="mb-8">
              <button
                onClick={() => setShowIndividuals(!showIndividuals)}
                className="mb-4 flex w-full items-center justify-between rounded-xl bg-white/80 p-4 shadow-lg transition-all hover:shadow-xl"
              >
                <div className="text-left">
                  <h2 className="text-left text-2xl font-bold text-gray-900">
                    Individual Travelers ({flights.length})
                  </h2>
                  <p className="text-left text-sm text-gray-600">
                    Individuals with upcoming flights looking for ride shares
                  </p>
                </div>
                <svg
                  className={`h-6 w-6 text-gray-600 transition-transform ${showIndividuals ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {showIndividuals &&
                (flights.length === 0 ? (
                  <div className="rounded-2xl bg-white/80 p-8 text-center shadow-lg backdrop-blur-sm">
                    <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                      <svg
                        className="h-8 w-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                      </svg>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-gray-800">
                      No Individual Flights
                    </h3>
                    <p className="text-gray-600">
                      All available flights are already in groups
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {flights.map((flight) => (
                      <div
                        key={flight.flight_id}
                        className="group relative rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-4 flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-orange-100 to-orange-200">
                                <svg
                                  className="h-5 w-5 text-orange-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-gray-900">
                                  {flight.to_airport
                                    ? `School → ${flight.airport}`
                                    : `${flight.airport} → School`}
                                </h3>
                                <p className="text-gray-600">{flight.date}</p>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <h4 className="font-semibold text-gray-800">
                                Traveler:
                              </h4>
                              <ul className="space-y-1">
                                <li className="flex items-center gap-2 text-sm text-gray-700">
                                  <div className="h-2 w-2 rounded-full bg-orange-500"></div>
                                  <span className="font-medium">
                                    {flight.Users
                                      ? `${flight.Users.firstname} ${flight.Users.lastname}`
                                      : 'Unknown user'}
                                  </span>
                                  {flight.Users?.email && (
                                    <span className="text-gray-500">
                                      ({flight.Users.email})
                                    </span>
                                  )}
                                  <span className="text-gray-500">
                                    — Available:{' '}
                                    {formatTime(flight.earliest_time)} -{' '}
                                    {formatTime(flight.latest_time)}
                                  </span>
                                </li>
                              </ul>
                              <p className="mt-3 text-sm italic text-gray-600">
                                💡 Contact directly to coordinate ride sharing
                              </p>
                            </div>
                          </div>
                          {matchRequestsEnabled && (
                            <div className="ml-4">
                              <button
                                className={`rounded-xl px-6 py-3 font-semibold text-white transition-all duration-200 ${
                                  userEligible
                                    ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:scale-105 hover:from-orange-600 hover:to-orange-700'
                                    : 'cursor-not-allowed bg-gray-300'
                                }`}
                                disabled={!userEligible}
                                onClick={() => {
                                  setSelectedFlight(flight)
                                  setShowConfirmation(true)
                                }}
                              >
                                {userEligible
                                  ? 'Send Request'
                                  : 'All Your Flights Are Matched'}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          </div>{' '}
          {/* end max-w-6xl */}
        </div>{' '}
        {/* end relative flex-1 */}
      </div>{' '}
      {/* end outer container */}
      {matchRequestsEnabled && showConfirmation && selectedFlight && (
        <ConfirmationModal
          title={`Send a match request to ${selectedFlight.Users ? `${selectedFlight.Users.firstname} ${selectedFlight.Users.lastname}` : 'this user'}? Choose one of your flights.`}
          onConfirm={() => {
            if (!selectedFlight.user_id) {
              alert('Could not determine the rider for this flight.')
              return
            }
            sendMatchRequest(selectedFlight.user_id, selectedFlight.flight_id)
          }}
          onCancel={() => {
            setShowConfirmation(false)
            setSelectedFlight(null)
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
  myFlights: OwnUnmatchedFlightDto[]
  selectedMyFlightId: number | null
  setSelectedMyFlightId: (id: number) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        </div>

        {/* Flight selection */}
        <div className="mb-6 space-y-3">
          <h3 className="font-semibold text-gray-700">Select your flight:</h3>
          {myFlights.map((flight) => (
            <label
              key={flight.flight_id}
              className="flex cursor-pointer items-center space-x-3 rounded-xl border border-gray-200 p-3 transition-all duration-200 hover:bg-gray-50"
            >
              <input
                type="radio"
                name="selectedFlight"
                value={flight.flight_id}
                checked={selectedMyFlightId === flight.flight_id}
                onChange={() => setSelectedMyFlightId(flight.flight_id)}
                className="h-4 w-4 text-teal-600 focus:ring-teal-500"
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{flight.date}</div>
                <div className="text-sm text-gray-600">
                  {flight.airport} ({flight.earliest_time} -{' '}
                  {flight.latest_time})
                </div>
              </div>
            </label>
          ))}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            className="rounded-xl border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:scale-105 hover:from-teal-600 hover:to-teal-700"
            onClick={onConfirm}
          >
            Send Request
          </button>
        </div>
      </div>
    </div>
  )
}
