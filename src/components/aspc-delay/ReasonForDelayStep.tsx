'use client'

import { useState } from 'react'
import type { DelayReasonKey } from './types'
import { REASON_FOR_DELAY_LABELS } from './types'

const REASON_DESCRIPTIONS: Record<DelayReasonKey, string> = {
  airline_delay: 'Flight delayed by airline',
  missed_connection: 'Missed a connecting flight',
  baggage_delay: 'Waiting for luggage',
  custom: 'Other — enter your reason below',
}

const ReasonIcon = ({ reason }: { reason: DelayReasonKey }) => {
  const className = 'h-6 w-6 shrink-0 text-teal-600 sm:h-7 sm:w-7'
  switch (reason) {
    case 'airline_delay':
      return (
        <svg
          className={className}
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
      )
    case 'missed_connection':
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
          />
        </svg>
      )
    case 'baggage_delay':
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      )
    case 'custom':
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    default:
      return null
  }
}

interface ReasonForDelayStepProps {
  selectedReason: DelayReasonKey | null
  customReasonText: string
  onSelect: (reason: DelayReasonKey) => void
  onCustomTextChange: (text: string) => void
  onContinue: () => void
}

export default function ReasonForDelayStep({
  selectedReason,
  customReasonText,
  onSelect,
  onCustomTextChange,
  onContinue,
}: ReasonForDelayStepProps) {
  const [showCustomInput, setShowCustomInput] = useState(
    selectedReason === 'custom',
  )

  const handleSelect = (reason: DelayReasonKey) => {
    onSelect(reason)
    if (reason === 'custom') setShowCustomInput(true)
    else setShowCustomInput(false)
  }

  const canContinue =
    selectedReason &&
    (selectedReason !== 'custom' || customReasonText.trim().length > 0)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800 sm:text-xl">
        3. Reason for delay
      </h2>

      <p className="text-sm text-gray-600">
        Select the reason that best describes your delay.
      </p>

      <div className="space-y-3">
        {(
          [
            'airline_delay',
            'missed_connection',
            'baggage_delay',
            'custom',
          ] as const
        ).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => handleSelect(key)}
            className={`flex w-full flex-col gap-1 rounded-xl border-2 p-4 text-left transition sm:flex-row sm:items-center sm:gap-4 ${
              selectedReason === key
                ? 'border-teal-500 bg-teal-50/80 shadow-md'
                : 'border-gray-200 bg-white/60 hover:border-gray-300 hover:bg-white/80'
            }`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-100 sm:h-12 sm:w-12">
              <ReasonIcon reason={key} />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="font-semibold text-gray-900">
                {REASON_FOR_DELAY_LABELS[key]}
              </span>
              <span className="text-sm text-gray-600">
                {REASON_DESCRIPTIONS[key]}
              </span>
            </span>
          </button>
        ))}
      </div>

      {showCustomInput && (
        <div className="rounded-xl border border-gray-200 bg-white/60 p-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-gray-700">
              Custom reason
            </span>
            <textarea
              value={customReasonText}
              onChange={(e) => onCustomTextChange(e.target.value)}
              placeholder="Describe your delay..."
              rows={3}
              className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </label>
        </div>
      )}

      {canContinue && (
        <button
          type="button"
          onClick={onContinue}
          className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-3 font-semibold text-white shadow-md transition hover:from-teal-600 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
        >
          Continue
        </button>
      )}
    </div>
  )
}
