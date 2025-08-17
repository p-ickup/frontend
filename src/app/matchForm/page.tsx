'use client'

import FlightForm from '@/components/forms/FlightForm'

export default function MatchForm() {
  return (
    <div className="w-full bg-gray-100 p-8 text-black">
      <FlightForm
        mode="create"
        title="Flight Information"
        submitButtonText="Request Match"
        successMessage="✅ Flight details submitted successfully!"
        successRedirectRoute="/questionnaires"
      />
    </div>
  )
}
