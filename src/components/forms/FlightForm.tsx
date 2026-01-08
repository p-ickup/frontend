'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import RedirectButton from '@/components/buttons/RedirectButton'
import SubmitSuccess from '@/components/questionnaires/SubmitSuccess'
import ManyBagsNotice from '@/components/questionnaires/ManyBagsNotice'
import TripToggle from '@/components/questionnaires/ToWhereToggle'
import { createBrowserClient } from '@/utils/supabase'
import { validateUserProfile } from '@/utils/profileValidation'
import {
  validateAirlineCode,
  validateFlightNumber,
  isFlightPastDeadline,
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
  latestDate: string // Latest date for overnight time ranges
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
  const [dateOfFlight, setDateOfFlight] = useState('') // Earliest date
  const [latestDate, setLatestDate] = useState('') // Latest date (for overnight ranges)
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
  const [isValidationError, setIsValidationError] = useState(false) // true = validation, false = submission error
  const [duplicateErrorMessage, setDuplicateErrorMessage] = useState('')
  const [deadlineErrorMessage, setDeadlineErrorMessage] = useState('')
  const [isDuplicateError, setIsDuplicateError] = useState(false)
  const [isPastDeadline, setIsPastDeadline] = useState(false)
  const [isProfileComplete, setIsProfileComplete] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Multi-page wizard state
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 5 // Updated to 5 steps: 1=Direction/Airport, 2=Date/Time, 3=Flight Details, 4=Luggage, 5=Review

  // Use ref for immediate submission lock (prevents race conditions)
  const isSubmittingRef = useRef(false)

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

  // Check ASPC subsidy eligibility when date, airport, or times change
  useEffect(() => {
    if (dateOfFlight && airport && userSchool) {
      checkASPCSubsidyEligibility()
    }
  }, [dateOfFlight, airport, userSchool, earliestArrival, latestArrival])

  // Check if selected date is past its deadline in real-time
  useEffect(() => {
    if (!dateOfFlight) {
      setIsPastDeadline(false)
      setDeadlineErrorMessage('')
      return
    }

    const deadlineCheck = isFlightPastDeadline(dateOfFlight)
    if (deadlineCheck.isPastDeadline) {
      setDeadlineErrorMessage(
        `Sorry! The deadline for ${deadlineCheck.periodName} has passed. Request deadline was ${deadlineCheck.deadline?.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}.`,
      )
      setIsPastDeadline(true)
    } else {
      setDeadlineErrorMessage('')
      setIsPastDeadline(false)
    }
  }, [dateOfFlight])

  // Check for duplicate flights in real-time when date, airport, or trip type changes
  useEffect(() => {
    const checkForDuplicates = async () => {
      // Only check in create mode and when we have the required fields
      if (mode !== 'create' || !dateOfFlight || !airport) {
        setIsDuplicateError(false)
        setDuplicateErrorMessage('')
        return
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) return

        const { data: existingFlights, error: checkError } = await supabase
          .from('Flights')
          .select('flight_id, flight_no, date, to_airport, airport')
          .eq('user_id', user.id)
          .eq('date', dateOfFlight)
          .eq('to_airport', tripType)
          .eq('airport', airport)

        if (checkError) {
          console.error('Error checking for duplicates:', checkError)
          return
        }

        if (existingFlights && existingFlights.length > 0) {
          // Format date without timezone issues (YYYY-MM-DD to MM/DD/YYYY)
          const [year, month, day] = dateOfFlight.split('-')
          const formattedDate = `${month}/${day}/${year}`

          setDuplicateErrorMessage(
            `You already have a ${tripType ? 'departure to' : 'return from'} ${airport} on ${formattedDate}. Please edit your existing flight instead.`,
          )
          setIsDuplicateError(true)
        } else {
          setDuplicateErrorMessage('')
          setIsDuplicateError(false)
        }
      } catch (error) {
        console.error('Error in duplicate check:', error)
      }
    }

    checkForDuplicates()
  }, [dateOfFlight, airport, tripType, mode, supabase])

  // ASPC subsidy checking function
  const checkASPCSubsidyEligibility = () => {
    if (!dateOfFlight || !userSchool) return

    // Only show ASPC warnings for Pomona College students
    if (userSchool !== 'Pomona') {
      setShowASPCWarning(false)
      return
    }

    // ASPC operational periods for 2025-2026
    const operationalPeriods = [
      // Thanksgiving Break Departures: November 21-26, 2025
      { start: '2025-11-21', end: '2025-11-26', type: 'departure' },
      // Thanksgiving Break Returns: November 29 - December 1, 2025
      { start: '2025-11-29', end: '2025-12-01', type: 'return' },
      // Winter Break Departure: December 9-13, 2025
      { start: '2025-12-09', end: '2025-12-13', type: 'departure' },
      // Winter Break Return: January 17-21, 2026
      { start: '2026-01-17', end: '2026-01-21', type: 'return' },
    ]

    // Check if date is within any operational period
    const flightDate = new Date(dateOfFlight)
    let isWithinOperationalPeriod = false
    let currentPeriod = null

    for (const period of operationalPeriods) {
      const startDate = new Date(period.start)
      const endDate = new Date(period.end)
      if (flightDate >= startDate && flightDate <= endDate) {
        isWithinOperationalPeriod = true
        currentPeriod = period
        break
      }
    }

    if (!isWithinOperationalPeriod) {
      setAspcWarningMessage(
        'Your flight date is not within ASPC RideLink operational periods (Thanksgiving Break or Winter Break). You can still use P-ICKUP to coordinate non-subsidized rides.',
      )
      setIsASPCGuaranteed(false)
      setShowASPCWarning(true)
      return
    }

    // Don't show warning until times are entered
    if (!earliestArrival || !latestArrival) {
      setShowASPCWarning(false)
      return
    }

    // New policy: No guaranteed times, only grouping requirements
    // LAX requires 3+ riders, ONT requires 2+ riders
    let warningMessage = ''

    if (airport === 'LAX') {
      warningMessage =
        '✅ Your flight is within an ASPC RideLink operational period. RideLink will cover your ride if 2+ riders are matched with you. Be flexible with your time range to increase matching odds.'
    } else if (airport === 'ONT') {
      warningMessage =
        '✅ Your flight is within an ASPC RideLink operational period. RideLink will cover your ride if 1+ riders are matched with you. Be flexible with your time range to increase matching odds.'
    } else {
      warningMessage =
        '✅ Your flight is within an ASPC operational period. RideLink covers rides when groups can be formed (2+ to ONT, 3+ to LAX). Check the policy page for more details.'
    }

    setIsASPCGuaranteed(false) // No more guaranteed rides under new policy
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
            'flight_id, flight_no, airline_iata, date, latest_date, matched, to_airport, airport, bag_no_personal, bag_no, bag_no_large, earliest_time, latest_time, terminal',
          )
          .eq('flight_id', flightId)
          .single()

        if (error) {
          // console.error('Error fetching flight data:', error)
          setMessage(
            'Unable to load flight data. Please refresh the page or contact support if the problem persists.',
          )
        } else {
          console.log('Debug - Fetched flight data:', data)
          setTripType(data.to_airport)
          setAirport(data.airport)
          setAirlineIata(data.airline_iata)
          setFlightNumber(String(data.flight_no))
          setDateOfFlight(data.date)
          setLatestDate(data.latest_date || data.date) // Use latest_date from DB, fallback to date if not set
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }

    // Only allow submission on step 4 - prevent any form submission before final step
    if (currentStep !== totalSteps) {
      // Prevent form submission on steps 1-3 (user must click Next button)
      return
    }

    // Failsafe: If ref is stuck but state says we're not submitting, reset the ref
    if (isSubmittingRef.current && !isSubmitting) {
      isSubmittingRef.current = false
    }

    // Prevent submission while loading data
    if (isLoading) {
      setMessage('Please wait while data is loading...')
      setIsValidationError(true)
      return
    }

    // Validate user has complete profile
    const profileValidation = await validateUserProfile()
    if (!profileValidation.isValid) {
      setMessage(`${profileValidation.message}`)
      setIsValidationError(true)
      return
    }

    if (!airline_iata || !flight_no || !earliestArrival || !latestArrival) {
      setMessage('Missing information!')
      setIsValidationError(true)
      return
    }

    // Prevent submit if date is past its deadline
    if (isPastDeadline) {
      return
    }

    // Validate airline code and flight number
    const airlineValidation = validateAirlineCode(airline_iata)
    const flightValidation = validateFlightNumber(flight_no)

    if (!airlineValidation.isValid) {
      setMessage(airlineValidation.errorMessage!)
      setIsValidationError(true)
      return
    }
    if (!flightValidation.isValid) {
      setMessage(flightValidation.errorMessage!)
      setIsValidationError(true)
      return
    }

    if (bag_no_personal + bag_no + bag_no_large >= 4) {
      if (e) {
        setPendingSubmit(e)
        setShowManyBagsModal(true)
      }
      return
    }

    if (bag_no_personal < 0 || bag_no < 0 || bag_no_large < 0) {
      setMessage('Please enter a valid number of bags')
      setIsValidationError(true)
      return
    }

    await actuallySubmitForm()
  }

  // Handle keyboard events to prevent Enter key from submitting form on steps 1-3
  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter' && currentStep !== totalSteps) {
      console.log('Prevented Enter key on step:', currentStep)
      e.preventDefault()
      return false
    }
  }

  const actuallySubmitForm = async () => {
    // Prevent double-submit using ref (immediate, no React batching delay)
    if (isSubmittingRef.current) {
      return
    }

    // Prevent submit if there's a duplicate or deadline error
    if (isDuplicateError || isPastDeadline) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    // Set submitting flags immediately to prevent race condition
    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setMessage('Error: You must be logged in to submit flight details!')
        setIsValidationError(true)
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }

      if (!airline_iata || !flight_no || !earliestArrival || !latestArrival) {
        setMessage('Missing information!')
        setIsValidationError(true)
        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }

      const flightData = {
        to_airport: tripType,
        airport,
        flight_no: flight_no,
        airline_iata: airline_iata,
        date: dateOfFlight,
        latest_date: latestDate, // Store the latest date for overnight ranges
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
            matched: null, // Will be calculated later by matching algorithm
          },
        ])
        error = result.error
      } else {
        const result = await supabase
          .from('Flights')
          .update({
            ...flightData,
            matched: null, // Reset to null so it can be recalculated
          })
          .eq('flight_id', flightId)
        error = result.error
      }

      if (error) {
        console.error('Error with flight data:', error)

        // Check if it's a unique constraint violation (duplicate flight)
        if (
          error.code === '23505' ||
          error.message.includes('unique_user_flight_per_day')
        ) {
          const [year, month, day] = dateOfFlight.split('-')
          const formattedDate = `${month}/${day}/${year}`

          setMessage(
            `You already have a ${tripType ? 'departure to' : 'return from'} ${airport} on ${formattedDate}. Please edit your existing flight instead.`,
          )
          setIsValidationError(true)
          setIsDuplicateError(true)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        } else {
          // Database error - log details but show generic message to user
          setMessage(
            'There was an error saving your flight request. Please try again. If the problem persists, contact support.',
          )
          setIsValidationError(false) // Submission error - use bold red styling
          window.scrollTo({
            top: document.body.scrollHeight,
            behavior: 'smooth',
          })

          // Also show browser alert for critical errors that user might miss
          alert(
            `⚠️ Submission Failed\n\nThere was an error saving your flight request.\n\nPlease try again. If the problem persists, contact support.`,
          )
        }

        isSubmittingRef.current = false
        setIsSubmitting(false)
        return
      }

      // Clear any existing error messages before showing success modal
      setMessage('')
      setIsDuplicateError(false)
      isSubmittingRef.current = false // Reset ref on success
      setIsModalOpen(true)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error('Unexpected error:', error)
      // Display generic message to user while logging details for debugging
      setMessage(
        'An unexpected error occurred. Please try again. If the problem persists, contact support.',
      )
      setIsValidationError(false) // Submission error - use bold red styling

      // Scroll to error and show alert for unexpected errors
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })
      alert(
        `⚠️ Submission Failed\n\nAn unexpected error occurred.\n\nPlease try again. If the problem persists, contact support.`,
      )

      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  // Helper function to calculate time range duration
  const calculateTimeRange = (): number => {
    if (!earliestArrival || !latestArrival) return 0

    const [earlyHour, earlyMin] = earliestArrival.split(':').map(Number)
    const [lateHour, lateMin] = latestArrival.split(':').map(Number)

    let hours = lateHour - earlyHour
    let minutes = lateMin - earlyMin

    if (minutes < 0) {
      hours -= 1
      minutes += 60
    }

    // Handle case where latest time is next day
    if (hours < 0) {
      hours += 24
    }

    return hours + minutes / 60
  }

  // Helper function to calculate time range duration with dates
  const calculateTimeRangeWithDates = (): string => {
    if (!dateOfFlight || !latestDate || !earliestArrival || !latestArrival)
      return '0.0'

    // Create date objects
    const earliestDateTime = new Date(`${dateOfFlight}T${earliestArrival}:00`)
    const latestDateTime = new Date(`${latestDate}T${latestArrival}:00`)

    // Calculate difference in milliseconds
    const diffMs = latestDateTime.getTime() - earliestDateTime.getTime()

    // Convert to hours
    const diffHours = diffMs / (1000 * 60 * 60)

    return diffHours.toFixed(1)
  }

  // Helper function to convert 24-hour time to 12-hour format with AM/PM
  const formatTime12Hour = (time24: string): string => {
    if (!time24) return ''
    const [hours, minutes] = time24.split(':').map(Number)
    const period = hours >= 12 ? 'PM' : 'AM'
    const hours12 = hours % 12 || 12
    return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`
  }

  // Wizard navigation functions
  const goToNextStep = () => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) {
      return
    }
    setMessage('') // Clear any messages when moving forward
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1)
      // Removed scroll to top for better UX
    }
  }

  const goToPreviousStep = () => {
    setMessage('') // Clear any messages when going back
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      // Removed scroll to top for better UX
    }
  }

  const validateCurrentStep = (): boolean => {
    switch (currentStep) {
      case 1: // Trip direction
        if (!airport) {
          setMessage('Please select an airport')
          setIsValidationError(true)
          return false
        }
        return true
      case 2: // Date & Time only
        if (!dateOfFlight) {
          setMessage('Please enter your earliest date')
          setIsValidationError(true)
          return false
        }
        if (!latestDate) {
          setMessage('Please enter your latest date')
          setIsValidationError(true)
          return false
        }
        if (isPastDeadline) {
          setMessage('The deadline for this date has passed')
          setIsValidationError(true)
          return false
        }
        if (isDuplicateError) {
          setMessage('You already have a flight on this date')
          setIsValidationError(true)
          return false
        }
        if (!earliestArrival || !latestArrival) {
          setMessage('Please enter your complete time range')
          setIsValidationError(true)
          return false
        }
        return true
      case 3: // Flight details
        if (!airline_iata || !flight_no) {
          setMessage('Please enter your flight information')
          setIsValidationError(true)
          return false
        }
        const airlineValidation = validateAirlineCode(airline_iata)
        const flightValidation = validateFlightNumber(flight_no)
        if (!airlineValidation.isValid) {
          setMessage(airlineValidation.errorMessage!)
          setIsValidationError(true)
          return false
        }
        if (!flightValidation.isValid) {
          setMessage(flightValidation.errorMessage!)
          setIsValidationError(true)
          return false
        }
        if (!terminal) {
          setMessage('Please enter your terminal')
          setIsValidationError(true)
          return false
        }
        return true
      case 4: // Luggage
        if (bag_no_personal < 0 || bag_no < 0 || bag_no_large < 0) {
          setMessage('Please enter valid luggage counts (0 or more)')
          setIsValidationError(true)
          return false
        }
        return true
      case 5: // Review - no validation needed
        return true
      default:
        return true
    }
  }

  const getStepTitle = (): string => {
    switch (currentStep) {
      case 1:
        return 'Trip Direction & Airport'
      case 2:
        return 'Date & Time Range'
      case 3:
        return 'Flight Details'
      case 4:
        return 'Luggage Information'
      case 5:
        return 'Review & Submit'
      default:
        return ''
    }
  }

  return (
    <div className="flex w-full flex-col items-center text-black">
      {/* <h1 className="mb-4 text-3xl font-bold">{title}</h1> */}

      {/* Deadline Information Banner - Commented out to save space */}
      {/* 
      <div className="mb-4 w-full max-w-6xl rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
        <h3 className="mb-2 font-semibold text-blue-900">
          📅 Service Period Deadlines
        </h3>
        <div className="space-y-1 text-blue-800">
          <p>
            <strong>Thanksgiving Break</strong>:{' '}
            <span className="font-medium">Deadline Nov 14 @ 11:59 PM PT</span>
          </p>
          <p>
            <strong>Winter Break Outbound</strong>:{' '}
            <span className="font-medium">Deadline Dec 3 @ 11:59 PM PT</span>
          </p>
          <p>
            <strong>Winter Break Return</strong>:{' '}
            <span className="font-medium">Deadline Jan 9 @ 11:59 PM PT</span>
          </p>
        </div>
      </div>
      */}

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

      <div className="w-full max-w-4xl md:rounded-lg md:bg-white md:shadow-md">
        {isLoading && (
          <div className="flex items-center justify-center bg-blue-50 p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <span className="ml-2 text-teal-600">Loading flight data...</span>
          </div>
        )}

        {/* Progress indicator */}
        <div className="border-b bg-white px-4 py-6 md:px-8">
          <div className="mb-4 flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((step) => (
              <div key={step} className="flex items-center">
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors ${
                    step < currentStep
                      ? 'border-teal-500 bg-teal-500 text-white'
                      : step === currentStep
                        ? 'border-teal-500 bg-white text-teal-500'
                        : 'border-gray-300 bg-white text-gray-400'
                  }`}
                >
                  {step < currentStep ? (
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                {step < 5 && (
                  <div
                    className={`h-1 w-12 transition-colors md:w-16 ${
                      step < currentStep ? 'bg-teal-500' : 'bg-gray-300'
                    }`}
                  ></div>
                )}
              </div>
            ))}
          </div>
          <h2 className="text-center text-xl font-bold text-gray-800">
            {getStepTitle()}
          </h2>
          <p className="mt-1 text-center text-sm text-gray-600">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        <div className="px-4 py-6 md:px-8 md:py-8">
          <div className="space-y-6">
            {/* Step 1: Trip Direction & Airport */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-medium">
                    Let&apos;s start with the basics:
                  </p>
                  <p>
                    Tell us whether you&apos;re traveling to the airport from
                    campus or returning to campus from the airport.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-3 block text-lg font-bold text-gray-800">
                      Trip Direction
                    </span>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setTripType(true)}
                        className={`rounded-xl border-2 p-6 text-center transition-all ${
                          tripType === true
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className="mb-2 text-3xl">✈️</div>
                        <div
                          className={`text-lg font-bold ${
                            tripType === true
                              ? 'text-teal-700'
                              : 'text-gray-700'
                          }`}
                        >
                          To Airport from Campus
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Departing from Claremont
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setTripType(false)}
                        className={`rounded-xl border-2 p-6 text-center transition-all ${
                          tripType === false
                            ? 'border-teal-500 bg-teal-50'
                            : 'border-gray-300 bg-white hover:border-gray-400'
                        }`}
                      >
                        <div className="mb-2 text-3xl">🏫</div>
                        <div
                          className={`text-lg font-bold ${
                            tripType === false
                              ? 'text-teal-700'
                              : 'text-gray-700'
                          }`}
                        >
                          To Campus from Airport
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Returning to Claremont
                        </div>
                      </button>
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-lg font-bold text-gray-800">
                      Which Airport?
                    </span>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setAirport('LAX')}
                        className={`rounded-xl border-2 p-6 text-center font-semibold transition-all ${
                          airport === 'LAX'
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-2xl font-bold">LAX</div>
                        <div className="mt-1 text-sm">
                          Los Angeles International
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setAirport('ONT')}
                        className={`rounded-xl border-2 p-6 text-center font-semibold transition-all ${
                          airport === 'ONT'
                            ? 'border-teal-500 bg-teal-50 text-teal-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <div className="text-2xl font-bold">ONT</div>
                        <div className="mt-1 text-sm">
                          Ontario International
                        </div>
                      </button>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 2: Date and Time Range */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-medium">
                    📅 Time Range Instructions:
                  </p>
                  <p className="mb-2">
                    Specify the <strong>earliest</strong> and{' '}
                    <strong>latest</strong> date/time you&apos;re available to{' '}
                    {tripType
                      ? 'depart from campus'
                      : 'be picked up from the airport'}
                    .
                  </p>
                  <p className="text-xs">
                    💡 <strong>Tip:</strong> A wider time range increases your
                    chances of being matched with other riders. You must be
                    available for the entire range you provide.
                  </p>
                </div>

                <div className="space-y-6">
                  {/* Earliest Date/Time - Side by Side */}
                  <div>
                    <label className="mb-3 block text-lg font-bold text-gray-800">
                      Earliest Date & Time Available
                    </label>
                    <p className="mb-3 text-sm text-gray-600">
                      When is the earliest you can{' '}
                      {tripType
                        ? 'leave campus'
                        : 'be picked up from the airport'}
                      ?
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Date
                        </label>
                        <input
                          type="date"
                          value={dateOfFlight}
                          onChange={(e) => setDateOfFlight(e.target.value)}
                          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Time (PST)
                        </label>
                        <input
                          type="time"
                          value={earliestArrival}
                          onChange={(e) => setEarliestArrival(e.target.value)}
                          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Latest Date/Time - Side by Side */}
                  <div>
                    <label className="mb-3 block text-lg font-bold text-gray-800">
                      Latest Date & Time Available
                    </label>
                    <p className="mb-3 text-sm text-gray-600">
                      When is the latest you can{' '}
                      {tripType
                        ? 'leave campus'
                        : 'be picked up from the airport'}
                      ? (May be the following day if time range is overnight)
                    </p>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Date
                        </label>
                        <input
                          type="date"
                          value={latestDate}
                          onChange={(e) => setLatestDate(e.target.value)}
                          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                          Time (PST)
                        </label>
                        <input
                          type="time"
                          value={latestArrival}
                          onChange={(e) => setLatestArrival(e.target.value)}
                          className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time Range Duration Display */}
                  {earliestArrival &&
                    latestArrival &&
                    dateOfFlight &&
                    latestDate && (
                      <div className="rounded-lg bg-teal-50 p-3 text-center">
                        <p className="text-sm font-medium text-teal-800">
                          Your provided time range is{' '}
                          <span className="font-bold">
                            {calculateTimeRangeWithDates()} hours
                          </span>
                        </p>
                      </div>
                    )}

                  {/* Deadline Error */}
                  {isPastDeadline && deadlineErrorMessage && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                      <p className="font-medium text-red-800">
                        ⚠️ {deadlineErrorMessage}
                      </p>
                    </div>
                  )}

                  {/* Duplicate Flight Warning */}
                  {!isPastDeadline &&
                    isDuplicateError &&
                    duplicateErrorMessage && (
                      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                        <p className="mb-2 font-medium text-orange-800">
                          ⚠️ {duplicateErrorMessage}
                        </p>
                        <a
                          href="/questionnaires"
                          className="inline-block rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-orange-700"
                        >
                          Go to Your Flights
                        </a>
                      </div>
                    )}
                </div>
              </div>
            )}

            {/* Step 3: Flight Details (Airline, Flight Number, Terminal) */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-medium">Flight Information:</p>
                  <p>
                    Enter your airline code, flight number, and terminal
                    information.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="block">
                      <span className="mb-2 block text-lg font-bold text-gray-800">
                        Airline Code
                      </span>
                      <input
                        type="text"
                        value={airline_iata}
                        onChange={(e) =>
                          handleAirlineCodeChange(e.target.value)
                        }
                        className={`w-full rounded-lg border-2 bg-white p-3 text-black focus:outline-none ${
                          flightValidationError &&
                          flightValidationError.includes('Airline')
                            ? 'border-red-500'
                            : 'border-gray-300 focus:border-teal-500'
                        }`}
                        placeholder="AA"
                        maxLength={2}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-lg font-bold text-gray-800">
                        Flight Number
                      </span>
                      <input
                        type="text"
                        value={flight_no}
                        onChange={(e) =>
                          handleFlightNumberChange(e.target.value)
                        }
                        className={`w-full rounded-lg border-2 bg-white p-3 text-black focus:outline-none ${
                          flightValidationError &&
                          flightValidationError.includes('Flight number')
                            ? 'border-red-500'
                            : 'border-gray-300 focus:border-teal-500'
                        }`}
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-lg font-bold text-gray-800">
                        Terminal
                      </span>
                      <input
                        type="text"
                        value={terminal}
                        onChange={(e) => setTerminal(e.target.value)}
                        className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                        placeholder="e.g., TBIT, 2"
                        required
                      />
                    </label>
                  </div>
                  {flightValidationError && (
                    <p className="text-sm text-red-600">
                      {flightValidationError}
                    </p>
                  )}
                  {airline_iata && flight_no && !flightValidationError && (
                    <p className="text-sm font-medium text-teal-600">
                      ✓ Full Flight: {airline_iata}
                      {flight_no}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 4: Luggage Information */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-medium">Luggage Details:</p>
                  <p>
                    Let us know how much luggage you&apos;ll be traveling with.
                    This helps us plan vehicle capacity.
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-800">
                        Personal Items
                      </span>
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
                      min="0"
                      value={bag_no_personal}
                      onChange={(e) => setBagNoPersonal(Number(e.target.value))}
                      className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-800">
                        Carry-on Sized Bags
                      </span>
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
                              small suitcases, mid-size backpacks (fit in
                              overhead bins)
                            </p>
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
                      min="0"
                      value={bag_no}
                      onChange={(e) => setBagNo(Number(e.target.value))}
                      className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                      required
                    />
                  </label>

                  <label className="block">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-800">
                        Checked Luggage
                      </span>
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
                              large suitcases or similar; log as multiple items
                              if larger than 30&quot; x 20&quot; x 12&quot;
                            </p>
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
                      min="0"
                      value={bag_no_large}
                      onChange={(e) => setBagNoLarge(Number(e.target.value))}
                      className="w-full rounded-lg border-2 border-gray-300 bg-white p-3 text-black focus:border-teal-500 focus:outline-none"
                      required
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Step 5: Review & Submit */}
            {currentStep === 5 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="mb-2 font-medium">Review Your Information:</p>
                  <p>
                    Please review all your flight details below before
                    submitting.
                  </p>
                </div>

                {/* Flight Summary */}
                <div className="space-y-4 rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
                  <h3 className="mb-4 text-xl font-bold text-gray-800">
                    Flight Summary
                  </h3>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Trip Direction
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {tripType ? 'To Airport' : 'To Campus'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Airport
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {airport}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Flight
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {airline_iata}
                        {flight_no} - Terminal {terminal}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Date</p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {dateOfFlight
                          ? new Date(
                              dateOfFlight + 'T00:00:00',
                            ).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Availability Window
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {dateOfFlight && formatTime12Hour(earliestArrival)
                          ? `${new Date(dateOfFlight).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                              },
                            )} ${formatTime12Hour(earliestArrival)}`
                          : 'Not set'}{' '}
                        -{' '}
                        {latestDate && formatTime12Hour(latestArrival)
                          ? `${new Date(latestDate).toLocaleDateString(
                              'en-US',
                              {
                                month: 'short',
                                day: 'numeric',
                              },
                            )} ${formatTime12Hour(latestArrival)}`
                          : 'Not set'}
                      </p>
                      {dateOfFlight &&
                        latestDate &&
                        earliestArrival &&
                        latestArrival && (
                          <p className="mt-1 text-sm text-gray-500">
                            ({calculateTimeRangeWithDates()} hour window)
                          </p>
                        )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        Luggage
                      </p>
                      <p className="mt-1 text-lg font-semibold text-gray-900">
                        {bag_no_personal} personal, {bag_no} carry-on,{' '}
                        {bag_no_large} checked
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="mt-4 text-sm font-medium text-teal-600 hover:text-teal-700 hover:underline"
                  >
                    ← Edit Information
                  </button>
                </div>

                {/* ASPC Warning */}
                {showASPCWarning && (
                  <div
                    className={`rounded-xl border-2 p-4 shadow-lg ${
                      aspcWarningMessage.includes('✅')
                        ? 'to-emerald-50 border-green-200 bg-gradient-to-r from-green-50'
                        : 'border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        {aspcWarningMessage.includes('✅') ? (
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
                            aspcWarningMessage.includes('✅')
                              ? 'text-green-800'
                              : 'text-orange-800'
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
                              aspcWarningMessage.includes('✅')
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
                          aspcWarningMessage.includes('✅')
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
                <label className="block rounded-lg bg-gray-100 p-4">
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={optInUnmatched}
                      onChange={(e) => setOptInUnmatched(e.target.checked)}
                      className="mr-3 mt-1 h-5 w-5 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    <div>
                      <strong className="text-gray-900">
                        Would you like to opt-in to the Unmatched page?
                      </strong>
                      <p className="mt-2 text-sm text-gray-700">
                        If PICKUP is unable to match you through our algorithm,
                        the Unmatched page will display your name, email, flight
                        date, and time, so you can try to find others who you
                        may be able to split a ride with.
                      </p>
                    </div>
                  </div>
                </label>
              </div>
            )}

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

            {/* Message display */}
            {message && (
              <>
                {isValidationError ? (
                  /* Validation Error - Lighter yellow/orange style */
                  <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 p-4 text-center">
                    <p className="font-medium text-yellow-800">⚠️ {message}</p>
                  </div>
                ) : (
                  /* Submission Error - Bold red style */
                  <div className="rounded-lg border-2 border-red-400 bg-red-100 p-6 text-center shadow-lg">
                    <p className="mb-2 text-lg font-bold text-red-800">
                      ⚠️ Submission Failed
                    </p>
                    <p className="font-medium text-red-700">{message}</p>
                    <p className="mt-2 text-sm text-red-600">
                      Please try again. If the problem persists, contact
                      support.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between gap-4 pt-4">
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </button>
              ) : (
                <Link
                  href="/questionnaires"
                  className="flex items-center gap-2 rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                >
                  Cancel
                </Link>
              )}

              {currentStep < totalSteps ? (
                <button
                  type="button"
                  onClick={goToNextStep}
                  disabled={isLoading || isDuplicateError || isPastDeadline}
                  className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold text-white transition-colors ${
                    isLoading || isDuplicateError || isPastDeadline
                      ? 'cursor-not-allowed bg-gray-400'
                      : 'bg-teal-500 hover:bg-teal-600'
                  }`}
                >
                  Next
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e as any)}
                  disabled={
                    isLoading ||
                    isSubmitting ||
                    isDuplicateError ||
                    isPastDeadline
                  }
                  className={`rounded-lg px-8 py-3 font-semibold text-white transition-colors ${
                    isLoading ||
                    isSubmitting ||
                    isDuplicateError ||
                    isPastDeadline
                      ? 'cursor-not-allowed bg-gray-400'
                      : 'bg-teal-500 hover:bg-teal-600'
                  }`}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-5 w-5 animate-spin"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    submitButtonText
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Handle Bag Pop-up */}
        <ManyBagsNotice
          open={showManyBagsModal}
          onConfirm={() => {
            setShowManyBagsModal(false)
            if (pendingSubmit) {
              actuallySubmitForm()
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
