'use client'

import { useState, useEffect } from 'react'
import type { DelayFormNewFlight } from './types'

export interface NewFlightTimeRange {
  earliest: string
  latest: string
}

interface NewFlightStepProps {
  defaultDate: string
  newFlight: DelayFormNewFlight | null
  onContinue: (
    flight: DelayFormNewFlight,
    timeRange?: NewFlightTimeRange,
  ) => void
}

export default function NewFlightStep({
  defaultDate,
  newFlight,
  onContinue,
}: NewFlightStepProps) {
  const [airport, setAirport] = useState(newFlight?.airport ?? '')
  const [flightNo, setFlightNo] = useState(newFlight?.flight_no ?? '')
  const [date, setDate] = useState(newFlight?.date ?? defaultDate)
  const [time, setTime] = useState(newFlight?.time ?? '')
  const [timeEarliest, setTimeEarliest] = useState('')
  const [timeLatest, setTimeLatest] = useState('')

  const dateChanged = Boolean(defaultDate && date && date !== defaultDate)

  useEffect(() => {
    if (newFlight) {
      setAirport(newFlight.airport)
      setFlightNo(newFlight.flight_no)
      setDate(newFlight.date)
      setTime(newFlight.time)
      if (newFlight.date !== defaultDate) {
        setTimeEarliest(newFlight.time)
        setTimeLatest(newFlight.time)
      }
    } else {
      setDate(defaultDate)
    }
  }, [newFlight, defaultDate])

  const buildFlight = (): {
    flight: DelayFormNewFlight
    timeRange?: NewFlightTimeRange
  } | null => {
    if (!airport.trim() || !flightNo.trim() || !date) return null
    if (dateChanged) {
      if (!timeEarliest || !timeLatest) return null
      return {
        flight: {
          airport: airport.trim(),
          flight_no: flightNo.trim(),
          date,
          time: timeEarliest,
        },
        timeRange: { earliest: timeEarliest, latest: timeLatest },
      }
    }
    if (!time) return null
    return {
      flight: {
        airport: airport.trim(),
        flight_no: flightNo.trim(),
        date,
        time,
      },
    }
  }

  const isFilled = dateChanged
    ? Boolean(
        airport.trim() && flightNo.trim() && date && timeEarliest && timeLatest,
      )
    : Boolean(airport.trim() && flightNo.trim() && date && time)

  const handleContinue = () => {
    const result = buildFlight()
    if (!result) return
    onContinue(result.flight, result.timeRange)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
        2. Your new flight details
      </h2>

      <p className="text-sm text-gray-600">
        Your flight changed — enter the updated flight information below.
      </p>

      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
            Airline code (IATA)
          </span>
          <input
            type="text"
            value={airport}
            onChange={(e) =>
              setAirport(e.target.value.toUpperCase().slice(0, 3))
            }
            placeholder="e.g. AA"
            maxLength={3}
            className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
            Flight number
          </span>
          <input
            type="text"
            value={flightNo}
            onChange={(e) => setFlightNo(e.target.value)}
            placeholder="e.g. 123"
            className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            required
          />
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
              Date
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              required
            />
          </label>
          {!dateChanged ? (
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                Time
              </span>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </label>
          ) : null}
        </div>

        {dateChanged && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                Earliest Pickup Time
              </span>
              <input
                type="time"
                value={timeEarliest}
                onChange={(e) => setTimeEarliest(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                Latest Pickup Time
              </span>
              <input
                type="time"
                value={timeLatest}
                onChange={(e) => setTimeLatest(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </label>
          </div>
        )}
        <button
          type="button"
          onClick={handleContinue}
          disabled={!isFilled}
          className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 font-semibold text-white shadow-md transition hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
