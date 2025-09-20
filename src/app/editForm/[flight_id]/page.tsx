'use client'

import FlightForm from '@/components/forms/FlightForm'
import { usePathname } from 'next/navigation'

export default function EditForm() {
  const pathname = usePathname()
  const flight_id = pathname.split('/').pop()

  if (!flight_id) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <h1 className="text-2xl font-bold text-red-600">
              Error: Flight ID not found
            </h1>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div
          className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="animate-float absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      <div className="relative flex min-h-screen w-full items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header Section */}
          <div className="mb-8 text-center">
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Edit Flight Request
            </h1>
            <p className="text-xl text-gray-600">
              Update your flight details and preferences
            </p>
          </div>

          {/* Form Container */}
          <div className="rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
            <FlightForm
              mode="edit"
              flightId={flight_id}
              // title="Edit Flight Information"
              submitButtonText="Update"
              successMessage="✅ Flight details updated successfully!"
              successRedirectRoute="/questionnaires"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
