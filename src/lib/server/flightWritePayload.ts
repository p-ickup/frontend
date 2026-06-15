import 'server-only'

import {
  getFlightDateBounds,
  isSupportedAirport,
  isValidFlightTime,
  MAX_BAG_COUNT,
  MAX_TERMINAL_LENGTH,
  validateAirlineCode,
} from '@/utils/flightValidation'

export type FlightWritePayload = {
  to_airport?: boolean
  airport?: string
  flight_no?: number
  airline_iata?: string
  date?: string
  bag_no_personal?: number
  bag_no?: number
  bag_no_large?: number
  earliest_time?: string
  latest_time?: string
  opt_in?: boolean
  terminal?: string
}

type FlightPayloadError = Error & {
  status?: number
  code?: string
  field?: string
}

const createFlightPayloadError = (
  message: string,
  code = 'INVALID_FLIGHT_PAYLOAD',
  field?: string,
): FlightPayloadError => {
  const error = new Error(message) as FlightPayloadError
  error.status = 400
  error.code = code
  error.field = field
  return error
}

const FIELD_LABELS: Record<keyof FlightWritePayload, string> = {
  to_airport: 'Trip direction',
  airport: 'Airport',
  flight_no: 'Flight number',
  airline_iata: 'Airline code',
  date: 'Flight date',
  bag_no_personal: 'Personal item count',
  bag_no: 'Carry-on bag count',
  bag_no_large: 'Checked bag count',
  earliest_time: 'Earliest time',
  latest_time: 'Latest time',
  opt_in: 'Unmatched-flight opt-in',
  terminal: 'Terminal',
}

const ALLOWED_FIELDS = new Set(Object.keys(FIELD_LABELS))
const REQUIRED_CREATE_FIELDS: (keyof FlightWritePayload)[] = [
  'to_airport',
  'airport',
  'flight_no',
  'airline_iata',
  'date',
  'bag_no_personal',
  'bag_no',
  'bag_no_large',
  'earliest_time',
  'latest_time',
]
const BAG_FIELDS = ['bag_no_personal', 'bag_no', 'bag_no_large'] as const
const TIME_FIELDS = ['earliest_time', 'latest_time'] as const

const asTrimmedString = (
  value: unknown,
  field: string,
  {
    uppercase = false,
  }: {
    uppercase?: boolean
  } = {},
) => {
  if (typeof value !== 'string') {
    throw createFlightPayloadError(`${field} must be a string.`)
  }

  const trimmed = value.trim()
  return uppercase ? trimmed.toUpperCase() : trimmed
}

const asBoolean = (value: unknown, field: string) => {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true') return true
    if (normalized === 'false') return false
  }

  throw createFlightPayloadError(`${field} must be a boolean.`)
}

const asInteger = (
  value: unknown,
  field: keyof FlightWritePayload,
  min: number,
  max: number,
) => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN

  if (
    !Number.isInteger(numericValue) ||
    numericValue < min ||
    numericValue > max
  ) {
    throw createFlightPayloadError(
      `${FIELD_LABELS[field]} must be an integer from ${min} to ${max}.`,
      'OUT_OF_RANGE',
      field,
    )
  }

  return numericValue
}

export const normalizeFlightWritePayload = (
  payload: Record<string, unknown>,
  {
    mode = 'update',
    now = new Date(),
  }: {
    mode?: 'create' | 'update'
    now?: Date
  } = {},
): FlightWritePayload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createFlightPayloadError('Flight payload must be an object.')
  }

  const unknownField = Object.keys(payload).find(
    (field) => !ALLOWED_FIELDS.has(field),
  )
  if (unknownField) {
    throw createFlightPayloadError(
      `Unsupported flight field: ${unknownField}.`,
      'UNSUPPORTED_FIELD',
      unknownField,
    )
  }

  if (mode === 'create') {
    const missingField = REQUIRED_CREATE_FIELDS.find(
      (field) =>
        !(field in payload) || payload[field] === null || payload[field] === '',
    )
    if (missingField) {
      throw createFlightPayloadError(
        `${FIELD_LABELS[missingField]} is required.`,
        'REQUIRED_FIELD',
        missingField,
      )
    }
  }

  const normalized: FlightWritePayload = {}

  if ('to_airport' in payload && payload.to_airport != null) {
    normalized.to_airport = asBoolean(payload.to_airport, 'to_airport')
  }

  if ('airport' in payload && payload.airport != null) {
    normalized.airport = asTrimmedString(payload.airport, 'airport', {
      uppercase: true,
    })
    if (!isSupportedAirport(normalized.airport)) {
      throw createFlightPayloadError(
        'Airport must be LAX or ONT.',
        'UNSUPPORTED_AIRPORT',
        'airport',
      )
    }
  }

  if ('flight_no' in payload && payload.flight_no != null) {
    normalized.flight_no = asInteger(payload.flight_no, 'flight_no', 1, 9999)
  }

  if ('airline_iata' in payload && payload.airline_iata != null) {
    normalized.airline_iata = asTrimmedString(
      payload.airline_iata,
      'airline_iata',
      {
        uppercase: true,
      },
    )
    if (!validateAirlineCode(normalized.airline_iata).isValid) {
      throw createFlightPayloadError(
        'Airline code must be exactly two letters or numbers and include at least one letter.',
        'INVALID_AIRLINE_CODE',
        'airline_iata',
      )
    }
  }

  if ('date' in payload && payload.date != null) {
    normalized.date = asTrimmedString(payload.date, 'date')
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized.date)
    if (!match) {
      throw createFlightPayloadError(
        'Flight date must use YYYY-MM-DD format.',
        'INVALID_DATE_FORMAT',
        'date',
      )
    }
    const [, year, month, day] = match
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day)),
    )
    if (parsed.toISOString().slice(0, 10) !== normalized.date) {
      throw createFlightPayloadError(
        'Flight date must be a real calendar date.',
        'INVALID_CALENDAR_DATE',
        'date',
      )
    }
    const bounds = getFlightDateBounds(now)
    if (normalized.date < bounds.min || normalized.date > bounds.max) {
      throw createFlightPayloadError(
        `Flight date must be between ${bounds.min} and ${bounds.max}.`,
        'DATE_OUT_OF_RANGE',
        'date',
      )
    }
  }

  for (const field of BAG_FIELDS) {
    if (payload[field] != null) {
      normalized[field] = asInteger(payload[field], field, 0, MAX_BAG_COUNT)
    }
  }

  for (const field of TIME_FIELDS) {
    if (payload[field] != null) {
      const value = asTrimmedString(payload[field], field)
      if (!isValidFlightTime(value)) {
        throw createFlightPayloadError(
          `${FIELD_LABELS[field]} must use 24-hour HH:MM format.`,
          'INVALID_TIME',
          field,
        )
      }
      normalized[field] = value
    }
  }

  if ('opt_in' in payload && payload.opt_in != null) {
    normalized.opt_in = asBoolean(payload.opt_in, 'opt_in')
  }

  if ('terminal' in payload && payload.terminal != null) {
    normalized.terminal = asTrimmedString(payload.terminal, 'terminal')
    if (
      normalized.terminal.length > MAX_TERMINAL_LENGTH ||
      /[\u0000-\u001f\u007f]/.test(normalized.terminal)
    ) {
      throw createFlightPayloadError(
        `Terminal must be ${MAX_TERMINAL_LENGTH} characters or fewer and cannot contain control characters.`,
        'INVALID_TERMINAL',
        'terminal',
      )
    }
  }

  return normalized
}
