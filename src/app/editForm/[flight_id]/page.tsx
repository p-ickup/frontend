'use client'

import RedirectButton from '@/components/buttons/RedirectButton'
// import TripToggle from '@/components/ToWhereToggle'
import { createBrowserClient } from '@/utils/supabase'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import TripToggle from '@/components/questionnaires/ToWhereToggle'
import SubmitSuccess from '@/components/questionnaires/SubmitSuccess'

export default function EditForm() {
  const pathname = usePathname()
  const flight_id = pathname.split('/').pop()

  const supabase = createBrowserClient()
  const [tripType, setTripType] = useState<boolean>(true) // true = "To Airport", false = "To School"
  const [airport, setAirport] = useState('')
  const [flight_no, setFlightNumber] = useState('')
  const [dateOfFlight, setDateOfFlight] = useState('')
  const [numBags, setNumBags] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  const [dropoff, setDropoff] = useState(0.5)
  const [budget, setBudget] = useState(50)
  const [optInUnmatched, setOptInUnmatched] = useState(false)
  const [message, setMessage] = useState('')

  const handleTripSelect = (type: boolean) => {
    setTripType(type)
  }
  const [terminal, setTerminal] = useState('')

  // handling pop up
  const [isModalOpen, setIsModalOpen] = useState(false)
  useEffect(() => {
    setIsModalOpen(false)
  }, [])

  useEffect(() => {
    if (!flight_id) return

    const fetchFlightData = async () => {
      const { data, error } = await supabase
        .from('Flights')
        .select('*')
        .eq('flight_id', flight_id)
        .single()

      if (error) {
        setMessage(`Error fetching flight data: ${error.message}`)
      } else {
        setTripType(data.to_airport)
        setAirport(data.airport)
        setFlightNumber(data.flight_no)
        setDateOfFlight(data.date)
        setNumBags(data.bag_no)
        setEarliestArrival(data.earliest_time)
        setLatestArrival(data.latest_time)
        setDropoff(data.max_dropoff)
        setBudget(data.max_price)
        setOptInUnmatched(!data.matched) // ✅ reflect checkbox state
        setTerminal(data.terminal)
      }
    }

    fetchFlightData()
  }, [flight_id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const { data: user, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      setMessage('Error: You must be logged in to submit flight details!')
      return
    }

    const { error } = await supabase
      .from('Flights')
      .update({
        to_airport: tripType,
        airport,
        flight_no,
        date: dateOfFlight,
        bag_no: numBags,
        earliest_time: earliestArrival,
        latest_time: latestArrival,
        max_dropoff: dropoff,
        max_price: budget,
        matched: optInUnmatched ? false : true, // ✅ update matched field
        terminal,
      })
      .eq('flight_id', flight_id)

    if (error) {
      console.error('Error inserting flight data:', error)
      setMessage(`Error: ${error.message}`)
      return // Exit early if there's an error
    }

    // Success - Show success modal
    setIsModalOpen(true)
    setMessage('✅ Flight details updated successfully!')
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Edit Flight Information</h1>
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
              type="time"
              value={earliestArrival}
              onChange={(e) => setEarliestArrival(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            />
          </label>

          <label className="mb-2 block">
            Latest Arrival Time (PST):
            <input
              type="time"
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

          {/* ✅ Opt-in Checkbox */}
          <label className="mb-2 mt-4 block rounded bg-gray-100 p-3">
            <input
              type="checkbox"
              checked={optInUnmatched}
              onChange={(e) => setOptInUnmatched(e.target.checked)}
              className="mr-2"
            />
            Would you like to opt-in to the unmatched page if P-ickup is unable
            to match you through our algorithm?
          </label>

          <div className="mt-4 flex justify-between">
            <RedirectButton label="Cancel" route="/questionnaires" />
            <button
              type="submit"
              className="mt-4 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
            >
              Update Flight Info
            </button>

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
