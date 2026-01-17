'use client'

import { createBrowserClient } from '@/utils/supabase'
import { useState, useEffect, useMemo } from 'react'
import { X, User, Plane, Search } from 'lucide-react'

type ChangeLogAction =
  | 'RUN_ALGORITHM'
  | 'ADD_TO_GROUP'
  | 'REMOVE_FROM_GROUP'
  | 'CREATE_GROUP'
  | 'DELETE_GROUP'
  | 'IGNORE_ERROR'
  | 'UPDATE_GROUP_TIME'
  | 'UPDATE_VOUCHER'
  | 'UPDATE_RIDER_DETAILS'
  | 'EMAIL_CONFIRMED'
  | 'ADD_FLIGHT'

interface AddRiderProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  logToChangeLog?: (
    action: ChangeLogAction,
    metadata?: any,
    targetGroupId?: number,
    targetUserId?: string,
    confirmed?: boolean,
  ) => Promise<void>
}

interface User {
  user_id: string
  firstname: string
  lastname: string
  school: string
  email: string
  phonenumber: string
}

export default function AddRider({
  isOpen,
  onClose,
  onSuccess,
  logToChangeLog,
}: AddRiderProps) {
  const supabase = createBrowserClient()
  const [step, setStep] = useState<
    'select-school' | 'select-user' | 'flight-info'
  >('select-school')
  const [schools, setSchools] = useState<string[]>([])
  const [selectedSchool, setSelectedSchool] = useState<string>('')
  const [users, setUsers] = useState<User[]>([])
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  // Flight form state
  const [flightNo, setFlightNo] = useState('')
  const [airlineIata, setAirlineIata] = useState('')
  const [airport, setAirport] = useState('')
  const [toAirport, setToAirport] = useState(true)
  const [date, setDate] = useState('')
  const [timeRange, setTimeRange] = useState('')
  const [checkedBags, setCheckedBags] = useState(0)
  const [carryOnBags, setCarryOnBags] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  // Fetch schools on mount
  useEffect(() => {
    if (isOpen && step === 'select-school') {
      fetchSchools()
    }
  }, [isOpen, step])

  // Fetch users when school is selected
  useEffect(() => {
    if (selectedSchool && step === 'select-user') {
      fetchUsersBySchool(selectedSchool)
    }
  }, [selectedSchool, step])

  const fetchSchools = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('Users')
        .select('school')
        .not('school', 'is', null)
        .neq('school', '')

      if (error) {
        console.error('Error fetching schools:', error)
        setError('Failed to fetch schools')
        return
      }

      const uniqueSchools = Array.from(
        new Set(data.map((u: any) => u.school).filter(Boolean)),
      ).sort() as string[]
      setSchools(uniqueSchools)
    } catch (err) {
      console.error('Error fetching schools:', err)
      setError('Failed to fetch schools')
    } finally {
      setLoading(false)
    }
  }

  const fetchUsersBySchool = async (school: string) => {
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('Users')
        .select('user_id, firstname, lastname, school, email, phonenumber')
        .eq('school', school)
        .order('firstname')
        .order('lastname')

      if (error) {
        console.error('Error fetching users:', error)
        setError('Failed to fetch users')
        return
      }

      setUsers(data || [])
    } catch (err) {
      console.error('Error fetching users:', err)
      setError('Failed to fetch users')
    } finally {
      setLoading(false)
    }
  }

  const handleSchoolSelect = (school: string) => {
    setSelectedSchool(school)
    setStep('select-user')
  }

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setStep('flight-info')
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput)
    }
  }

  const handleClearSearch = () => {
    setSearchInput('')
    setSearchQuery('')
  }

  // Filter users based on search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) {
      return users
    }

    const query = searchQuery.trim().toLowerCase()

    // Check if query is in quotes (for first name + last name search)
    const quotedMatch = query.match(/^"(.+)"$/)
    if (quotedMatch) {
      const nameQuery = quotedMatch[1].toLowerCase()
      return users.filter((user) => {
        const fullName = `${user.firstname} ${user.lastname}`.toLowerCase()
        return fullName.includes(nameQuery)
      })
    }

    // Search by email, firstname, lastname, or full name
    return users.filter((user) => {
      const email = user.email?.toLowerCase() || ''
      const firstname = user.firstname?.toLowerCase() || ''
      const lastname = user.lastname?.toLowerCase() || ''
      const fullName = `${firstname} ${lastname}`

      return (
        email.includes(query) ||
        firstname.includes(query) ||
        lastname.includes(query) ||
        fullName.includes(query)
      )
    })
  }, [users, searchQuery])

  const handleSubmit = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent default form submission if called from button
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    console.log('[AddRider] handleSubmit called', {
      selectedUser: selectedUser?.user_id,
      date,
      timeRange,
      flightNo,
      airlineIata,
    })

    if (!selectedUser) {
      console.error('[AddRider] No user selected')
      setError('No user selected')
      return
    }

    // Validate required fields
    if (!date || !timeRange) {
      console.error('[AddRider] Missing required fields', { date, timeRange })
      setError('Date and time range are required')
      return
    }

    // Validate and parse time range format (accepts "HH:MM - HH:MM" or "HH:MM-HH:MM")
    let timeRangeParts: string[] = []
    if (timeRange.includes(' - ')) {
      // Format with spaces: "12:00 - 16:00"
      timeRangeParts = timeRange.split(' - ').map((t) => t.trim())
    } else if (timeRange.includes('-')) {
      // Format without spaces: "12:00-16:00"
      timeRangeParts = timeRange.split('-').map((t) => t.trim())
    } else {
      console.error('[AddRider] Invalid time range format', { timeRange })
      setError('Time range must be in format: HH:MM - HH:MM or HH:MM-HH:MM')
      return
    }

    if (timeRangeParts.length !== 2) {
      console.error('[AddRider] Invalid time range format', { timeRange })
      setError('Time range must be in format: HH:MM - HH:MM or HH:MM-HH:MM')
      return
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
    if (
      !timeRegex.test(timeRangeParts[0]) ||
      !timeRegex.test(timeRangeParts[1])
    ) {
      console.error('[AddRider] Invalid time format', { timeRangeParts })
      setError('Times must be in 24-hour format: HH:MM (e.g., 12:00, 16:00)')
      return
    }

    console.log('[AddRider] Starting submission')
    setSubmitting(true)
    setError(null)

    try {
      // Parse time range
      const [earliest, latest] = timeRangeParts

      // Generate random flight number if not provided
      let finalFlightNo = flightNo
      if (!finalFlightNo) {
        console.log('[AddRider] Generating random flight number')
        let attempts = 0
        const maxAttempts = 100

        while (!finalFlightNo && attempts < maxAttempts) {
          // Generate a random 4-digit flight number
          const randomFlightNo = Math.floor(
            1000 + Math.random() * 9000,
          ).toString()

          // Check if this flight number already exists for this user on this date
          const { data: existingFlights, error: checkError } = await supabase
            .from('Flights')
            .select('flight_id, flight_no')
            .eq('user_id', selectedUser.user_id)
            .eq('flight_no', randomFlightNo)
            .eq('date', date)

          if (checkError) {
            console.error(
              '[AddRider] Error checking for duplicate flight number:',
              checkError,
            )
            // If check fails, use the random number anyway
            finalFlightNo = randomFlightNo
            break
          }

          if (!existingFlights || existingFlights.length === 0) {
            // Flight number is available
            finalFlightNo = randomFlightNo
            console.log(
              '[AddRider] Generated unique flight number:',
              finalFlightNo,
            )
            break
          }

          attempts++
        }

        if (!finalFlightNo) {
          setError(
            'Failed to generate unique flight number. Please try again or provide a flight number.',
          )
          setSubmitting(false)
          return
        }
      }

      // Check for duplicate flight number if flight_no is provided
      if (finalFlightNo) {
        const { data: existingFlights, error: checkError } = await supabase
          .from('Flights')
          .select('flight_id, flight_no, airline_iata, date, user_id')
          .eq('user_id', selectedUser.user_id)
          .eq('flight_no', finalFlightNo)
          .eq('date', date)

        if (checkError) {
          console.error('Error checking for duplicates:', checkError)
          setError('Error checking for duplicate flights')
          setSubmitting(false)
          return
        }

        if (existingFlights && existingFlights.length > 0) {
          // If airline_iata is also provided, check if it matches
          if (airlineIata) {
            const exactMatch = existingFlights.find(
              (f) => f.airline_iata === airlineIata.toUpperCase(),
            )
            if (exactMatch) {
              setError(
                `Flight ${airlineIata.toUpperCase()} ${finalFlightNo} already exists for this user on ${date}`,
              )
              setSubmitting(false)
              return
            }
          } else {
            // If no airline code provided but flight number exists, warn
            setError(
              `Flight number ${finalFlightNo} already exists for this user on ${date}. Please provide an airline code if this is a different flight.`,
            )
            setSubmitting(false)
            return
          }
        }
      }

      // Insert flight
      const { data: flightData, error: flightError } = await supabase
        .from('Flights')
        .insert({
          user_id: selectedUser.user_id,
          flight_no: finalFlightNo,
          airline_iata: airlineIata || null,
          airport: airport || 'LAX',
          to_airport: toAirport,
          date: date,
          earliest_time: earliest,
          latest_time: latest,
          bag_no: checkedBags,
          bag_no_large: checkedBags,
          bag_no_personal: carryOnBags,
          matched: false,
          opt_in: true, // Default to opted in for unmatched
        })
        .select('flight_id')
        .single()

      if (flightError) {
        console.error('Error creating flight:', flightError)
        setError(
          `Failed to create flight: ${flightError.message || 'Unknown error'}`,
        )
        setSubmitting(false)
        return
      }

      if (!flightData) {
        setError('Flight was created but no data was returned')
        setSubmitting(false)
        return
      }

      // Log to ChangeLog for unmatched rider
      if (logToChangeLog && flightData) {
        try {
          const flightIdentifier =
            airlineIata && flightNo
              ? `${airlineIata.toUpperCase()} ${flightNo}`
              : flightNo
                ? `Flight ${flightNo}`
                : 'Flight (no number)'

          await logToChangeLog(
            'ADD_FLIGHT',
            {
              action_description: `Added new unmatched rider: ${selectedUser.firstname} ${selectedUser.lastname} with ${flightIdentifier} on ${date}`,
              rider_name: `${selectedUser.firstname} ${selectedUser.lastname}`,
              rider_user_id: selectedUser.user_id,
              rider_flight_id: flightData.flight_id,
              flight_id: flightData.flight_id,
              date: date,
              flight_no: finalFlightNo,
              airline_iata: airlineIata || null,
              airport: airport || 'LAX',
              to_airport: toAirport,
              earliest_time: earliest,
              latest_time: latest,
              source: 'manual_add',
              school: selectedUser.school,
              is_unmatched: true,
            },
            undefined, // No target_group_id for new flights
            selectedUser.user_id,
          )
        } catch (logError) {
          console.error('Error logging to ChangeLog:', logError)
          // Don't fail the operation if ChangeLog fails, but show a warning
          setError(
            'Flight created successfully, but failed to log to ChangeLog. Please refresh the page.',
          )
        }
      }

      console.log('[AddRider] Flight created successfully', { flightData })

      // Success - reset and close
      resetForm()
      console.log('[AddRider] Calling onSuccess and onClose')
      onSuccess?.()
      onClose()
    } catch (err: any) {
      console.error('[AddRider] Error submitting flight:', err)
      console.error('[AddRider] Error details:', {
        message: err?.message,
        stack: err?.stack,
        error: err,
      })
      setError(
        `Failed to create flight: ${err?.message || 'Unknown error occurred'}`,
      )
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setStep('select-school')
    setSelectedSchool('')
    setSelectedUser(null)
    setUsers([])
    setSearchInput('')
    setSearchQuery('')
    setFlightNo('')
    setAirlineIata('')
    setAirport('')
    setToAirport(true)
    setDate('')
    setTimeRange('')
    setCheckedBags(0)
    setCarryOnBags(0)
    setError(null)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Add New Rider</h2>
          <button
            onClick={handleClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Step 1: Select School */}
          {step === 'select-school' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="h-5 w-5" />
                <h3 className="text-lg font-medium">Step 1: Select School</h3>
              </div>
              <p className="text-sm text-gray-600">
                Choose the school to find users from
              </p>
              {loading ? (
                <div className="py-8 text-center text-gray-500">
                  Loading schools...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                  {schools.map((school) => (
                    <button
                      key={school}
                      onClick={() => handleSchoolSelect(school)}
                      className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:border-gray-400 hover:bg-gray-50"
                    >
                      {school}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Select User */}
          {step === 'select-user' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <User className="h-5 w-5" />
                <h3 className="text-lg font-medium">
                  Step 2: Select Person from {selectedSchool}
                </h3>
              </div>
              <button
                onClick={() => {
                  setStep('select-school')
                  setSelectedSchool('')
                  setSearchInput('')
                  setSearchQuery('')
                }}
                className="text-sm text-gray-600 underline hover:text-gray-900"
              >
                ← Change school
              </button>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder='Search by email, name, or "First Last" (in quotes) - Press Enter'
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm text-gray-900 placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                {searchInput && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {loading ? (
                <div className="py-8 text-center text-gray-500">
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No users found for this school
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  No users match your search
                </div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto">
                  {filteredUsers.map((user) => (
                    <button
                      key={user.user_id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-left transition-colors hover:border-gray-400 hover:bg-gray-50"
                    >
                      <div className="font-medium text-gray-900">
                        {user.firstname} {user.lastname}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {user.email}
                      </div>
                      {user.phonenumber && (
                        <div className="mt-1 text-xs text-gray-500">
                          {user.phonenumber}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Flight Information */}
          {step === 'flight-info' && selectedUser && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Plane className="h-5 w-5" />
                <h3 className="text-lg font-medium">
                  Step 3: Flight Information for {selectedUser.firstname}{' '}
                  {selectedUser.lastname}
                </h3>
              </div>
              <button
                onClick={() => {
                  setStep('select-user')
                  setSelectedUser(null)
                }}
                className="text-sm text-gray-600 underline hover:text-gray-900"
              >
                ← Change person
              </button>

              <div className="space-y-4">
                {/* Date - Required */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Time Range - Required */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Time Range (HH:MM - HH:MM){' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    placeholder="09:00 - 12:00"
                    required
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Format: HH:MM - HH:MM (24-hour format)
                  </p>
                </div>

                {/* Flight Number - Optional */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Flight Number
                  </label>
                  <input
                    type="text"
                    value={flightNo}
                    onChange={(e) => setFlightNo(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Airline Code - Optional */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Airline Code (IATA)
                  </label>
                  <input
                    type="text"
                    value={airlineIata}
                    onChange={(e) =>
                      setAirlineIata(e.target.value.toUpperCase())
                    }
                    maxLength={10}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Airport - Optional */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Airport
                  </label>
                  <input
                    type="text"
                    value={airport}
                    onChange={(e) => setAirport(e.target.value)}
                    placeholder="LAX"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                {/* Direction - Optional */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Direction
                  </label>
                  <select
                    value={toAirport ? 'to' : 'from'}
                    onChange={(e) => setToAirport(e.target.value === 'to')}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  >
                    <option value="to">To Airport</option>
                    <option value="from">From Airport</option>
                  </select>
                </div>

                {/* Bags - Optional */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Checked Bags
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={checkedBags}
                      onChange={(e) =>
                        setCheckedBags(parseInt(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Carry-On Bags
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={carryOnBags}
                      onChange={(e) =>
                        setCarryOnBags(parseInt(e.target.value) || 0)
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            onClick={handleClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          {step === 'flight-info' && (
            <button
              type="button"
              onClick={(e) => {
                console.log('[AddRider] Create Flight button clicked', {
                  submitting,
                  date,
                  timeRange,
                  disabled: submitting || !date || !timeRange,
                })
                handleSubmit(e)
              }}
              disabled={submitting || !date || !timeRange}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Adding...' : 'Create Flight'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
