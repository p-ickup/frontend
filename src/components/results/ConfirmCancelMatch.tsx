'use client'

import Link from 'next/link'

interface ConfirmCancelMatchProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isDeleting?: boolean
}

export default function ConfirmCancelMatch({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}: ConfirmCancelMatchProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="text-xl font-semibold text-gray-800">Cancel Match</h2>
        <p className="mt-2 text-gray-600">
          Are you sure you want to cancel this match? This will remove you from
          your ride group.
        </p>

        {/* Fee policy reminder */}
        <div className="mt-4 rounded-lg border-2 border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-900">Fee policy reminder</p>
          <ul className="mt-2 space-y-1 text-sm text-amber-800">
            <li>
              • Cancellations after the matching deadline may incur a fee ($8
              ONT / $20 LAX).
            </li>
            <li>
              • To avoid a no-show fee ($15 ONT / $40 LAX), you must notify
              RideLink at least 1 hour before your scheduled ride.
            </li>
            <li>
              • Cancelling here counts as proper notification to RideLink.
            </li>
          </ul>
          <Link
            href="/aspc-fees"
            className="mt-2 inline-block text-sm font-medium text-amber-700 underline hover:text-amber-900"
          >
            View full fee policy
          </Link>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Keep Match
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isDeleting ? 'Cancelling...' : 'Yes, Cancel Match'}
          </button>
        </div>
      </div>
    </div>
  )
}
