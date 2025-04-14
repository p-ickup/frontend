'use client'

import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import Link from 'next/link'
import { useEffect, useState } from 'react'

type Tables = Database['public']['Tables']
type Flight = Tables['Flights']['Row']
type User = Tables['Users']['Row'] & { email?: string }

interface FlightWithUser extends Flight {
  Users: User | null
}

export default function UnmatchedPage() {
  const supabase = createBrowserClient()
  const [flights, setFlights] = useState<FlightWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState('')
  const [selectedFlight, setSelectedFlight] = useState<FlightWithUser | null>(
    null,
  )
  const [showConfirmation, setShowConfirmation] = useState(false)

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

      const { data, error } = await supabase
        .from('Flights')
        .select(
          '*, Users:Users!Flights_user_id_fkey(firstname, lastname, email)',
        )
        .eq('opt_in', true)
        .neq('user_id', user.id)

      if (error) {
        console.error('Error fetching unmatched flights:', error)
        setError('Error fetching unmatched flights.')
        setLoading(false)
        return
      }

      setFlights(data || [])
      setLoading(false)
    }

    fetchData()
  }, [supabase])

  const sendMatchRequest = async () => {
    if (!selectedFlight) return

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
        receiver_id: selectedFlight.user_id,
        flight_id: selectedFlight.flight_id,
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
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      {/* 🔗 Incoming Requests Button */}
      <div className="mb-6 flex justify-end">
        <Link href="/MatchRequestsPage">
          <button className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700">
            View Incoming Match Requests
          </button>
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Unmatched Flights</h1>

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
                  <strong>Email:</strong>{' '}
                  {flight.Users?.email || 'Email unknown'}
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
                  className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  onClick={() => {
                    setSelectedFlight(flight)
                    setShowConfirmation(true)
                  }}
                >
                  Send Request
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmation Popup */}
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
                onClick={sendMatchRequest}
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
