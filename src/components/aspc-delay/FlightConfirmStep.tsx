'use client'

import type { DelayFormCurrentFlight } from './types'

interface FlightConfirmStepProps {
  currentFlight: DelayFormCurrentFlight | null
  onConfirmSame: () => void
  onConfirmChanged: () => void
}

export default function FlightConfirmStep({
  currentFlight,
  onConfirmSame,
  onConfirmChanged,
}: FlightConfirmStepProps) {
  const direction = currentFlight?.to_airport
    ? 'Departing (School → Airport)'
    : 'Arriving (Airport → School)'
  const displayDate = currentFlight?.date
    ? new Date(currentFlight.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
        1. Confirm your flight
      </h2>

      {currentFlight && (
        <div className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white/60 p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100 sm:h-14 sm:w-14">
              <svg
                className="h-6 w-6 text-teal-600 sm:h-8 sm:w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-gray-900">
                {currentFlight.airline_iata} {currentFlight.flight_no}
              </p>
              <p className="text-sm text-gray-600">{direction}</p>
              <p className="mt-1 text-sm text-gray-500">
                {currentFlight.airport} · {displayDate}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4">
            <button
              type="button"
              onClick={onConfirmSame}
              className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 font-semibold text-white shadow-md transition-all hover:from-teal-600 hover:to-teal-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-teal-500/50"
            >
              Yes, it is still my flight
            </button>
            <button
              type="button"
              onClick={onConfirmChanged}
              className="flex-1 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 font-semibold text-amber-800 transition hover:border-amber-500 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            >
              No, it changed
            </button>
          </div>
        </div>
      )}

      {!currentFlight && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Unable to load your flight. Please go back to Results and try again.
        </p>
      )}
    </div>
  )
}
