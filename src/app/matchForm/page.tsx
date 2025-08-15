'use client'

import RedirectButton from '@/components/buttons/RedirectButton'

//import TripToggle from '@/components/ToWhereToggle'
import SubmitSuccess from '@/components/questionnaires/SubmitSuccess'
import ManyBagsNotice from '@/components/questionnaires/ManyBagsNotice'
import TripToggle from '@/components/questionnaires/ToWhereToggle'
import { createBrowserClient } from '@/utils/supabase'
import { useState, useEffect } from 'react'
import { validateUserProfile } from '@/utils/profileValidation'
import Link from 'next/link'

export default function MatchForm() {
  const supabase = createBrowserClient()

  const [tripType, setTripType] = useState<boolean>(true)
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
  const [optInUnmatched, setOptInUnmatched] = useState(false)
  const [terminal, setTerminal] = useState('')
  const [message, setMessage] = useState('')

  // handling pop ups
  const [showManyBagsModal, setShowManyBagsModal] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<React.FormEvent | null>(
    null,
  ) // Flag to hold submission until confirmed

  const [isModalOpen, setIsModalOpen] = useState(false)
  useEffect(() => {
    setIsModalOpen(false)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate user has complete profile
    const profileValidation = await validateUserProfile()
    if (!profileValidation.isValid) {
      setMessage(`${profileValidation.message}`)
      return
    }

    if (!flight_no || !numBags || !earliestArrival || !latestArrival) {
      setMessage('Missing information!')
      return
    }

    if (numBags >= 4) {
      setPendingSubmit(e)
      setShowManyBagsModal(true)
      return
    }

    await actuallySubmitForm(e)
  }

  const actuallySubmitForm = async (e: React.FormEvent) => {
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

    const { error } = await supabase.from('Flights').insert([
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
        opt_in: optInUnmatched ? true : false,
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
    <div className="flex min-h-[calc(100vh-165px)] w-full flex-col bg-gray-100 p-8 text-black">
      <div className="flex w-full flex-col items-center justify-center bg-gray-100 text-black">
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

          {/* ✅ Opt-in checkbox */}
          <label className="mb-2 mt-4 block rounded bg-gray-100 p-3">
            <input
              type="checkbox"
              checked={optInUnmatched}
              onChange={(e) => setOptInUnmatched(e.target.checked)}
              className="mr-2"
            />
            Would you like to opt-in to the unmatched page if PICKUP is unable
            to match you through our algorithm? Please note that the unmatched
            page will display your name, email, and flight information.
          </label>

          <div className="mt-4 flex justify-between">
            <RedirectButton label="Cancel" route="/questionnaires" />
            <button
              type="submit"
              className="mt-4 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
              // onClick={handleSubmit}
              // type="button"
              // className="mt-4 rounded-lg bg-green-600 px-6 py-3 text-lg font-semibold text-white hover:bg-green-700"
            >
              Match
            </button>

            {/*Handle Bag Pop-up */}
            <ManyBagsNotice
              open={showManyBagsModal}
              onConfirm={() => {
                setShowManyBagsModal(false)
                if (pendingSubmit) {
                  actuallySubmitForm(pendingSubmit)
                  setPendingSubmit(null)
                }
              }}
              onCancel={() => {
                setShowManyBagsModal(false)
                setPendingSubmit(null)
              }}
            />
            {/* SubmitSuccess Modal */}
            <SubmitSuccess
              isOpen={isModalOpen}
              route="/questionnaires"
              onClose={() => setIsModalOpen(false)}
            />
          </div>

          {message && (
            <div className="mt-4 text-center">
              <p className="mb-2">{message}</p>
              {
                <Link
                  href="/profile"
                  className="inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                  Go to Profile
                </Link>
              }
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
