'use client'
import React from 'react'
import Image from 'next/image'

export default function About() {
  const [activeStep, setActiveStep] = React.useState(0)
  const [isLastStep, setIsLastStep] = React.useState(false)
  const [isFirstStep, setIsFirstStep] = React.useState(false)

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div className="absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"></div>
        <div className="absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"></div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col">
        {/* Header Section */}
        <div className="relative px-6 pb-6 pt-8">
          <div className="mx-auto max-w-6xl text-center">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              About PICKUP
            </h1>
            <p className="text-xl text-gray-600">
              Making airport travel affordable and accessible for the 5C
              community
            </p>
          </div>
        </div>

        {/* Content Section */}
        <div className="relative flex-1 px-6 pb-8">
          <div className="mx-auto max-w-4xl">
            {/* Story Section */}
            <div className="mb-12 rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
              <div className="space-y-6 text-lg leading-relaxed text-gray-700">
                <p>
                  No student should pay $100+ for a solo ride to LAX. While the
                  Claremont Colleges sometimes provide shuttles, they&apos;re
                  often limited. That&apos;s where PICKUP comes in.
                </p>
                <p>
                  We&apos;re a student-led team making travel more affordable
                  and accessible for the 5C community. Our platform matches
                  students with similar flight plans so you can share rides and
                  split costs.
                </p>
                <p>
                  The idea for PICKUP was born out of personal frustration.
                  After struggling to find affordable airport transportation
                  ourselves, we realized there was a better solution waiting to
                  be built. With the help of our loving and dedicated
                  engineering team, we&apos;ve been working on this platform
                  throughout the year.
                </p>
                <p className="font-semibold text-teal-700">
                  Whether it&apos;s your first ride or your fiftieth, we hope
                  PICKUP makes your journey a little easier.
                </p>
              </div>
            </div>

            {/* How it Works Section */}
            <div className="mb-12 rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
              <div className="text-center">
                <h2 className="mb-4 text-3xl font-bold text-gray-900">
                  How it Works
                </h2>
                <p className="mb-8 text-xl text-gray-600">
                  Countdown to Flight:
                </p>
              </div>

              {/* Simple Timeline */}
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 font-bold text-white shadow-lg">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Months in Advance
                    </h3>
                    <p className="text-gray-600">Book your flight.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 font-bold text-white shadow-lg">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      7 Days
                    </h3>
                    <p className="text-gray-600">
                      Complete PICKUP questionnaire.
                    </p>
                    <p className="mt-1 text-sm italic text-gray-500">
                      * anytime between booking and 3 days before *
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 font-bold text-white shadow-lg">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      3 Days
                    </h3>
                    <p className="text-gray-600">
                      Receive your match and contact.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-teal-600 font-bold text-white shadow-lg">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      0 Days!
                    </h3>
                    <p className="text-gray-600">
                      Get PICKed UP! Fill out feedback.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Team Section */}
            <div className="mb-12 rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
              <div className="text-center">
                <h2 className="mb-6 text-3xl font-bold text-gray-900">
                  Meet Our Team
                </h2>
                <p className="mb-8 text-lg text-gray-600">
                  Built by students, for students. Special thanks to our
                  incredible engineering team!
                </p>

                {/* Team Photo */}
                <div className="mb-6 flex justify-center">
                  <div className="relative overflow-hidden rounded-2xl shadow-xl">
                    <Image
                      src="/images/teampic.jpg"
                      alt="PICKUP Engineering Team"
                      width={800}
                      height={600}
                      className="h-auto w-full max-w-2xl object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  </div>
                </div>

                {/* Photo Caption */}
                <div className="mb-8 rounded-xl bg-gradient-to-r from-teal-50 to-blue-100 p-4">
                  <p className="mb-1 text-sm font-semibold text-gray-600">
                    Our engineers (top to bottom, left to right): <br />
                    <span className="text-sm font-semibold text-gray-800">
                      Haram Yoon, Henok Dawite, Francisco Morales (Lead ML),
                      Yunju Song, Julianne Louie (Lead SWE), Kellie Au, Josh
                      Oyadomari-Chun, Melinda Deng
                    </span>
                  </p>
                </div>

                {/* Cofounders Recognition */}
                <div className="mb-8 rounded-xl bg-gradient-to-r from-teal-50 to-blue-50 p-4">
                  <p className="mb-1 text-sm font-medium text-gray-600">
                    Cofounders
                  </p>
                  <p className="text-lg font-semibold text-gray-800">
                    Julianne Louie & Francisco Morales
                  </p>
                </div>

                <div className="rounded-xl bg-gradient-to-r from-yellow-50 to-orange-50 p-6">
                  <p className="text-lg text-gray-700">
                    <span className="text-2xl">🙏</span> Thank you to our
                    amazing team for helping us build the foundation of PICKUP.
                    Your contributions made this platform possible for the 5C
                    community!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
