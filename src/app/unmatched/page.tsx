'use client'

import type { Database } from '@/lib/database.types'
import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

type Tables = Database['public']['Tables']
type Flight = Tables['Flights']['Row']
type User = Tables['Users']['Row']

interface FlightWithUser extends Flight {
  Users: User | null // Make this optional just in case
}

export default function UnmatchedPage() {
  const supabase = createBrowserClient()
  const [flights, setFlights] = useState<FlightWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchUnmatched = async () => {
      const { data, error } = await supabase
        .from('Flights')
        .select(
          '*, Users:Users!Flights_user_id_fkey(firstname, lastname, phonenumber)',
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
  }, [])

  if (loading) return <div className="p-6">Loading...</div>
  if (error) return <div className="p-6 text-red-600">{error}</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6 text-black">
      <h1 className="mb-6 text-2xl font-bold">Unmatched Users</h1>
      {flights.length === 0 ? (
        <p>No unmatched flights found.</p>
      ) : (
        <ul className="space-y-4">
          {flights.map((flight) => {
            console.log('flight:', flight)

            return (
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
                <p>
                  <strong>Phone:</strong>{' '}
                  {flight.Users ? (
                    `${flight.Users.phonenumber}`
                  ) : (
                    <span className="italic text-red-500">no phone number</span>
                  )}
                </p>
                <p></p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
