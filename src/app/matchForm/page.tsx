'use client'

import FlightForm from '@/components/forms/FlightForm'

export default function MatchForm() {
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
        <div className="w-full max-w-7xl">
          {/* Header Section */}
          <div className="mb-4 text-center md:mb-8">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg md:mb-6 md:h-20 md:w-20">
              <svg
                className="h-8 w-8 text-white md:h-10 md:w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900 md:mb-4 md:text-4xl">
              Create Flight Request
            </h1>
            <p className="text-lg text-gray-600 md:text-xl">
              Fill out your flight details to find travel companions
            </p>
          </div>

          {/* Form Container - Hidden on mobile, shown on desktop */}
          <div className="hidden rounded-3xl bg-white/80 p-12 shadow-2xl backdrop-blur-sm md:block">
            <FlightForm
              mode="create"
              // title="Flight Information"
              submitButtonText="Request Match"
              successMessage="✅ Flight details submitted successfully!"
              successRedirectRoute="/questionnaires"
            />
          </div>

          {/* Mobile Form - No container, simpler */}
          <div className="block md:hidden">
            <FlightForm
              mode="create"
              // title="Flight Information"
              submitButtonText="Request Match"
              successMessage="✅ Flight details submitted successfully!"
              successRedirectRoute="/questionnaires"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
