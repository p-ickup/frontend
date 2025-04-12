'use client'

import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

type Tables = Database['public']['Tables']
type Flight = Tables['Flights']['Row']
type User = Tables['Users']['Row'] & { email?: string } // add email override

interface FlightWithUser extends Flight {
  Users: User | null
}

export default function UnmatchedPage() {
  const supabase = createBrowserClient()
  const [flights, setFlights] = useState<FlightWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  useEffect(() => {
    const fetchUnmatched = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setError('You must be logged in to view this page.')
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('Flights')
        .select(
          '*, Users:Users!Flights_user_id_fkey(firstname, lastname, email)',
        )
        .eq('matched', false)

      if (error) {
        console.log('Supabase full error object:', error)
        setError('Error fetching unmatched flights.')
        setLoading(false)
        return
      }

      setFlights(data || [])
      setLoading(false)
    }

    fetchUnmatched()
  }, [supabase])

  const handleSelfMatch = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) return

    const { error } = await supabase
      .from('Flights')
      .update({ matched: true })
      .eq('user_id', user.id)
      .eq('matched', false)

    if (error) {
      console.error('Error marking user as matched:', error)
    }

    setShowConfirmation(false)
  }

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      {/* I've been matched button */}
      <div className="mb-6 flex justify-end">
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={() => setShowConfirmation(true)}
        >
          I&apos;ve been matched
        </button>
      </div>

      <h1 className="mb-6 text-2xl font-bold">Unmatched Users</h1>

      {flights.length === 0 ? (
        <p>No unmatched flights found.</p>
      ) : (
        <ul className="space-y-4">
          {flights.map((flight) => (
            <li
              key={flight.flight_id}
              className="rounded-lg bg-white p-4 shadow"
            >
              <p>
                <strong>User:</strong>{' '}
                {flight.Users ? (
                  `${flight.Users.firstname} ${flight.Users.lastname}`
                ) : (
                  <span className="italic text-red-500">Unknown user</span>
                )}
              </p>

              <p>
                <strong>Email:</strong>{' '}
                {flight.Users ? (
                  `${flight.Users.email}`
                ) : (
                  <span className="italic text-red-500">Email unknown</span>
                )}
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
            </li>
          ))}
        </ul>
      )}

      {/* Confirmation popup */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-[90%] max-w-md rounded bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              I&apos;ve been matched
            </h2>
            <p className="mb-6">
              I have contacted another student and no longer need to be matched
              through P-ickup.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                className="rounded border px-4 py-2 hover:bg-gray-100"
                onClick={() => setShowConfirmation(false)}
              >
                Close
              </button>
              <button
                className="rounded bg-green-600 px-4 py-2 text-white hover:bg-green-700"
                onClick={handleSelfMatch}
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
