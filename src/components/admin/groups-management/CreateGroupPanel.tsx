'use client'

import { Briefcase, Calendar, Clock, Flag, Info, Luggage } from 'lucide-react'
import type { CSSProperties } from 'react'

import { useGroupsActionsContext, useGroupsUiContext } from './context'
import {
  calculateBagUnits,
  determineUberType,
  formatTimeRange,
  matchDatetimeFromEarliest,
} from './utils'

export default function CreateGroupPanel() {
  const { createNewGroup, removeRiderFromNewGroup } = useGroupsActionsContext()
  const {
    autoCalculateError,
    errorMessage,
    isCreatingGroup,
    isSubsidized,
    newGroupContingencyVoucher,
    newGroupDate,
    newGroupTime,
    newGroupVoucher,
    selectedRidersForNewGroup,
    setAutoCalculateError,
    setIsSubsidized,
    setNewGroupContingencyVoucher,
    setNewGroupDate,
    setNewGroupTime,
    setNewGroupVoucher,
  } = useGroupsUiContext()

  return (
    <>
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Selected Riders ({selectedRidersForNewGroup.length}/6)
        </label>
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {selectedRidersForNewGroup.length === 0 ? (
            <p className="text-sm text-gray-500">
              No riders selected. Select from Corral or Unmatched.
            </p>
          ) : (
            selectedRidersForNewGroup.map((rider: any) => (
              <div
                key={`${rider.user_id}-${rider.flight_id}`}
                className="flex items-center justify-between rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-gray-900">
                    {rider.name}
                    {rider.original_unmatched && (
                      <span title="Originally unmatched">
                        <Flag className="h-3 w-3 flex-shrink-0 text-amber-500" />
                      </span>
                    )}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="inline-flex items-center justify-center rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                      {rider.to_airport ? 'TO' : 'FROM'} {rider.airport}
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="group relative flex items-center gap-1">
                        <Luggage className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-600">
                          {rider.checked_bags}
                        </span>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          Checked Bags (2 Units Each)
                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                      <div className="group relative flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-600">
                          {rider.carry_on_bags}
                        </span>
                        <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 transform whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
                          Carry-On Bags (1 Unit Each)
                          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{rider.date}</p>
                  <p className="text-xs text-gray-500">
                    {formatTimeRange(rider.time_range)}
                  </p>
                </div>
                <button
                  onClick={() => removeRiderFromNewGroup(rider.flight_id)}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-700">
            Date <span className="text-red-500">*</span>
          </label>
          {selectedRidersForNewGroup.length >= 2 && (
            <div className="flex flex-col items-end">
              <button
                type="button"
                onClick={() => {
                  const calculated = matchDatetimeFromEarliest(
                    selectedRidersForNewGroup,
                  )
                  if (calculated) {
                    setNewGroupDate(calculated.date)
                    const [hours, minutes] = calculated.time.split(':')
                    setNewGroupTime(`${hours}:${minutes || '00'}`)
                    setAutoCalculateError(null)
                  } else {
                    setAutoCalculateError(
                      'No valid time overlap found for selected riders',
                    )
                    setTimeout(() => setAutoCalculateError(null), 3000)
                  }
                }}
                className="text-xs text-teal-600 underline hover:text-teal-800"
              >
                Auto-calculate from riders
              </button>
              {autoCalculateError && (
                <p className="mt-1 text-xs text-red-600">
                  {autoCalculateError}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="relative">
          <input
            type="date"
            value={newGroupDate}
            onChange={(e) => setNewGroupDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            style={
              {
                WebkitAppearance: 'none',
              } as CSSProperties
            }
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget
                .previousElementSibling as HTMLInputElement
              input?.showPicker?.()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
            title="Open calendar"
          >
            <Calendar className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Time <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="time"
            value={newGroupTime}
            onChange={(e) => setNewGroupTime(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-10 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            style={
              {
                WebkitAppearance: 'none',
              } as CSSProperties
            }
          />
          <button
            type="button"
            onClick={(e) => {
              const input = e.currentTarget
                .previousElementSibling as HTMLInputElement
              input?.showPicker?.()
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-teal-600"
            title="Open time picker"
          >
            <Clock className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Group Voucher
        </label>
        <input
          type="text"
          value={newGroupVoucher}
          onChange={(e) => setNewGroupVoucher(e.target.value)}
          placeholder="Optional"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700">
            Contingency Vouchers (per rider)
          </label>
          <div className="group relative">
            <Info className="h-4 w-4 text-gray-400" />
            <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden w-64 -translate-x-1/2 transform rounded bg-gray-900 px-3 py-2 text-xs text-white group-hover:block">
              Enter comma-separated vouchers (one per rider). Order should match
              selected riders. Example: &quot;VOUCHER1, VOUCHER2&quot;
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </div>
        <input
          type="text"
          value={newGroupContingencyVoucher}
          onChange={(e) => setNewGroupContingencyVoucher(e.target.value)}
          placeholder={`Optional (e.g., "VOUCHER1, VOUCHER2" for ${selectedRidersForNewGroup.length} riders)`}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
        />
        {selectedRidersForNewGroup.length > 0 && (
          <p className="mt-1 text-xs text-gray-500">
            {selectedRidersForNewGroup.length} rider
            {selectedRidersForNewGroup.length !== 1 ? 's' : ''} selected
          </p>
        )}
      </div>

      <div className="flex items-center">
        <input
          type="checkbox"
          id="isSubsidized"
          checked={isSubsidized}
          onChange={(e) => setIsSubsidized(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
        />
        <label htmlFor="isSubsidized" className="ml-2 text-sm text-gray-700">
          Is Subsidized
        </label>
      </div>

      {selectedRidersForNewGroup.length > 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 p-3">
          <p className="mb-1 text-xs font-medium text-gray-700">
            Group Preview:
          </p>
          <p className="text-xs text-gray-600">
            Size: {selectedRidersForNewGroup.length} riders
          </p>
          <p className="text-xs text-gray-600">
            Bag Units: {calculateBagUnits(selectedRidersForNewGroup)}
          </p>
          <p className="text-xs text-gray-600">
            Uber Type:{' '}
            {determineUberType(
              selectedRidersForNewGroup.length,
              calculateBagUnits(selectedRidersForNewGroup),
            ) || 'Invalid'}
          </p>
        </div>
      )}

      <button
        onClick={createNewGroup}
        disabled={
          isCreatingGroup ||
          selectedRidersForNewGroup.length < 2 ||
          selectedRidersForNewGroup.length > 6 ||
          !newGroupDate ||
          !newGroupTime
        }
        className="w-full rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:from-teal-600 hover:to-cyan-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isCreatingGroup ? 'Creating...' : 'Create Group'}
      </button>

      {errorMessage && <p className="text-sm text-red-600">{errorMessage}</p>}
    </>
  )
}
