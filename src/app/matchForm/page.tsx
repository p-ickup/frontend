'use client'

import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

export default function MatchForm() {
  const supabase = createBrowserClient()

  const [airport, setAirport] = useState('')
  const [flight_no, setFlightNumber] = useState('')
  const [dateOfFlight, setDateOfFlight] = useState('')
  const [numBags, setNumBags] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  const [budget, setBudget] = useState(50) // New budget default = 50. Can change later
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setMessage('Error: You must be logged in to submit flight details!')
      return
    }

    if (!flight_no || !numBags || !earliestArrival || !latestArrival) {
      setMessage('Missing information!')
      return
    }

    console.log('Submitting flight data:', {
      user_id: user.id,
      airport,
      flight_no,
      dateOfFlight,
      numBags,
      earliestArrival,
      latestArrival,
      budget,
    })

    // Insert data into the Supabase 'Flights' table
    const { data, error } = await supabase.from('Flights').insert([
      {
        user_id: user.id,
        airport,
        flight_no,
        date: dateOfFlight,
        bag_no: numBags,
        earliest_time: earliestArrival, // Already in HH:mm format
        latest_time: latestArrival, // Already in HH:mm format
        max_price: budget,
      },
    ])

    if (error) {
      console.error('Error inserting flight data:', error)
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('✅ Flight details submitted successfully!')
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <PickupHeader />

      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Flight Information</h1>
        <p className="mb-6">Enter your flight details below.</p>

        <form
          onSubmit={handleSubmit}
          className="w-96 rounded-lg bg-white p-6 shadow-md"
        >
          <label className="mb-2 block">
            Airport:
            <input
              type="text"
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Flight Number:
            <input
              type="text"
              value={flight_no}
              onChange={(e) => setFlightNumber(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Date of Flight:
            <input
              type="date"
              value={dateOfFlight}
              onChange={(e) => setDateOfFlight(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Number of Bags:
            <input
              type="number"
              value={numBags}
              onChange={(e) => setNumBags(Number(e.target.value))}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Earliest Arrival Time (PST):
            <input
              type="time" // Only allows hour:minute input
              value={earliestArrival}
              onChange={(e) => setEarliestArrival(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Latest Arrival Time (PST):
            <input
              type="time" // Only allows hour:minute input
              value={latestArrival}
              onChange={(e) => setLatestArrival(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Budget: <strong>${budget}</strong>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-1 w-full"
            />
          </label>

          <div className="mt-4 flex justify-between">
            <RedirectButton label="Cancel" route="/questionnaires" />
            <button
              onClick={handleSubmit}
              type="button"
              className="mt-4 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
            >
              Match
            </button>
          </div>

          {message && <p className="mt-4 text-center">{message}</p>}
        </form>
      </div>
    </div>
  )
}
