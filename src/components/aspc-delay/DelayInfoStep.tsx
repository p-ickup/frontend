'use client'

import { useState } from 'react'

interface DelayFormNewFlight {
  airport: string
  flight_no: string
  date: string
  time: string
}

interface DelayInfoStepProps {
  /** When true, user came from "No, it changed" — show new flight summary + Try to look for a new group */
  flightChanged?: boolean
  newFlight?: DelayFormNewFlight | null
  newFlightTimeEarliest?: string
  newFlightTimeLatest?: string
  defaultDate: string
  newEtaDate: string
  newEtaTime: string
  newEtaTimeEarliest: string
  newEtaTimeLatest: string
  /** Show earliest/latest range (e.g. different day OR user changed flight) */
  showTimeRange: boolean
  onDateChange: (date: string) => void
  onTimeChange: (time: string) => void
  onEarliestChange: (time: string) => void
  onLatestChange: (time: string) => void
  onFindNewMatch: () => void
  isFindNewMatchLoading?: boolean
}

export default function DelayInfoStep({
  flightChanged = false,
  newFlight = null,
  newFlightTimeEarliest = '',
  newFlightTimeLatest = '',
  defaultDate,
  newEtaDate,
  newEtaTime,
  newEtaTimeEarliest,
  newEtaTimeLatest,
  onDateChange,
  onTimeChange,
  showTimeRange,
  onEarliestChange,
  onLatestChange,
  onFindNewMatch,
  isFindNewMatchLoading = false,
}: DelayInfoStepProps) {
  const [showModal, setShowModal] = useState(false)

  const isFilled =
    flightChanged ||
    (showTimeRange
      ? Boolean(newEtaDate && newEtaTimeEarliest && newEtaTimeLatest)
      : Boolean(newEtaDate && newEtaTime))

  const handleOpenModal = () => {
    if (!isFilled) return
    setShowModal(true)
  }

  const handleConfirmFindNewMatch = () => {
    setShowModal(false)
    onFindNewMatch()
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
        4. Delay information
      </h2>

      {flightChanged && newFlight ? (
        <>
          <p className="text-sm text-gray-600">
            Here are your new flight details. When you&apos;re ready, we&apos;ll
            remove you from your current group and try to find you a new one.
          </p>
          <div className="rounded-xl border border-gray-200 bg-white/60 p-4 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-teal-100">
                <svg
                  className="h-6 w-6 text-teal-600"
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
                  {newFlight.airport} {newFlight.flight_no}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(newFlight.date + 'T00:00:00').toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    },
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {newFlightTimeEarliest && newFlightTimeLatest
                    ? `${newFlightTimeEarliest} – ${newFlightTimeLatest}`
                    : newFlight.time}
                </p>
              </div>
            </div>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenModal}
              disabled={isFindNewMatchLoading}
              className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 font-semibold text-white shadow-md transition hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isFindNewMatchLoading
                ? 'Processing…'
                : 'Try to look for a new group'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            When do you expect to arrive? We&apos;ll use this to find you a new
            match.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                New estimated date
              </span>
              <input
                type="date"
                value={newEtaDate || defaultDate}
                onChange={(e) => onDateChange(e.target.value)}
                className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                required
              />
            </label>
            {!showTimeRange ? (
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  New estimated time
                </span>
                <input
                  type="time"
                  value={newEtaTime}
                  onChange={(e) => onTimeChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </label>
            ) : null}
          </div>

          {showTimeRange && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Earliest Pickup Time
                </span>
                <input
                  type="time"
                  value={newEtaTimeEarliest}
                  onChange={(e) => onEarliestChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Latest Pickup Time
                </span>
                <input
                  type="time"
                  value={newEtaTimeLatest}
                  onChange={(e) => onLatestChange(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                />
              </label>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={handleOpenModal}
              disabled={!isFilled || isFindNewMatchLoading}
              className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 font-semibold text-white shadow-md transition hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-teal-500 disabled:hover:to-teal-600"
            >
              {isFindNewMatchLoading ? 'Processing…' : 'Find a new Match'}
            </button>
          </div>
        </>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="find-new-match-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h3
              id="find-new-match-title"
              className="mb-3 text-lg font-semibold text-gray-900"
            >
              Find a new match
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              You will be unmatched from your current group and we will try to
              find you a new matching group.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmFindNewMatch}
                disabled={isFindNewMatchLoading}
                className="flex-1 rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 font-semibold text-white transition hover:from-teal-600 hover:to-teal-700 disabled:opacity-50"
              >
                {isFindNewMatchLoading ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
