'use client'

import { useRouter } from 'next/navigation'

export default function ASPCFees() {
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
            <div className="mb-6 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 shadow-lg">
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Cancellation & Change Fees
            </h1>
            <p className="text-xl text-gray-600">ASPC RideLink Fee Policy</p>
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
                </a>{' '}
                or call/text{' '}
                <a
                  href="tel:9093475295"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  (909) 347-5295
                </a>
              </p>
            </div>

            {/* Airline-Initiated Changes */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                ✈️ Airline-Initiated Changes
              </h2>
              <div className="to-emerald-50 rounded-xl bg-gradient-to-r from-green-50 p-6">
                <p className="mb-4 text-lg font-semibold text-gray-800">
                  Airline-initiated changes are never subject to cancellation
                  fees.
                </p>
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="mr-2 text-green-600">✓</span>
                    <span>
                      You may take your original ride or cancel with no fee.
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-red-600">⚠️</span>
                    <span>
                      Failure to notify RideLink will result in a no-show fee.
                    </span>
                  </li>
                </ul>

                <div className="mt-4 space-y-3 rounded-lg bg-white/70 p-4">
                  <p className="font-semibold text-gray-800">
                    📌 Important Policy Differences:
                  </p>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong className="text-red-600">
                        Outbound trips (to airport):
                      </strong>{' '}
                      RideLink cannot accommodate regrouping for delays or
                      cancellations.
                    </p>
                    <p>
                      <strong className="text-green-600">
                        Inbound trips (from airport):
                      </strong>{' '}
                      For delays or cancellations, complete the delay
                      verification form and RideLink will:
                    </p>
                    <ul className="ml-6 list-disc space-y-1">
                      <li>Attempt to regroup you, or</li>
                      <li>
                        Issue a contingency voucher if regrouping is not
                        possible.
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Student-Initiated Changes */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                🧑‍🎓 Student-Initiated Changes (Voluntary)
              </h2>

              {/* Before Deadline */}
              <div className="to-emerald-50 mb-6 rounded-xl bg-gradient-to-r from-green-50 p-6">
                <h3 className="mb-3 flex items-center text-xl font-semibold text-gray-800">
                  <span className="mr-2 text-2xl">✅</span>
                  Before Matching Deadline
                </h3>
                <p className="text-gray-700">
                  You may update your request or cancel with{' '}
                  <strong>no fee</strong>.
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  Make changes freely through the PICKUP dashboard before the
                  deadline for your break period.
                </p>
              </div>

              {/* After Deadline */}
              <div className="rounded-xl bg-gradient-to-r from-orange-50 to-red-50 p-6">
                <h3 className="mb-3 flex items-center text-xl font-semibold text-gray-800">
                  <span className="mr-2 text-2xl">⚠️</span>
                  After Matching Deadline
                </h3>
                <p className="mb-4 text-gray-700">
                  Changes cannot be accommodated; the standard cancellation fees
                  apply:
                </p>

                <div className="space-y-4">
                  {/* Cancellation Fees */}
                  <div className="rounded-lg bg-white/70 p-4">
                    <p className="mb-3 font-semibold text-gray-800">
                      💵 Cancellation Fees
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border-2 border-orange-200 bg-white p-3 text-center">
                        <p className="text-sm text-gray-600">Ontario (ONT)</p>
                        <p className="text-3xl font-bold text-orange-600">$8</p>
                      </div>
                      <div className="rounded-lg border-2 border-red-200 bg-white p-3 text-center">
                        <p className="text-sm text-gray-600">
                          Los Angeles (LAX)
                        </p>
                        <p className="text-3xl font-bold text-red-600">$20</p>
                      </div>
                    </div>
                  </div>

                  {/* No-Show Fees */}
                  <div className="rounded-lg bg-white/70 p-4">
                    <p className="mb-3 font-semibold text-gray-800">
                      🚫 No-Show Fees
                    </p>
                    <p className="mb-3 text-sm text-gray-700">
                      If you do not show up and fail to notify RideLink at least
                      one hour before your scheduled ride:
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="rounded-lg border-2 border-orange-200 bg-white p-3 text-center">
                        <p className="text-sm text-gray-600">Ontario (ONT)</p>
                        <p className="text-3xl font-bold text-orange-600">
                          $15
                        </p>
                      </div>
                      <div className="rounded-lg border-2 border-red-200 bg-white p-3 text-center">
                        <p className="text-sm text-gray-600">
                          Los Angeles (LAX)
                        </p>
                        <p className="text-3xl font-bold text-red-600">$40</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Important Rules */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                📋 Important Rules
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 p-6">
                <ul className="space-y-3 text-gray-700">
                  <li className="flex items-start">
                    <span className="mr-2 text-purple-600">•</span>
                    <span>
                      To qualify as a <strong>cancellation</strong> (rather than
                      a no-show), you must notify RideLink directly or complete
                      the online form at least{' '}
                      <strong>one hour in advance</strong>.
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-purple-600">•</span>
                    <span>
                      Notifying only your group members{' '}
                      <strong>does not qualify</strong> as proper notification
                      to RideLink.
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-purple-600">•</span>
                    <span>
                      All fees must be paid before you can request future
                      RideLink services.
                    </span>
                  </li>
                </ul>
              </div>
            </div>

            {/* How to Cancel */}
            <div className="mb-8">
              <h2 className="mb-4 text-2xl font-bold text-gray-900">
                🔔 How to Cancel or Report Changes
              </h2>
              <div className="rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 p-6">
                <p className="mb-4 font-semibold text-gray-800">
                  Contact RideLink as soon as possible:
                </p>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start">
                    <span className="mr-2 text-blue-600">📧</span>
                    <span>
                      Email:{' '}
                      <a
                        href="mailto:ridelink@aspc.pomona.edu"
                        className="font-semibold text-teal-600 hover:underline"
                      >
                        ridelink@aspc.pomona.edu
                      </a>
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-blue-600">📱</span>
                    <span>
                      Call/Text:{' '}
                      <a
                        href="tel:9093475295"
                        className="font-semibold text-teal-600 hover:underline"
                      >
                        (909) 347-5295
                      </a>{' '}
                      <span className="text-sm text-gray-600">
                        (Phone support available from U.S./Canada only)
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2 text-blue-600">📝</span>
                    <span>
                      For inbound flight delays/cancellations: Complete the
                      delay verification form (link provided in your match
                      email)
                    </span>
                  </li>
                </ul>

                <div className="mt-4 rounded-lg bg-yellow-50 p-4">
                  <p className="text-sm font-semibold text-yellow-800">
                    ⏰ Remember: You must notify RideLink at least 1 hour before
                    your scheduled ride to avoid no-show fees!
                  </p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex flex-wrap gap-4 border-t border-gray-200 pt-6">
              <button
                onClick={() => router.push('/aspc-policy')}
                className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:from-teal-600 hover:to-cyan-600"
              >
                View Operational Policy
              </button>
              <button
                onClick={() => router.push('/')}
                className="rounded-lg border-2 border-gray-300 bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
