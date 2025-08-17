'use client'

import FlightForm from '@/components/forms/FlightForm'
import { usePathname } from 'next/navigation'

export default function EditForm() {
  const pathname = usePathname()
  const flight_id = pathname.split('/').pop()

  if (!flight_id) {
    return (
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="text-2xl font-bold text-red-600">
          Error: Flight ID not found
        </h1>
      </div>
    )
  }

  return (
    <div className="w-full bg-gray-100 p-8 text-black">
      <FlightForm
        mode="edit"
        flightId={flight_id}
        title="Edit Flight Information"
        submitButtonText="Update"
        successMessage="✅ Flight details updated successfully!"
        successRedirectRoute="/questionnaires"
      />
    </div>
  )
}
