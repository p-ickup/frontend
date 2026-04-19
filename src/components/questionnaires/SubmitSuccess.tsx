'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

export type SubmitSuccessVariant = 'success' | 'legal_log_failed'

interface SubmitSuccessProps {
  isOpen: boolean
  onClose: () => void
  route: string
  variant?: SubmitSuccessVariant
  /** Shown when variant is legal_log_failed so support can locate the flight row */
  reportFlightId?: number | null
}

const RIDELINK_EMAIL = 'ridelink@aspc.pomona.edu'

const SubmitSuccess: React.FC<SubmitSuccessProps> = ({
  isOpen,
  onClose,
  route,
  variant = 'success',
  reportFlightId = null,
}) => {
  const router = useRouter()

  if (!isOpen) return null

  const handleOkay = () => {
    onClose()
    router.push(route)
  }

  if (variant === 'legal_log_failed') {
    const idLine =
      reportFlightId != null && Number.isFinite(reportFlightId)
        ? `Please include this flight ID in your email: ${reportFlightId}`
        : 'Please include your name and flight details in your email so we can locate your request.'

    const mailHref =
      reportFlightId != null && Number.isFinite(reportFlightId)
        ? `mailto:${RIDELINK_EMAIL}?subject=${encodeURIComponent(
            `RideLink: T&C log error — flight ${reportFlightId}`,
          )}&body=${encodeURIComponent(
            `Hello,\n\nMy ride request was saved, but the app reported an error logging my acceptance of the Terms & Conditions and Privacy Notice.\n\nFlight ID: ${reportFlightId}\n\n`,
          )}`
        : `mailto:${RIDELINK_EMAIL}?subject=${encodeURIComponent(
            'RideLink: T&C log error',
          )}&body=${encodeURIComponent(
            'Hello,\n\nMy ride request was saved, but the app reported an error logging my acceptance of the Terms & Conditions and Privacy Notice.\n\n',
          )}`

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-gray-800">
            Ride request saved — one more step
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            Your flight details were saved, but we hit an error while recording
            your acceptance of the Terms & Conditions and Privacy Notice in our
            system. That log is required for your records.
          </p>
          <p className="mt-3 text-sm font-medium text-gray-900">{idLine}</p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700">
            Email{' '}
            <a
              href={mailHref}
              className="font-semibold text-teal-700 underline hover:text-teal-900"
            >
              {RIDELINK_EMAIL}
            </a>{' '}
            so we can complete the acceptance log for your account.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleOkay}
              className="rounded-lg bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700"
            >
              Continue to my forms
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
      <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800">
          ✅ Flight details submitted successfully!
        </h2>
        <p className="mt-2 text-gray-600">
          You may edit or delete this form up to 7 days before your requested
          ride share. You will receive an email with your match details at least
          3 days before your requested ride share date.
        </p>

        <div className="mt-4 flex justify-end space-x-4">
          <button
            onClick={handleOkay}
            className="rounded-lg bg-gray-300 px-4 py-2 text-black hover:bg-gray-400"
          >
            Okay
          </button>
        </div>
      </div>
    </div>
  )
}

export default SubmitSuccess
