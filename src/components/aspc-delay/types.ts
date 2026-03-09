/** Current flight shown on step 1 (from Matches + Flights for this ride) */
export interface DelayFormCurrentFlight {
  airport: string
  to_airport: boolean
  date: string
  flight_no: string
  airline_iata: string
  earliest_time?: string
  latest_time?: string
}

/** New flight info when user says "it changed" */
export interface DelayFormNewFlight {
  airport: string
  flight_no: string
  date: string
  time: string
}

export type DelayReasonKey =
  | 'airline_delay'
  | 'missed_connection'
  | 'baggage_delay'
  | 'custom'

/** Value stored in matches.reason_for_delay */
export const REASON_FOR_DELAY_LABELS: Record<DelayReasonKey, string> = {
  airline_delay: 'Airline Delay',
  missed_connection: 'Missed Connection',
  baggage_delay: 'Baggage delay',
  custom: 'Custom Delay', // actual value will be "Custom Delay: \"user text\""
}

export interface AspcDelayFormState {
  step: 0 | 1 | 2 | 3
  flightUnchanged: boolean | null
  newFlight: DelayFormNewFlight | null
  reasonForDelay: DelayReasonKey | null
  customReasonText: string
  newEtaDate: string
  newEtaTime: string
  /** When delay is on a different day, use time range instead of single time */
  newEtaTimeEarliest: string
  newEtaTimeLatest: string
}
