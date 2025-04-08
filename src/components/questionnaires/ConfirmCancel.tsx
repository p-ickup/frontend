import React from 'react'

interface ConfirmCancelProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
}

const ConfirmCancel: React.FC<ConfirmCancelProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
      <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800">
          Confirm Cancellation
        </h2>
        <p className="mt-2 text-gray-600">
          Are you sure you want to cancel this form? This action cannot be
          undone.
        </p>

        <div className="mt-4 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="rounded-lg bg-gray-300 px-4 py-2 text-black hover:bg-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmCancel
