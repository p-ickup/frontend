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
              ASPC RideLink Policy
            </h1>
            <p className="text-xl text-gray-600">
              2025-2026 Operational Guidelines
            </p>
          </div>

          {/* Policy Content */}
          <div className="rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
            {/* Contact Info */}
            <div className="mb-8 rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 p-6">
              <p className="text-center text-gray-700">
                <strong>Questions?</strong> Contact{' '}
                <a
                  href="mailto:ridelink@aspc.pomona.edu"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  ridelink@aspc.pomona.edu
                </a>
              </p>
            </div>

            {/* Operational Periods */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                📅 Operational Periods
              </h2>

              {/* Thanksgiving Break */}
              <div className="mb-6 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 p-6">
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  🦃 Thanksgiving Break
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Deadline to request:
                    </p>
                    <p className="text-gray-700">
                      Friday, November 14, 2025 at 11:59 PM PST
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Service Window:
                    </p>
                    <ul className="ml-5 list-disc space-y-1 text-gray-700">
                      <li>Departures: November 21-26</li>
                      <li>Returns: November 29-December 1</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Winter Break Departure */}
              <div className="mb-6 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 p-6">
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  ❄️ Winter Break Departure
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Deadline to request:
                    </p>
                    <p className="text-gray-700">
                      Wednesday, December 3, 2025 at 11:59 PM PST
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Service Window:
                    </p>
                    <p className="text-gray-700">December 9-13</p>
                  </div>
                  <div className="rounded-lg bg-yellow-100 p-3">
                    <p className="text-sm font-semibold text-yellow-900">
                      ⚠️ Pomona College dorms and facilities close at 12:00 PM
                      on December 13.
                    </p>
                  </div>
                </div>
              </div>

              {/* Winter Break Return */}
              <div className="rounded-xl bg-gradient-to-r from-teal-50 to-cyan-50 p-6">
                <h3 className="mb-3 text-xl font-semibold text-gray-800">
                  🎉 Winter Break Return
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-semibold text-gray-800">
                      Deadline to request:
                    </p>
                    <p className="text-gray-700">
                      Friday, January 9, 2026 at 11:59 PM PST
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">
                      Service Window:
                    </p>
                    <p className="text-gray-700">January 17-21</p>
                  </div>
                </div>
              </div>
            </div>

            {/* How Matching Works */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                🤝 How Matching Works
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 p-6">
                <p className="mb-4 text-gray-700">
                  RideLink covers rides only when groups can be formed:{' '}
                  <span className="font-bold">2+ riders to ONT</span> or{' '}
                  <span className="font-bold">3+ riders to LAX</span>.
                </p>
                <div className="rounded-lg bg-white/70 p-4">
                  <p className="mb-3 font-semibold text-gray-800">
                    💡 Tips to Increase Your Matching Odds:
                  </p>
                  <ul className="space-y-2 text-gray-700">
                    <li className="flex items-start">
                      <span className="mr-2 text-teal-500">•</span>
                      <span>
                        <strong>Travel during common times:</strong> Daytime
                        hours and within ±1 day of the start or end of the break
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 text-teal-500">•</span>
                      <span>
                        <strong>Be flexible:</strong> Provide a wide range of
                        availability and be willing to arrive at the airport
                        earlier than necessary
                      </span>
                    </li>
                    <li className="flex items-start">
                      <span className="mr-2 text-teal-500">•</span>
                      <span>
                        <strong>Encourage friends:</strong> More riders = more
                        matches! Get your friends to sign up
                      </span>
                    </li>
                  </ul>
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  If a sufficient group cannot be formed, RideLink will be
                  unable to cover the ride. However, you may still use PICKUP to
                  coordinate non-subsidized carpools.
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
