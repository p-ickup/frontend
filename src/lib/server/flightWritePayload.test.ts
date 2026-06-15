/** @jest-environment node */

jest.mock('server-only', () => ({}))

import { normalizeFlightWritePayload } from '@/lib/server/flightWritePayload'

const now = new Date('2026-06-15T12:00:00-07:00')
const validPayload = {
  to_airport: true,
  airport: 'LAX',
  flight_no: 123,
  airline_iata: 'AA',
  date: '2026-06-15',
  bag_no_personal: 0,
  bag_no: 1,
  bag_no_large: 2,
  earliest_time: '23:00',
  latest_time: '01:00',
  opt_in: true,
  terminal: 'TBIT',
}

const validateCreate = (overrides: Record<string, unknown> = {}) =>
  normalizeFlightWritePayload(
    { ...validPayload, ...overrides },
    { mode: 'create', now },
  )

describe('flight write validation', () => {
  it('normalizes a complete payload and permits overnight windows', () => {
    expect(
      validateCreate({ airport: ' ont ', airline_iata: 'b6' }),
    ).toMatchObject({
      airport: 'ONT',
      airline_iata: 'B6',
      earliest_time: '23:00',
      latest_time: '01:00',
    })
  })

  it.each([
    ['2026-02-30', 'INVALID_CALENDAR_DATE'],
    ['02/22/2026', 'INVALID_DATE_FORMAT'],
    ['222222-02-22', 'INVALID_DATE_FORMAT'],
    ['9999-02-22', 'DATE_OUT_OF_RANGE'],
    ['2025-06-14', 'DATE_OUT_OF_RANGE'],
    ['2027-06-16', 'DATE_OUT_OF_RANGE'],
  ])('rejects invalid date %s', (date, code) => {
    expect(() => validateCreate({ date })).toThrow(
      expect.objectContaining({ code, field: 'date' }),
    )
  })

  it.each(['2025-06-15', '2027-06-15'])(
    'accepts inclusive date boundary %s',
    (date) => {
      expect(validateCreate({ date }).date).toBe(date)
    },
  )

  it.each([
    ['bag_no_personal', -1],
    ['bag_no', 11],
    ['bag_no_large', 1.5],
    ['bag_no', 'many'],
  ])('rejects invalid %s value %p', (field, bagCount) => {
    expect(() => validateCreate({ [field]: bagCount })).toThrow(
      expect.objectContaining({ code: 'OUT_OF_RANGE', field }),
    )
  })

  it.each([0, 10, '10'])('accepts bag boundary %p', (bagCount) => {
    expect(validateCreate({ bag_no: bagCount }).bag_no).toBe(Number(bagCount))
  })

  it.each([0, 10000, 'AA12'])(
    'rejects invalid flight number %p',
    (flightNumber) => {
      expect(() => validateCreate({ flight_no: flightNumber })).toThrow(
        expect.objectContaining({ field: 'flight_no' }),
      )
    },
  )

  it.each(['A', 'AAA', '12', 'A!'])(
    'rejects invalid airline code %s',
    (airlineCode) => {
      expect(() => validateCreate({ airline_iata: airlineCode })).toThrow(
        expect.objectContaining({
          code: 'INVALID_AIRLINE_CODE',
          field: 'airline_iata',
        }),
      )
    },
  )

  it('rejects unsupported airports and fields', () => {
    expect(() => validateCreate({ airport: 'SFO' })).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_AIRPORT' }),
    )
    expect(() => validateCreate({ matched: true })).toThrow(
      expect.objectContaining({ code: 'UNSUPPORTED_FIELD' }),
    )
  })

  it.each(['9:00', '24:00', '12:60'])('rejects invalid time %s', (time) => {
    expect(() => validateCreate({ earliest_time: time })).toThrow(
      expect.objectContaining({ code: 'INVALID_TIME' }),
    )
  })

  it('enforces required create fields and terminal constraints', () => {
    const { airport: _airport, ...missingAirport } = validPayload
    expect(() =>
      normalizeFlightWritePayload(missingAirport, { mode: 'create', now }),
    ).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }))

    expect(() => validateCreate({ terminal: 'x'.repeat(51) })).toThrow(
      expect.objectContaining({ code: 'INVALID_TERMINAL' }),
    )
  })

  it('allows valid partial updates but validates every supplied field', () => {
    expect(
      normalizeFlightWritePayload(
        { airport: 'ont', bag_no_large: 10 },
        { now },
      ),
    ).toEqual({ airport: 'ONT', bag_no_large: 10 })
  })
})
