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

/**
 * Convenience function to check if airline code is valid
 */
export function isValidAirlineCode(airlineCode: string): boolean {
  return validateAirlineCode(airlineCode).isValid
}

/**
 * Convenience function to check if flight number is valid
 */
export function isValidFlightNumber(flightNumber: string): boolean {
  return validateFlightNumber(flightNumber).isValid
}

/**
 * Validates both airline code and flight number together
 */
export function validateFlightInfo(
  airlineCode: string,
  flightNumber: string,
): {
  isValid: boolean
  airlineError?: string
  flightNumberError?: string
} {
  const airlineResult = validateAirlineCode(airlineCode)
  const flightResult = validateFlightNumber(flightNumber)

  return {
    isValid: airlineResult.isValid && flightResult.isValid,
    airlineError: airlineResult.errorMessage,
    flightNumberError: flightResult.errorMessage,
  }
}

/**
 * Service periods with their corresponding request deadlines
 */
interface ServicePeriod {
  start: string // YYYY-MM-DD
  end: string // YYYY-MM-DD
  deadline: string // YYYY-MM-DDTHH:MM:SS-08:00 (PST)
  name: string
}

const SERVICE_PERIODS: ServicePeriod[] = [
  // Thanksgiving Break (Combined outbound Nov 21-26 + return Nov 29-Dec 1)
  // With 5-day buffer: Nov 16 - Dec 6
  // Deadline: Nov 14 @ 11:59 PM PT
  {
    start: '2025-11-16', // 5 days before Nov 21
    end: '2025-12-01', // 0 days after Dec 1
    deadline: '2025-11-14T23:59:59-08:00',
    name: 'Thanksgiving Break',
  },
  // Winter Break Outbound (Dec 9-13)
  // With 5-day buffer: Dec 4 - Dec 18
  // Deadline: Dec 3 @ 11:59 PM PT
  {
    start: '2025-12-02', // 5 days before Dec 9
    end: '2025-12-18', // 5 days after Dec 13
    deadline: '2025-12-03T23:59:59-08:00',
    name: 'Winter Break (Outbound)',
  },
  // Winter Break Return (Jan 17-21)
  // With 5-day buffer: Jan 12 - Jan 26
  // Deadline: Jan 9 @ 11:59 PM PT
  {
    start: '2026-01-12', // 5 days before Jan 17
    end: '2026-01-26', // 5 days after Jan 21
    deadline: '2026-01-09T23:59:59-08:00',
    name: 'Winter Break (Return)',
  },
]

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
  if (!flightDate) {
    return { isPastDeadline: false }
  }

  const flight = new Date(flightDate)
  flight.setHours(0, 0, 0, 0)

  // Find the service period this flight falls into
  for (const period of SERVICE_PERIODS) {
    const periodStart = new Date(period.start)
    const periodEnd = new Date(period.end)
    periodStart.setHours(0, 0, 0, 0)
    periodEnd.setHours(23, 59, 59, 999)

    // Check if flight date is within this service period
    if (flight >= periodStart && flight <= periodEnd) {
      const deadlineDate = new Date(period.deadline)
      const now = new Date()

      return {
        isPastDeadline: now > deadlineDate,
        periodName: period.name,
        deadline: deadlineDate,
      }
    }
  }

  // If flight date doesn't match any service period, it's not eligible
  // (but we'll allow it - just no deadline enforcement)
  return { isPastDeadline: false }
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
