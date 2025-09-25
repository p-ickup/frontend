'use client'

import { useRouter } from 'next/navigation'

export default function ASPCPolicy() {
  const router = useRouter()

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
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              ASPC Subsidy Policy
            </h1>
            <p className="text-xl text-gray-600">
              Fall 2025 Operational Guidelines
            </p>
          </div>

          {/* Policy Content */}
          <div className="rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
            {/* Operational Periods */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                📅 Fall 2025 Operational Periods
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 p-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-800">
                  Fall Break - October 11, 13, 14 (ONT Only)
                </h3>
                <p className="text-gray-700">
                  ASPC-subsidized rides are only available on these specific
                  dates.
                </p>
              </div>
            </div>

            {/* Time Windows */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                ⏰ Guaranteed Subsidy Time Windows
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                {/* Outbound */}
                <div className="to-emerald-50 rounded-xl bg-gradient-to-br from-green-50 p-6">
                  <h3 className="mb-3 text-lg font-semibold text-gray-800">
                    🛫 Outbound (To Airport)
                  </h3>
                  <div className="space-y-2">
                    <p className="text-gray-700">
                      <span className="font-semibold">Guaranteed:</span> 6:00 AM
                      - 6:00 PM PST
                    </p>
                  </div>
                </div>

                {/* Inbound */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
                  <h3 className="mb-3 text-lg font-semibold text-gray-800">
                    🛬 Inbound (Return to Campus)
                  </h3>
                  <div className="space-y-2">
                    <p className="text-gray-700">
                      <span className="font-semibold">Guaranteed:</span> 10:00
                      AM - 10:00 PM PST
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* After Hours Policy */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                🌙 After Hours Requests
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 p-6">
                <p className="mb-4 text-gray-700">
                  If your flight falls outside guaranteed hours but is still on
                  an operational day, or ±2 days from our coverage, we will
                  cover it if:
                </p>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg bg-white/50 p-4">
                    <h4 className="font-semibold text-gray-800">ONT Airport</h4>
                    <p className="text-gray-700">
                      At least <span className="font-bold">2 riders</span> must
                      be grouped
                    </p>
                  </div>
                  <div className="rounded-lg bg-white/50 p-4">
                    <h4 className="font-semibold text-gray-800">LAX Airport</h4>
                    <p className="text-gray-700">
                      At least <span className="font-bold">3 riders</span> must
                      be grouped
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  If grouping cannot be achieved, the ride will not be
                  subsidized. PICKUP will notify you at least 5 days before
                  travel. Students may still use P-ICKUP.com to coordinate
                  non-subsidized rides and split costs among themselves.
                </p>
              </div>
            </div>

            {/* Non-Covered Days */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                ❌ Non-Covered Days
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-red-50 to-pink-50 p-6">
                <p className="text-gray-700">
                  Flights outside operational periods (more than ±2 days from
                  the published schedule) are not eligible for subsidy.
                </p>
                <p className="mt-2 text-gray-700">
                  Students may still use P-ICKUP.com to coordinate
                  non-subsidized rides and split costs among themselves.
                </p>
              </div>
            </div>

            {/* Important Notes */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                ⚠️ Important Notes
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="mr-2 text-teal-500">•</span>
                    <span>
                      <strong>Ride Scheduling:</strong> Ride times are assigned
                      to increase shared ridership and ensure efficient use of
                      the program&apos;s budget.
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-teal-500">•</span>
                    <span>
                      Your scheduled ride may depart earlier than the latest
                      possible time you could leave for your flight. Students
                      should plan accordingly when booking flights.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
