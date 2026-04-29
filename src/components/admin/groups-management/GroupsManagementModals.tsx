'use client'

import { Clock, Lock, Unlock } from 'lucide-react'

import AddRider from '../AddRider'
import { useGroupsActionsContext, useGroupsUiContext } from './context'
import {
  calculateBagUnits,
  calculateGroupTimeRange,
  formatTime,
  formatTimeRange,
  formatVoucher,
} from './utils'

export default function GroupsManagementModals() {
  const {
    closeDeleteGroupConfirmation,
    closeEditRider,
    closeEditTime,
    closeEditVoucher,
    fetchData,
    handleSaveGroupOverrides,
    handleUpdateGroupTime,
    handleUpdateGroupVoucher,
    handleUpdateRider,
    logToChangeLog,
  } = useGroupsActionsContext()
  const {
    deleteGroupConfirmation,
    editDateValue,
    editGroupOverridesModal,
    editRiderForm,
    editRiderModal,
    editTimeModal,
    editTimeValue,
    editVoucherModal,
    editVoucherValue,
    isAddRiderOpen,
    isUpdatingOverrides,
    isUpdatingRider,
    isUpdatingTime,
    isUpdatingVoucher,
    overrideSubsidized,
    overrideUberType,
    setDraggedRider,
    setEditDateValue,
    setEditGroupOverridesModal,
    setEditRiderForm,
    setEditTimeValue,
    setEditVoucherValue,
    setErrorMessage,
    setIsAddRiderOpen,
    setOverrideSubsidized,
    setOverrideUberType,
    setTimeConflictModal,
    timeConflictModal,
    validationErrorModal,
  } = useGroupsUiContext()

  return (
    <>
      {deleteGroupConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Delete Group?
            </h3>
            <p className="mb-6 text-sm text-gray-600">
              By deleting the last person from the group, the group will be
              deleted.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeDeleteGroupConfirmation}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await deleteGroupConfirmation.callback()
                  closeDeleteGroupConfirmation()
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Okay
              </button>
            </div>
          </div>
        </div>
      )}

      {editTimeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit Group Date and Time
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Group #{editTimeModal.group.ride_id} •{' '}
              {editTimeModal.group.riders.length} rider
              {editTimeModal.group.riders.length !== 1 ? 's' : ''}
            </p>
            <div className="mb-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={editDateValue}
                  onChange={(event) => setEditDateValue(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                {editTimeModal.group.date && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current date: {editTimeModal.group.date}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Time (HH:MM)
                </label>
                <div className="relative">
                  <input
                    type="time"
                    value={editTimeValue}
                    onChange={(event) => setEditTimeValue(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={(event) => {
                      const input = event.currentTarget
                        .previousElementSibling as HTMLInputElement
                      input?.showPicker?.()
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    title="Open time picker"
                  >
                    <Clock className="h-4 w-4" />
                  </button>
                </div>
                {editTimeModal.group.match_time && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current time:{' '}
                    {editTimeModal.group.match_time.substring(0, 5)}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeEditTime}
                disabled={isUpdatingTime}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (editTimeValue) {
                    await handleUpdateGroupTime(
                      editTimeModal.group.ride_id,
                      editTimeValue,
                      editDateValue || undefined,
                    )
                  }
                }}
                disabled={isUpdatingTime || !editTimeValue}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isUpdatingTime ? 'Updating...' : 'Update Date/Time'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit Uber Voucher
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Group #{editVoucherModal.group.ride_id} •{' '}
              {editVoucherModal.group.riders.length} rider
              {editVoucherModal.group.riders.length !== 1 ? 's' : ''}
            </p>
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Voucher Code
              </label>
              <input
                type="text"
                value={editVoucherValue}
                onChange={(event) => setEditVoucherValue(event.target.value)}
                placeholder="Enter voucher code (e.g., VOUCHER123)"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
              {editVoucherModal.group.group_voucher && (
                <p className="mt-2 text-xs text-gray-500">
                  Current voucher:{' '}
                  {formatVoucher(editVoucherModal.group.group_voucher)}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                This will update the voucher for all{' '}
                {editVoucherModal.group.riders.length} rider
                {editVoucherModal.group.riders.length !== 1 ? 's' : ''} in this
                group.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeEditVoucher}
                disabled={isUpdatingVoucher}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleUpdateGroupVoucher(
                    editVoucherModal.group.ride_id,
                    editVoucherValue,
                  )
                }}
                disabled={isUpdatingVoucher}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isUpdatingVoucher ? 'Updating...' : 'Update Voucher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editGroupOverridesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Subsidized & Uber type
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Group #{editGroupOverridesModal.group.ride_id} •{' '}
              {editGroupOverridesModal.group.riders.length} rider
              {editGroupOverridesModal.group.riders.length !== 1 ? 's' : ''}.
              <strong> Locked</strong> = manual value, won&apos;t change when
              you add or move riders. <strong>Unlocked</strong> = updates
              automatically.
            </p>
            <div className="mb-4 space-y-4">
              <div className="flex items-center gap-2">
                {overrideSubsidized !== 'auto' ? (
                  <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" />
                ) : (
                  <Unlock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                )}
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Subsidized
                  </label>
                  <select
                    value={overrideSubsidized}
                    onChange={(event) =>
                      setOverrideSubsidized(
                        event.target.value as 'auto' | 'yes' | 'no',
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="auto">Unlocked (auto on add/move)</option>
                    <option value="yes">Locked: Yes</option>
                    <option value="no">Locked: No</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {overrideUberType !== 'auto' ? (
                  <Lock className="h-4 w-4 flex-shrink-0 text-amber-600" />
                ) : (
                  <Unlock className="h-4 w-4 flex-shrink-0 text-gray-400" />
                )}
                <div className="min-w-0 flex-1">
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Uber type
                  </label>
                  <select
                    value={overrideUberType}
                    onChange={(event) =>
                      setOverrideUberType(
                        event.target.value as
                          | 'auto'
                          | 'X'
                          | 'XL'
                          | 'XXL'
                          | 'Connect',
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  >
                    <option value="auto">Unlocked (auto on add/move)</option>
                    <option value="X">Locked: Uber X</option>
                    <option value="XL">Locked: Uber XL</option>
                    <option value="XXL">Locked: Uber XXL</option>
                    <option value="Connect">Locked: Connect Shuttle</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditGroupOverridesModal(null)}
                disabled={isUpdatingOverrides}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSaveGroupOverrides(
                    editGroupOverridesModal.group,
                    overrideSubsidized,
                    overrideUberType,
                  )
                }}
                disabled={isUpdatingOverrides}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isUpdatingOverrides ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {validationErrorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-red-600">
              {validationErrorModal.issue === 'time'
                ? 'No Time Overlap'
                : 'Bag Capacity Exceeded'}
            </h3>
            <p className="mb-4 text-sm text-gray-700">
              {validationErrorModal.issue === 'time'
                ? `The rider "${validationErrorModal.rider.name}" has no time overlap with group #${validationErrorModal.group.ride_id}.`
                : `Adding this rider would exceed the bag capacity limit (10 bags) for groups with 4+ members.`}
            </p>
            <div className="mb-4 rounded-lg bg-gray-50 p-4">
              <p className="mb-2 text-xs font-semibold text-gray-600">
                Group #{validationErrorModal.group.ride_id}:
              </p>
              <p className="text-sm text-gray-900">
                Members: {validationErrorModal.group.riders.length + 1} (after
                adding)
              </p>
              {validationErrorModal.issue === 'bags' && (
                <p className="text-sm text-gray-900">
                  Bag Units:{' '}
                  {calculateBagUnits([
                    ...validationErrorModal.group.riders,
                    validationErrorModal.rider,
                  ])}{' '}
                  (exceeds limit of 10)
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => validationErrorModal.onCancel()}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    await validationErrorModal.onAcknowledge()
                  } catch (error) {
                    console.error(
                      'Error acknowledging validation error:',
                      error,
                    )
                    setErrorMessage('Failed to add rider to group')
                    setTimeout(() => setErrorMessage(null), 3000)
                  }
                }}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              >
                Acknowledge & Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {timeConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-red-600">
              Time/Date Conflict
            </h3>
            <p className="mb-4 text-sm text-gray-700">
              You are trying to drag a user into a group where they have no
              overlap.
            </p>
            <div className="mb-4 space-y-3 rounded-lg bg-gray-50 p-4">
              <div>
                <p className="mb-1 text-xs font-semibold text-gray-600">
                  Group #{timeConflictModal.group.ride_id}:
                </p>
                <p className="text-sm text-gray-900">
                  Date: {timeConflictModal.group.date}
                </p>
                <p className="text-sm text-gray-900">
                  Time:{' '}
                  {timeConflictModal.group.match_time
                    ? formatTime(timeConflictModal.group.match_time)
                    : formatTimeRange(
                        calculateGroupTimeRange(timeConflictModal.group.riders),
                      )}
                </p>
              </div>
              <div className="border-t border-gray-300 pt-3">
                <p className="mb-1 text-xs font-semibold text-gray-600">
                  User ({timeConflictModal.rider.name}):
                </p>
                <p className="text-sm text-gray-900">
                  Date: {timeConflictModal.rider.date}
                </p>
                <p className="text-sm text-gray-900">
                  Time: {formatTimeRange(timeConflictModal.rider.time_range)}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setTimeConflictModal(null)
                  setDraggedRider(null)
                }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (timeConflictModal.onConfirm) {
                    await timeConflictModal.onConfirm()
                  }
                }}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {editRiderModal && editRiderForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Edit Rider Details
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              {editRiderModal.rider.name} • Flight #
              {editRiderModal.rider.flight_id}
            </p>
            <div className="max-h-96 space-y-4 overflow-y-auto">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Flight Number
                </label>
                <input
                  type="text"
                  value={editRiderForm.flight_no}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      flight_no: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Airline Code (IATA)
                </label>
                <input
                  type="text"
                  value={editRiderForm.airline_iata}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      airline_iata: event.target.value.toUpperCase(),
                    })
                  }
                  maxLength={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Airport
                </label>
                <input
                  type="text"
                  value={editRiderForm.airport}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      airport: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Direction
                </label>
                <select
                  value={editRiderForm.to_airport ? 'to' : 'from'}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      to_airport: event.target.value === 'to',
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="to">To Airport</option>
                  <option value="from">From Airport</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Date
                </label>
                <input
                  type="date"
                  value={editRiderForm.date}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      date: event.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Time Range (HH:MM - HH:MM)
                </label>
                <input
                  type="text"
                  value={editRiderForm.time_range}
                  onChange={(event) =>
                    setEditRiderForm({
                      ...editRiderForm,
                      time_range: event.target.value,
                    })
                  }
                  placeholder="09:00 - 12:00"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Format: HH:MM - HH:MM (24-hour format)
                </p>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeEditRider}
                disabled={isUpdatingRider}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleUpdateRider(editRiderModal.rider.flight_id, {
                    flight_no: editRiderForm.flight_no,
                    airline_iata: editRiderForm.airline_iata,
                    airport: editRiderForm.airport,
                    to_airport: editRiderForm.to_airport,
                    date: editRiderForm.date,
                    time_range: editRiderForm.time_range,
                  })
                }}
                disabled={isUpdatingRider}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
              >
                {isUpdatingRider ? 'Updating...' : 'Update Rider'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AddRider
        isOpen={isAddRiderOpen}
        onClose={() => setIsAddRiderOpen(false)}
        onSuccess={async () => {
          await fetchData()
        }}
        logToChangeLog={logToChangeLog}
      />
    </>
  )
}
