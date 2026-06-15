/**
 * Flight validation utilities for separate airline code and flight number inputs
 */

export interface AirlineCodeValidationResult {
  isValid: boolean
  errorMessage?: string
}

export interface FlightNumberValidationResult {
  isValid: boolean
  errorMessage?: string
}

const FLIGHT_DATE_WINDOW_DAYS = 365
export const MAX_BAG_COUNT = 10
export const MAX_TERMINAL_LENGTH = 50
export const SUPPORTED_AIRPORTS = ['LAX', 'ONT'] as const
export const isSupportedAirport = (value: string) =>
  SUPPORTED_AIRPORTS.includes(value as (typeof SUPPORTED_AIRPORTS)[number])
export const isValidFlightTime = (value: string) =>
  /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)

const APP_TIME_ZONE = 'America/Los_Angeles'

const formatCalendarDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  )
  return `${values.year}-${values.month}-${values.day}`
}

export const getFlightDateBounds = (now = new Date()) => {
  const today = formatCalendarDate(now)
  const [year, month, day] = today.split('-').map(Number)
  const center = Date.UTC(year, month - 1, day)
  const dayMs = 24 * 60 * 60 * 1000

  return {
    min: new Date(center - FLIGHT_DATE_WINDOW_DAYS * dayMs)
      .toISOString()
      .slice(0, 10),
    max: new Date(center + FLIGHT_DATE_WINDOW_DAYS * dayMs)
      .toISOString()
      .slice(0, 10),
  }
}

/**
 * Validates airline IATA code
 * Format: 2 alphanumeric characters with at least one letter
 * Examples: AA, B6, 9W, UA
 */
export function validateAirlineCode(
  input: string,
): AirlineCodeValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: 'Airline code is required',
    }
  }

  const cleanInput = input.trim().toUpperCase()

  if (!/^(?=.*[A-Z])[A-Z0-9]{2}$/.test(cleanInput)) {
    return {
      isValid: false,
      errorMessage:
        'Airline code must be exactly two letters or numbers and include at least one letter',
    }
  }

  return {
    isValid: true,
  }
}

/**
 * Validates flight number
 * Format: 1-4 digits
 * Examples: 123, 1234, 1, 9999
 */
export function validateFlightNumber(
  input: string,
): FlightNumberValidationResult {
  if (!input || typeof input !== 'string') {
    return {
      isValid: false,
      errorMessage: 'Flight number is required',
    }
  }

  const cleanInput = input.trim()

  // Must be 1-4 digits only
  if (!/^\d{1,4}$/.test(cleanInput)) {
    return {
      isValid: false,
      errorMessage: 'Flight number must be 1-4 digits only',
    }
  }

  return {
    isValid: true,
  }
}

import { isFlightPastDeadline as isFlightPastDeadlineFromPeriods } from '@/config/servicePeriodHelpers'

/**
 * Check if a flight date is past its deadline for requests
 * @param flightDate - Flight date in YYYY-MM-DD format
 * @returns Object with isPastDeadline boolean and optional deadline info
 */
export function isFlightPastDeadline(flightDate: string): {
  isPastDeadline: boolean
  periodName?: string
  deadline?: Date
} {
  return isFlightPastDeadlineFromPeriods(flightDate)
}

/**
 * Check if any flight in a list can still be edited based on its deadline
 * @param flightDate - Flight date in YYYY-MM-DD format
 * @returns true if the flight can still be edited
 */
export function canEditFlight(flightDate: string): boolean {
  const result = isFlightPastDeadline(flightDate)
  return !result.isPastDeadline
}
