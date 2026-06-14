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

  // Must be exactly 2 characters
  if (cleanInput.length !== 2) {
    return {
      isValid: false,
      errorMessage: 'Airline code must be exactly 2 characters',
    }
  }

  // Must be alphanumeric
  if (!/^[A-Z0-9]{2}$/.test(cleanInput)) {
    return {
      isValid: false,
      errorMessage: 'Airline code must contain only letters and numbers',
    }
  }

  // Must have at least one letter
  if (!/[A-Z]/.test(cleanInput)) {
    return {
      isValid: false,
      errorMessage: 'Airline code must contain at least one letter',
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
