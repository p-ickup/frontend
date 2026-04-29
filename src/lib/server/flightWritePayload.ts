import 'server-only'

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
}

const createFlightPayloadError = (message: string): FlightPayloadError => {
  const error = new Error(message) as FlightPayloadError
  error.status = 400
  return error
}

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

const asNonNegativeInteger = (value: unknown, field: string) => {
  const numericValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : Number.NaN

  if (!Number.isInteger(numericValue) || numericValue < 0) {
    throw createFlightPayloadError(`${field} must be a non-negative integer.`)
  }

  return numericValue
}

export const normalizeFlightWritePayload = (
  payload: Record<string, unknown>,
): FlightWritePayload => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw createFlightPayloadError('Flight payload must be an object.')
  }

  const normalized: FlightWritePayload = {}

  if ('to_airport' in payload && payload.to_airport != null) {
    normalized.to_airport = asBoolean(payload.to_airport, 'to_airport')
  }

  if ('airport' in payload && payload.airport != null) {
    normalized.airport = asTrimmedString(payload.airport, 'airport', {
      uppercase: true,
    })
  }

  if ('flight_no' in payload && payload.flight_no != null) {
    normalized.flight_no = asNonNegativeInteger(payload.flight_no, 'flight_no')
  }

  if ('airline_iata' in payload && payload.airline_iata != null) {
    normalized.airline_iata = asTrimmedString(
      payload.airline_iata,
      'airline_iata',
      {
        uppercase: true,
      },
    )
  }

  if ('date' in payload && payload.date != null) {
    normalized.date = asTrimmedString(payload.date, 'date')
  }

  if ('bag_no_personal' in payload && payload.bag_no_personal != null) {
    normalized.bag_no_personal = asNonNegativeInteger(
      payload.bag_no_personal,
      'bag_no_personal',
    )
  }

  if ('bag_no' in payload && payload.bag_no != null) {
    normalized.bag_no = asNonNegativeInteger(payload.bag_no, 'bag_no')
  }

  if ('bag_no_large' in payload && payload.bag_no_large != null) {
    normalized.bag_no_large = asNonNegativeInteger(
      payload.bag_no_large,
      'bag_no_large',
    )
  }

  if ('earliest_time' in payload && payload.earliest_time != null) {
    normalized.earliest_time = asTrimmedString(
      payload.earliest_time,
      'earliest_time',
    )
  }

  if ('latest_time' in payload && payload.latest_time != null) {
    normalized.latest_time = asTrimmedString(payload.latest_time, 'latest_time')
  }

  if ('opt_in' in payload && payload.opt_in != null) {
    normalized.opt_in = asBoolean(payload.opt_in, 'opt_in')
  }

  if ('terminal' in payload && payload.terminal != null) {
    normalized.terminal = asTrimmedString(payload.terminal, 'terminal')
  }

  return normalized
}
