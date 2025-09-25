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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  useClickTooltip,
} from '@/components/ui/tooltip'

export interface FlightFormProps {
  mode: 'create' | 'edit'
  flightId?: string // Required for edit mode
  // title: string
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
  bag_no_personal: number
  bag_no: number
  bag_no_large: number
  earliestArrival: string
  latestArrival: string
  // dropoff: number
  // budget: number
  optInUnmatched: boolean
  terminal: string
}

export default function FlightForm({
  mode,
  flightId,
  // title,
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
  const [bag_no_personal, setBagNoPersonal] = useState(0)
  const [bag_no, setBagNo] = useState(0)
  const [bag_no_large, setBagNoLarge] = useState(0)
  const [earliestArrival, setEarliestArrival] = useState('')
  const [latestArrival, setLatestArrival] = useState('')
  // const [dropoff, setDropoff] = useState(0.5)
  // const [budget, setBudget] = useState(50)
  const [optInUnmatched, setOptInUnmatched] = useState(false)
  const [terminal, setTerminal] = useState('')
  const [message, setMessage] = useState('')
  const [isProfileComplete, setIsProfileComplete] = useState(true)
  const [isLoading, setIsLoading] = useState(false)

  // Click tooltip hooks
  const personalItemsTooltip = useClickTooltip()
  const carryOnBagsTooltip = useClickTooltip()
  const checkedLuggageTooltip = useClickTooltip()
  const timeRangeTooltip = useClickTooltip()
  // const dropoffRadiusTooltip = useClickTooltip()

  // Mobile info modal state
  const [showMobileInfo, setShowMobileInfo] = useState(false)
  const [mobileInfoContent, setMobileInfoContent] = useState('')

  // ASPC warning state
  const [showASPCWarning, setShowASPCWarning] = useState(false)
  const [aspcWarningMessage, setAspcWarningMessage] = useState('')
  const [isASPCGuaranteed, setIsASPCGuaranteed] = useState(false)
  const [userSchool, setUserSchool] = useState('')

  // Handle mobile info display
  const showMobileInfoModal = (content: string) => {
    setMobileInfoContent(content)
    setShowMobileInfo(true)
  }

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

  // Fetch user school information
  useEffect(() => {
    const fetchUserSchool = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const { data: userProfile } = await supabase
          .from('Users')
          .select('school')
          .eq('user_id', user.id)
          .single()

        if (userProfile?.school) {
          setUserSchool(userProfile.school)
        }
      }
    }
    fetchUserSchool()
  }, [])

  // Check ASPC subsidy eligibility when date and time change
  useEffect(() => {
    if (dateOfFlight && earliestArrival && latestArrival && userSchool) {
      checkASPCSubsidyEligibility()
    }
  }, [dateOfFlight, earliestArrival, latestArrival, tripType, userSchool])

  // ASPC subsidy checking function
  const checkASPCSubsidyEligibility = () => {
    if (!dateOfFlight || !earliestArrival || !latestArrival || !userSchool)
      return

    // Only show ASPC warnings for Pomona College students
    if (userSchool !== 'Pomona') {
      setShowASPCWarning(false)
      return
    }

    // ASPC operational dates (hardcoded for Fall 2025)
    const aspcDates = ['2025-10-11', '2025-10-13', '2025-10-14']

    // Check if date is within ±2 days of ASPC operational dates
    const flightDate = new Date(dateOfFlight)
    const isWithinASPCWindow = aspcDates.some((aspcDate) => {
      const aspcDateObj = new Date(aspcDate)
      const diffTime = Math.abs(flightDate.getTime() - aspcDateObj.getTime())
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      return diffDays <= 2
    })

    // Check if date is exactly an ASPC operational date
    const isExactASPCDate = aspcDates.includes(dateOfFlight)

    if (!isWithinASPCWindow) {
      setAspcWarningMessage(
        'You are not eligible for ASPC subsidy because your flight date is not within the operational dates. You can still use P-ICKUP to coordinate non-subsidized rides.',
      )
      setIsASPCGuaranteed(false)
      setShowASPCWarning(true)
      return
    }

    // Parse time strings (format: "HH:MM")
    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours + minutes / 60
    }

    const earliestTime = parseTime(earliestArrival)
    const latestTime = parseTime(latestArrival)

    // Define time windows (in PST)
    const outboundStart = 6 // 6:00 AM
    const outboundEnd = 18 // 6:00 PM
    const inboundStart = 10 // 10:00 AM
    const inboundEnd = 22 // 10:00 PM

    let isGuaranteed = false
    let warningMessage = ''

    if (tripType) {
      // Outbound: 6 AM - 6 PM PST
      if (earliestTime >= outboundStart && latestTime <= outboundEnd) {
        if (isExactASPCDate) {
          isGuaranteed = true
          warningMessage =
            '✅ You are guaranteed a subsidized ride! Your time range falls within ASPC guaranteed hours (6:00 AM - 6:00 PM PST) on an operational date.'
        } else {
          isGuaranteed = false
          warningMessage =
            'You are not guaranteed a subsidized ride because your flight is not within the operational dates, but it may still be possible if 2+ riders are grouped for ONT. Check out the policy page for more details.'
        }
      } else {
        // Determine specific reason for outbound
        let reason = ''
        if (earliestTime < outboundStart) {
          reason = `your time range is before 6:00 AM PST`
        } else if (latestTime > outboundEnd) {
          reason = `your time range is after 6:00 PM PST`
        } else {
          reason = `your time range is outside the guaranteed window (6:00 AM - 6:00 PM PST)`
        }

        if (isExactASPCDate) {
          warningMessage = `You are not guaranteed a subsidized ride because ${reason}, but it may still be possible if 2+ riders are grouped for ONT. Check out the policy page for more details.`
        } else {
          warningMessage = `You are not guaranteed a subsidized ride because ${reason} and your flight is not within the operational dates, but it may still be possible if 2+ riders are grouped for ONT. Check out the policy page for more details.`
        }
      }
    } else {
      // Inbound: 10 AM - 10 PM PST
      if (earliestTime >= inboundStart && latestTime <= inboundEnd) {
        if (isExactASPCDate) {
          isGuaranteed = true
          warningMessage =
            '✅ You are guaranteed a subsidized ride! Your arrival time falls within ASPC guaranteed hours (10:00 AM - 10:00 PM PST) on an operational date.'
        } else {
          isGuaranteed = false
          warningMessage =
            'You are not guaranteed a subsidized ride because your flight is not within the operational dates and/or times. However, you may be eligible for an after-hours ride if 2 or more riders are grouped for ONT. Check the ASPC policy page for more details.'
        }
      } else {
        // Determine specific reason for inbound
        let reason = ''
        if (earliestTime < inboundStart) {
          reason = `your arrival time is before 10:00 AM PST`
        } else if (latestTime > inboundEnd) {
          reason = `your arrival time is after 10:00 PM PST`
        } else {
          reason = `your arrival time is outside the guaranteed window (10:00 AM - 10:00 PM PST)`
        }

        if (isExactASPCDate) {
          warningMessage = `You are not guaranteed a subsidized ride because ${reason}, but it may still be possible if 2+ riders are grouped for ONT. Check out the policy page for more details.`
        } else {
          warningMessage = `You are not guaranteed a subsidized ride because ${reason} and your flight is not within the operational dates, but it may still be possible if 2+ riders are grouped for ONT. Check the ASPC policy page for more details.`
        }
      }
    }

    setIsASPCGuaranteed(isGuaranteed)
    setAspcWarningMessage(warningMessage)
    setShowASPCWarning(true)
  }

  // Load existing flight data for edit mode
  useEffect(() => {
    if (mode === 'edit' && flightId) {
      setIsLoading(true)
      const fetchFlightData = async () => {
        const { data, error } = await supabase
          .from('Flights')
          .select(
            'flight_id, flight_no, airline_iata, date, matched, to_airport, airport, bag_no_personal, bag_no, bag_no_large, earliest_time, latest_time, terminal',
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
          setBagNoPersonal(data.bag_no_personal || 0)
          setBagNo(data.bag_no || 0)
          setBagNoLarge(data.bag_no_large || 0)
          setEarliestArrival(data.earliest_time)
          setLatestArrival(data.latest_time)
          // setDropoff(data.max_dropoff)
          // setBudget(data.max_price)
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

    if (bag_no_personal + bag_no + bag_no_large >= 4) {
      setPendingSubmit(e)
      setShowManyBagsModal(true)
      return
    }

    if (bag_no_personal < 0 || bag_no < 0 || bag_no_large < 0) {
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
      bag_no_personal: bag_no_personal,
      bag_no: bag_no,
      bag_no_large: bag_no_large,
      earliest_time: earliestArrival,
      latest_time: latestArrival,
      // max_dropoff: dropoff,
      // max_price: budget,
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
    <div className="flex w-full flex-col items-center text-black">
      {/* <h1 className="mb-4 text-3xl font-bold">{title}</h1> */}
      <div className="mb-4 flex items-center gap-2">
        <p>All fields are required.</p>
        {userSchool === 'Pomona' && (
          <a
            href="/aspc-info"
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            See here for ASPC policies and resources
          </a>
        )}
      </div>
      {!isProfileComplete && (
        <div className="mb-6">
          <RedirectButton label="Complete Profile First" route="/profile" />
        </div>
      )}

      <div className="w-full max-w-6xl md:rounded-lg md:bg-white md:shadow-md">
        {isLoading && (
          <div className="flex items-center justify-center bg-blue-50 p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <span className="ml-2 text-teal-600">Loading flight data...</span>
          </div>
        )}
        <div className="px-2 py-4 md:px-8 md:py-8">
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
                    Select
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
                  {/* Desktop tooltip */}
                  <div className="hidden md:block">
                    <Tooltip {...timeRangeTooltip}>
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
                      <TooltipContent side="top" className="max-w-xs">
                        <p>
                          The wider the range, the more likely you are to get
                          matched with others. You must be available for the
                          entire range.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Mobile info button */}
                  <div className="block md:hidden">
                    <button
                      type="button"
                      className="flex h-5 w-5 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-blue-100 p-1 transition-colors active:bg-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        showMobileInfoModal(
                          'Time Range: The wider the range, the more likely you are to get matched with others. You must be available for the entire range.',
                        )
                      }}
                    >
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
                    </button>
                  </div>
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

            <div className="mb-2 flex gap-2 md:grid md:grid-cols-3 md:gap-4">
              <label className="flex flex-1 flex-col md:flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold">Personal Item:</span>
                  {/* Desktop tooltip */}
                  <div className="hidden md:block">
                    <Tooltip {...personalItemsTooltip}>
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
                      <TooltipContent side="top" className="max-w-xs">
                        <p>
                          purse, backpack, laptop bag (fit under the seat in
                          front of you)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Mobile info button */}
                  <div className="block md:hidden">
                    <button
                      type="button"
                      className="flex h-5 w-5 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-blue-100 p-1 transition-colors active:bg-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        showMobileInfoModal(
                          'Personal Item: purse, backpack, laptop bag (fit under the seat in front of you)',
                        )
                      }}
                    >
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
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={bag_no_personal}
                  onChange={(e) => setBagNoPersonal(Number(e.target.value))}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
              <label className="flex flex-1 flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold">Carry-on Sized:</span>
                  {/* Desktop tooltip */}
                  <div className="hidden md:block">
                    <Tooltip {...carryOnBagsTooltip}>
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
                      <TooltipContent side="top" className="max-w-xs">
                        <p>
                          small suitcases, mid-size backpacks (fit in overhead
                          bins)
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Mobile info button */}
                  <div className="block md:hidden">
                    <button
                      type="button"
                      className="flex h-5 w-5 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-blue-100 p-1 transition-colors active:bg-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        showMobileInfoModal(
                          'Carry-on Sized: small suitcases, mid-size backpacks (fit in overhead bins)',
                        )
                      }}
                    >
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
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={bag_no}
                  onChange={(e) => setBagNo(Number(e.target.value))}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
              <label className="flex flex-1 flex-col">
                <div className="flex items-center gap-1">
                  <span className="font-bold">Checked Luggage:</span>
                  {/* Desktop tooltip */}
                  <div className="hidden md:block">
                    <Tooltip {...checkedLuggageTooltip}>
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
                      <TooltipContent side="top" className="max-w-xs">
                        <p>
                          large suitcases or similar; log as multiple items if
                          larger than 30&quot; x 20&quot; x 12&quot;
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  {/* Mobile info button */}
                  <div className="block md:hidden">
                    <button
                      type="button"
                      className="flex h-5 w-5 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-blue-100 p-1 transition-colors active:bg-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        showMobileInfoModal(
                          'Checked Luggage: large suitcases or similar; log as multiple items if larger than 30" x 20" x 12"',
                        )
                      }}
                    >
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
                    </button>
                  </div>
                </div>
                <input
                  type="number"
                  value={bag_no_large}
                  onChange={(e) => setBagNoLarge(Number(e.target.value))}
                  className="mt-1 w-full rounded border bg-white p-2 text-black"
                  required
                />
              </label>
            </div>

            {/* Dropoff and Budget sliders - commented out for now */}
            {/* 
            <div className="mb-2 flex flex-col gap-4 md:grid md:grid-cols-2">
              <label className="flex flex-col">
                <div className="flex items-center gap-1">
                  <span>Furthest pickup/dropoff radius:</span>
                  <div className="hidden md:block">
                    <Tooltip {...dropoffRadiusTooltip}>
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
                      <TooltipContent side="top" className="max-w-xs">
                        <p>Only applies to pickup/dropoff at campus</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="block md:hidden">
                    <button
                      type="button"
                      className="flex h-5 w-5 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-blue-100 p-1 transition-colors active:bg-blue-300"
                      onClick={(e) => {
                        e.stopPropagation()
                        showMobileInfoModal(
                          'Pickup/Dropoff Radius: Only applies to pickup/dropoff at campus',
                        )
                      }}
                    >
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
                    </button>
                  </div>
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

              <label className="flex flex-col">
                <span>
                  Budget: <strong>${budget}</strong>
                </span>
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
            </div>
            */}

            {/* ASPC Warning - Above unmatched checkbox */}
            {showASPCWarning && (
              <div
                className={`mb-4 rounded-xl border-2 p-4 shadow-lg ${
                  isASPCGuaranteed
                    ? 'to-emerald-50 border-green-200 bg-gradient-to-r from-green-50'
                    : 'border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {isASPCGuaranteed ? (
                      <svg
                        className="h-6 w-6 text-green-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-6 w-6 text-orange-500"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className={`text-sm font-medium ${
                        isASPCGuaranteed ? 'text-green-800' : 'text-orange-800'
                      }`}
                    >
                      {aspcWarningMessage}
                    </p>
                    <div className="mt-2">
                      <a
                        href="/aspc-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center text-sm font-semibold underline hover:opacity-80 ${
                          isASPCGuaranteed
                            ? 'text-green-600 hover:text-green-700'
                            : 'text-orange-600 hover:text-orange-700'
                        }`}
                      >
                        View ASPC Policy Details
                        <svg
                          className="ml-1 h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowASPCWarning(false)}
                    className={`flex-shrink-0 hover:opacity-80 ${
                      isASPCGuaranteed
                        ? 'text-green-400 hover:text-green-600'
                        : 'text-orange-400 hover:text-orange-600'
                    }`}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}

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
        </div>

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

        {/* Mobile Info Modal */}
        {showMobileInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  More Info
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMobileInfo(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <p className="leading-relaxed text-gray-700">
                {mobileInfoContent}
              </p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowMobileInfo(false)}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
