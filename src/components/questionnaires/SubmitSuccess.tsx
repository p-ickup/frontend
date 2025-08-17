'use client'

import React from 'react'
import { useRouter } from 'next/navigation'

interface SubmitSuccessProps {
  isOpen: boolean
  onClose: () => void
  route: string
}

const SubmitSuccess: React.FC<SubmitSuccessProps> = ({
  isOpen,
  onClose,
  route,
}) => {
  const router = useRouter()

  if (!isOpen) return null

  const handleOkay = () => {
    onClose() // close the modal
    router.push(route) // then redirect
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
      <div className="w-96 rounded-lg bg-white p-6 shadow-lg">
        <h2 className="text-xl font-semibold text-gray-800">
          ✅ Flight details submitted successfully!
        </h2>
        <p className="mt-2 text-gray-600">
          You may edit or delete this form up to 3 days before your requested
          ride share. Please check the <strong>Results</strong> page to see who
          you match with. If you do not receive a match 3 days prior to your
          requested ride share date, check the <strong>Unmatched</strong> page.
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
