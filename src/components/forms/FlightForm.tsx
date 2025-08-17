'use client'

import { useState, useEffect } from 'react'
import RedirectButton from '@/components/buttons/RedirectButton'
import SubmitSuccess from '@/components/questionnaires/SubmitSuccess'
import ManyBagsNotice from '@/components/questionnaires/ManyBagsNotice'
import TripToggle from '@/components/questionnaires/ToWhereToggle'
import { createBrowserClient } from '@/utils/supabase'
import { validateUserProfile } from '@/utils/profileValidation'
import {
  validateAirlineCode,
  validateFlightNumber,
} from '@/utils/flightValidation'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useClickTooltip,
} from '@/components/ui/tooltip'

export interface FlightFormProps {
  mode: 'create' | 'edit'
  flightId?: string // Required for edit mode
  title: string
  submitButtonText: string
  successMessage: string
  successRedirectRoute: string
  onSuccess?: () => void
}

export interface FlightData {
  tripType: boolean
  airport: string
  airline_iata: string
  flight_no: string
  dateOfFlight: string
  numSmallBags: number
  numLargeBags: number
  earliestArrival: string
  latestArrival: string
  dropoff: number
  budget: number
  optInUnmatched: boolean
  terminal: string
}

export default function FlightForm({
  mode,
  flightId,
  title,
  submitButtonText,
  successMessage,
  successRedirectRoute,
  onSuccess,
}: FlightFormProps) {
  const supabase = createBrowserClient()

  // Form state
  const [tripType, setTripType] = useState<boolean>(true)
  const [airport, setAirport] = useState('')
  const [flight_no, setFlightNumber] = useState('')
  const [airline_iata, setAirlineIata] = useState('')
  const [flightValidationError, setFlightValidationError] = useState('')
  const [dateOfFlight, setDateOfFlight] = useState('')
  const [numSmallBags, setNumSmallBags] = useState(0)
  const [numLargeBags, setNumLargeBags] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  const [dropoff, setDropoff] = useState(0.5)
  const [budget, setBudget] = useState(50)
  const [optInUnmatched, setOptInUnmatched] = useState(false)
  const [terminal, setTerminal] = useState('')
  const [message, setMessage] = useState('')
  const [isProfileComplete, setIsProfileComplete] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Click tooltip hooks
  const smallBagsTooltip = useClickTooltip()
  const largeBagsTooltip = useClickTooltip()

  // Modal states
  const [showManyBagsModal, setShowManyBagsModal] = useState(false)
  const [pendingSubmit, setPendingSubmit] = useState<React.FormEvent | null>(
    null,
  )
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    setIsModalOpen(false)
  }, [])

  // Check profile completeness on component mount
  useEffect(() => {
    const checkProfileStatus = async () => {
      const profileValidation = await validateUserProfile()
      setIsProfileComplete(profileValidation.isValid)
    }
    checkProfileStatus()
  }, [])

  // Load existing flight data for edit mode
  useEffect(() => {
    if (mode === 'edit' && flightId) {
      setIsLoading(true)
      const fetchFlightData = async () => {
        const { data, error } = await supabase
          .from('Flights')
          .select(
            'flight_id, flight_no, airline_iata, date, matched, to_airport, airport, bag_no, bag_no_large, earliest_time, latest_time, max_dropoff, max_price, terminal',
          )
          .eq('flight_id', flightId)
          .single()

        if (error) {
          setMessage(`Error fetching flight data: ${error.message}`)
        } else {
          console.log('Debug - Fetched flight data:', data)
          setTripType(data.to_airport)
          setAirport(data.airport)
          setAirlineIata(data.airline_iata)
          setFlightNumber(String(data.flight_no))
          setDateOfFlight(data.date)
          setNumSmallBags(data.bag_no)
          setNumLargeBags(data.bag_no_large)
          setEarliestArrival(data.earliest_time)
          setLatestArrival(data.latest_time)
          setDropoff(data.max_dropoff)
          setBudget(data.max_price)
          setOptInUnmatched(!data.matched)
          setTerminal(data.terminal)
        }
        setIsLoading(false)
      }

      fetchFlightData()
    }
  }, [mode, flightId, supabase])

  // Handle airline code input with validation
  const handleAirlineCodeChange = (input: string) => {
    const cleanInput = input.trim().toUpperCase()
    setAirlineIata(cleanInput)
    setFlightValidationError('')

    if (cleanInput) {
      const validation = validateAirlineCode(cleanInput)
      if (!validation.isValid) {
        setFlightValidationError(validation.errorMessage!)
      }
    }
  }

  // Handle flight number input with validation
  const handleFlightNumberChange = (input: string) => {
    const cleanInput = input.trim()
    setFlightNumber(cleanInput)
    setFlightValidationError('')

    if (cleanInput) {
      const validation = validateFlightNumber(cleanInput)
      if (!validation.isValid) {
        setFlightValidationError(validation.errorMessage!)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Prevent submission while loading data
    if (isLoading) {
      setMessage('Please wait while data is loading...')
      return
    }

    // Validate user has complete profile
    const profileValidation = await validateUserProfile()
    if (!profileValidation.isValid) {
      setMessage(`${profileValidation.message}`)
      return
    }

    if (!airline_iata || !flight_no || !earliestArrival || !latestArrival) {
      setMessage('Missing information!')
      return
    }

    // Validate airline code and flight number
    const airlineValidation = validateAirlineCode(airline_iata)
    const flightValidation = validateFlightNumber(flight_no)

    if (!airlineValidation.isValid) {
      setMessage(airlineValidation.errorMessage!)
      return
    }
    if (!flightValidation.isValid) {
      setMessage(flightValidation.errorMessage!)
      return
    }

    if (numSmallBags + numLargeBags >= 4) {
      setPendingSubmit(e)
      setShowManyBagsModal(true)
      return
    }

    if (numSmallBags < 0 || numLargeBags < 0) {
      setMessage('Please enter a valid number of bags')
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

    if (!airline_iata || !flight_no || !earliestArrival || !latestArrival) {
      setMessage('Missing information!')
      return
    }

    const flightData = {
      to_airport: tripType,
      airport,
      flight_no: flight_no,
      airline_iata: airline_iata,
      date: dateOfFlight,
      bag_no: numSmallBags,
      bag_no_large: numLargeBags,
      earliest_time: earliestArrival,
      latest_time: latestArrival,
      max_dropoff: dropoff,
      max_price: budget,
      opt_in: optInUnmatched,
      terminal,
    }

    let error
    if (mode === 'create') {
      const result = await supabase.from('Flights').insert([
        {
          user_id: user.id,
          ...flightData,
        },
      ])
      error = result.error
    } else {
      const result = await supabase
        .from('Flights')
        .update({
          ...flightData,
          matched: optInUnmatched ? false : true, // For edit mode
        })
        .eq('flight_id', flightId)
      error = result.error
    }

    if (error) {
      console.error('Error with flight data:', error)
      setMessage(`Error: ${error.message}`)
      return
    }

    setIsModalOpen(true)
    setMessage(successMessage)
    if (onSuccess) {
      onSuccess()
    }
  }

  return (
    <div className="flex w-full flex-col items-center bg-gray-100 text-black">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>
      <p className="mb-4">
        Enter your flight details below. All fields are required.
      </p>
      {!isProfileComplete && (
        <div className="mb-6">
          <RedirectButton label="Complete Profile First" route="/profile" />
        </div>
      )}

      <div className="w-96 rounded-lg bg-white shadow-md">
        {isLoading && (
          <div className="flex items-center justify-center bg-blue-50 p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <span className="ml-2 text-teal-600">Loading flight data...</span>
          </div>
        )}
        <ScrollArea className="h-[50vh] px-6 py-6">
          <form id="flight-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-2 flex gap-2">
              <label className="flex flex-1 flex-col">
                <span className="font-bold">Trip Direction:</span>
                <TripToggle onSelect={setTripType} />
              </label>
            </div>

            <div className="mb-2 flex gap-2">
              <label className="flex flex-1 flex-col">
                <span className="font-bold">Airport:</span>
                <select
                  value={airport}
                  onChange={(e) => setAirport(e.target.value)}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                >
                  <option value="" disabled>
                    <span className="font-bold">Select</span>
                  </option>
                  <option value="LAX">LAX</option>
                  <option value="ONT">ONT</option>
                </select>
              </label>

              <label className="flex flex-1 flex-col">
                <span className="font-bold">Terminal:</span>
                <input
                  type="text"
                  value={terminal}
                  onChange={(e) => setTerminal(e.target.value)}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
            </div>

            <div className="mb-2 flex gap-2">
              <label className="flex flex-1 flex-col">
                <span className="font-bold">Airline Code:</span>
                <input
                  type="text"
                  value={airline_iata}
                  onChange={(e) => handleAirlineCodeChange(e.target.value)}
                  className={`mt-1 w-full rounded border bg-white p-2 text-black ${
                    flightValidationError &&
                    flightValidationError.includes('Airline')
                      ? 'border-red-500'
                      : ''
                  }`}
                  placeholder="AA"
                  maxLength={2}
                  required
                />
              </label>
              <label className="flex flex-1 flex-col">
                <span className="font-bold">Flight Number:</span>
                <input
                  type="text"
                  value={flight_no}
                  onChange={(e) => handleFlightNumberChange(e.target.value)}
                  className={`mt-1 w-full rounded border bg-white p-2 text-black ${
                    flightValidationError &&
                    flightValidationError.includes('Flight number')
                      ? 'border-red-500'
                      : ''
                  }`}
                  placeholder="123"
                  maxLength={4}
                  required
                />
              </label>
            </div>
            {flightValidationError && (
              <p className="mb-2 text-sm text-red-600">
                {flightValidationError}
              </p>
            )}
            {airline_iata && flight_no && !flightValidationError && (
              <p className="mb-2 text-sm text-teal-500">
                Full Flight: {airline_iata}
                {flight_no}
              </p>
            )}

            <label className="mb-2 block">
              <span className="font-bold">Flight Date:</span>
              <input
                type="date"
                value={dateOfFlight}
                onChange={(e) => setDateOfFlight(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
                required
              />
            </label>

            <div className="mb-2">
              <label className="mb-2 block">
                <div className="flex items-center gap-1">
                  <span className="font-bold">
                    {tripType
                      ? "Time Range You're Able to Leave to the Airport (PST):"
                      : "Time Range You're Able to Leave from the Airport (PST):"}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-blue-100 p-1 transition-colors hover:bg-blue-200">
                        <svg
                          className="h-3 w-3 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        The wider the range, the more likely you are to get
                        matched with others
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="time"
                    value={earliestArrival}
                    onChange={(e) => setEarliestArrival(e.target.value)}
                    className="flex-1 rounded border bg-white p-2 text-black"
                    required
                  />
                  <span className="font-medium text-gray-600">to</span>
                  <input
                    type="time"
                    value={latestArrival}
                    onChange={(e) => setLatestArrival(e.target.value)}
                    className="flex-1 rounded border bg-white p-2 text-black"
                    required
                  />
                </div>
              </label>
            </div>

            <div className="mb-2 flex gap-2">
              <label className="flex flex-1 flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold">Small Bags:</span>
                  <Tooltip {...smallBagsTooltip}>
                    <TooltipTrigger asChild>
                      <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-blue-100 p-1 transition-colors hover:bg-blue-200">
                        <svg
                          className="h-3 w-3 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Backpacks, purses, and similar items</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  type="number"
                  value={numSmallBags}
                  onChange={(e) => setNumSmallBags(Number(e.target.value))}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
              <label className="flex flex-1 flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold">Large Bags:</span>
                  <Tooltip {...largeBagsTooltip}>
                    <TooltipTrigger asChild>
                      <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-blue-100 p-1 transition-colors hover:bg-blue-200">
                        <svg
                          className="h-3 w-3 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>
                        Anything larger than a small bag (suitcases, checked
                        luggage, etc.)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <input
                  type="number"
                  value={numLargeBags}
                  onChange={(e) => setNumLargeBags(Number(e.target.value))}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
            </div>

            <label className="mb-2 block">
              <div className="flex items-center gap-1">
                <span>Furthest pickup/dropoff radius:</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-blue-100 p-1 transition-colors hover:bg-blue-200">
                      <svg
                        className="h-3 w-3 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Only applies to pickup/dropoff at campus</p>
                  </TooltipContent>
                </Tooltip>
              </div>
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

            {/* Opt-in checkbox */}
            <label className="mb-2 mt-4 block rounded bg-gray-100 p-3">
              <input
                type="checkbox"
                checked={optInUnmatched}
                onChange={(e) => setOptInUnmatched(e.target.checked)}
                className="mr-2"
              />
              <strong>Would you like to opt-in to the Unmatched page?</strong>{' '}
              <br /> <br />
              If PICKUP is unable to match you through our algorithm, the
              Unmatched page will display your name, email, flight date, and
              time, so you can try to find others who you may be able to split a
              ride with.
            </label>
          </form>
        </ScrollArea>

        {/* Fixed bottom section outside of scroll area */}
        <div className="border-t bg-white p-6">
          <div className="flex justify-between">
            <RedirectButton label="Cancel" route="/questionnaires" />
            <button
              type="submit"
              form="flight-form"
              disabled={isLoading}
              className={`mt-4 rounded-lg px-6 py-3 text-lg font-semibold text-white ${
                isLoading
                  ? 'cursor-not-allowed bg-gray-400'
                  : 'bg-teal-500 hover:bg-opacity-80'
              }`}
            >
              {isLoading ? 'Loading...' : submitButtonText}
            </button>
          </div>

          {message && (
            <div className="mt-4 text-center">
              <p className="mb-2">{message}</p>
            </div>
          )}
        </div>

        {/* Handle Bag Pop-up */}
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
          route={successRedirectRoute}
          onClose={() => setIsModalOpen(false)}
        />
      </div>
    </div>
  )
}
