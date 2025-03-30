'use client' // Ensure this is at the top

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { createBrowserClient } from '@/utils/supabase'
import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import TripToggle from '@/components/ToWhereToggle'

export default function EditForm() {
  const pathname = usePathname()
  const flight_id = pathname.split('/').pop() // Extract ID from URL

  const [tripType, setTripType] = useState<boolean>(true) // true = "To Airport", false = "To School"
  const handleTripSelect = (type: boolean) => {
    setTripType(type)
  }
  const [airport, setAirport] = useState('')
  const [flight_no, setFlightNumber] = useState('')
  const [dateOfFlight, setDateOfFlight] = useState('')
  const [numBags, setNumBags] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  const [dropoff, setDropoff] = useState(0.5)
  const [budget, setBudget] = useState(50)
  const [message, setMessage] = useState('')

  const supabase = createBrowserClient()

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
      })
      .eq('flight_id', flight_id)

    if (error) {
      setMessage(`Error updating flight data: ${error.message}`)
    } else {
      setMessage('✅ Flight details updated successfully!')
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <PickupHeader />
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Edit Flight Information</h1>
        <form
          onSubmit={handleSubmit}
          className="w-96 rounded-lg bg-white p-6 shadow-md"
        >
          <h2>Select Trip Type</h2>
          <TripToggle onSelect={handleTripSelect} />
          <p className="mt-2">
            Selected: {tripType ? 'To Airport' : 'To School'}
          </p>

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

          <div className="mt-4 flex justify-between">
            <RedirectButton label="Cancel" route="/questionnaires" />
            <button
              onClick={handleSubmit}
              type="submit"
              className="mt-4 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
            >
              Update Flight Info
            </button>
          </div>

          {message && <p className="mt-4 text-center">{message}</p>}
        </form>
      </div>
    </div>
  )
}
