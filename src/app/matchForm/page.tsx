'use client'

import RedirectButton from '@/components/buttons/RedirectButton'
import SubmitSuccess from '@/components/questionnaires/SubmitSuccess'
import TripToggle from '@/components/questionnaires/ToWhereToggle'

import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'

export default function MatchForm() {
  const supabase = createBrowserClient()

  const [tripType, setTripType] = useState<boolean>(true) // true = "To Airport", false = "To School"
  const [airport, setAirport] = useState('')
  const [flight_no, setFlightNumber] = useState('')
  const [dateOfFlight, setDateOfFlight] = useState('')
  const [numBags, setNumBags] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  const [dropoff, setDropoff] = useState(0.5)
  const [budget, setBudget] = useState(50) // New budget default = 50. Can change later
  const [terminal, setTerminal] = useState('')
  const [message, setMessage] = useState('')

  // handling pop ups
  const [isBagModalOpen, setIsBagModalOpen] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  useEffect(() => {
    setIsModalOpen(false)
  }, [])

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

    if (numBags >= 4 && !isBagModalOpen) {
      setIsBagModalOpen(true)
      return // Stop here until user acknowledges the modal
    }

    console.log('Submitting flight data:', {
      user_id: user.id,
      to_airport: tripType ? 1 : 0, // Store as 1 (true) or 0 (false)
      airport,
      flight_no,
      dateOfFlight,
      numBags,
      earliestArrival,
      latestArrival,
      max_dropoff: dropoff,
      budget,
      terminal,
    })

    // Insert data into the Supabase 'Flights' table
    const { data, error } = await supabase.from('Flights').insert([
      {
        user_id: user.id,
        to_airport: tripType ? 1 : 0, // Store as 1 (true) or 0 (false)
        airport,
        flight_no,
        date: dateOfFlight,
        bag_no: numBags,
        earliest_time: earliestArrival, // Already in HH:mm format
        latest_time: latestArrival, // Already in HH:mm format
        max_dropoff: dropoff,
        max_price: budget,
        terminal,
      },
    ])

    if (error) {
      console.error('Error inserting flight data:', error)
      setMessage(`Error: ${error.message}`)
      return // Exit early if there's an error
    }

    // Success - Show success modal
    setIsModalOpen(true)
    setMessage('✅ Flight details submitted successfully!')
  }

  const continueSubmit = async () => {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setMessage('Error: You must be logged in to submit flight details!')
      return
    }

    const { data, error } = await supabase.from('Flights').insert([
      {
        user_id: user.id,
        to_airport: tripType ? 1 : 0,
        airport,
        flight_no,
        date: dateOfFlight,
        bag_no: numBags,
        earliest_time: earliestArrival,
        latest_time: latestArrival,
        max_dropoff: dropoff,
        max_price: budget,
        terminal,
      },
    ])

    if (error) {
      console.error('Error inserting flight data:', error)
      setMessage(`Error: ${error.message}`)
      return
    }

    setIsModalOpen(true)
    setMessage('✅ Flight details submitted successfully!')
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Flight Information</h1>
        <p className="mb-6">Enter your flight details below.</p>

        <form
          onSubmit={handleSubmit}
          className="w-96 rounded-lg bg-white p-6 shadow-md"
        >
          <h2>Select Trip Type</h2>
          <TripToggle onSelect={setTripType} />

          <label className="mb-2 block">
            Airport:
            <select
              value={airport}
              onChange={(e) => setAirport(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            >
              <option value="" disabled>
                Select your airport
              </option>
              <option value="LAX">LAX</option>
              <option value="ONT">ONT</option>
            </select>
          </label>

          <label className="mb-2 block">
            Terminal:
            <input
              type="text"
              value={terminal}
              onChange={(e) => setTerminal(e.target.value)}
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
            Furthest pickup/dropoff radius (from home school):{' '}
            <strong>{dropoff} mi</strong>
            <input
              type="range"
              min="0"
              max="1"
              step="0.25"
              value={dropoff}
              onChange={(e) => setDropoff(Number(e.target.value))}
              className="mt-1 w-full"
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

            {/*Handle Bag Pop-up */}
            {isBagModalOpen && (
              <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="rounded-lg bg-white p-6 text-center shadow-lg">
                  <h2 className="mb-4 text-xl font-bold">Heads up!</h2>
                  <p className="mb-4">
                    You have 4 or more bags. Make sure you are able to handle
                    this amount of luggage.
                  </p>
                  <button
                    onClick={() => {
                      setIsBagModalOpen(false)
                      continueSubmit() // Continue after closing the modal
                    }}
                    className="rounded bg-blue-500 px-4 py-2 text-white"
                  >
                    Okay, continue
                  </button>
                </div>
              </div>
            )}

            {/* SubmitSuccess Modal */}
            <SubmitSuccess
              isOpen={isModalOpen}
              route="/questionnaires"
              onClose={() => setIsModalOpen(false)}
            />
          </div>

          {message && <p className="mt-4 text-center">{message}</p>}
        </form>
      </div>
    </div>
  )
}
