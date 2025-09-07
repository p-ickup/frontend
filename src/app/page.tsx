'use client'

import RedirectButton from '@/components/buttons/RedirectButton'
import { useAuth } from '@/hooks/useAuth'
import { validateUserProfile } from '@/utils/profileValidation'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

export default function Index() {
  const { user, signInWithGoogle } = useAuth()
  const router = useRouter()

  const handleGetStarted = async () => {
    if (!user) {
      // If not logged in, redirect to sign in
      await signInWithGoogle()
      return
    }

    try {
      // Check if profile is complete
      const profileStatus = await validateUserProfile()

      if (profileStatus.hasCompleteProfile) {
        // Profile is complete, go to questionnaire
        router.push('/questionnaires')
      } else {
        // Profile is incomplete, go to profile page
        router.push('/profile')
      }
    } catch (error) {
      console.error('Error checking profile status:', error)
      // Fallback to profile page if there's an error
      router.push('/profile')
    }
  }

  return (
    <div className="from-slate-50 relative overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Modern Background Design */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>

        {/* Floating Geometric Shapes */}
        <div
          className="animate-float absolute left-10 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"
          style={{ animationDelay: '0s' }}
        ></div>
        <div
          className="animate-float absolute right-20 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="animate-float absolute bottom-40 left-1/4 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        ></div>
        <div
          className="from-teal-300/15 to-blue-300/15 animate-float absolute right-1/3 top-1/2 h-14 w-14 rotate-12 rounded-2xl bg-gradient-to-br"
          style={{ animationDelay: '0.5s' }}
        ></div>

        {/* Large Gradient Blobs - Matching Header/Footer Gradient */}
        <div className="from-teal-500/8 to-yellow-100/8 absolute left-1/2 top-0 h-[600px] w-[600px] animate-pulse rounded-full bg-gradient-to-r blur-3xl"></div>
        <div
          className="from-teal-500/8 to-yellow-100/8 absolute bottom-0 right-0 h-[500px] w-[500px] animate-pulse rounded-full bg-gradient-to-l blur-3xl"
          style={{ animationDelay: '2s' }}
        ></div>
        <div
          className="from-teal-500/6 to-yellow-100/6 absolute left-0 top-1/3 h-[400px] w-[400px] animate-pulse rounded-full bg-gradient-to-r blur-3xl"
          style={{ animationDelay: '4s' }}
        ></div>
      </div>

      {/* Hero Section - Full Viewport Height */}
      <div className="relative flex h-screen items-center justify-center overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23059669%22%20fill-opacity%3D%220.05%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-40"></div>

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative text-center">
            {/* Logo/Brand */}
            <div className="mb-8">
              <div className="mx-auto inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg transition-all duration-300 hover:scale-110">
                <Image
                  src="/favicon.png"
                  alt="PICKUP Logo"
                  width={48}
                  height={48}
                  className="object-contain"
                />
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="animate-fade-in-up mb-6 text-5xl font-bold tracking-tight text-gray-900 sm:text-6xl lg:text-7xl">
              Welcome to{' '}
              <span className="animate-gradient-x bg-gradient-to-r from-teal-500 to-yellow-100 bg-clip-text text-transparent">
                PICKUP
              </span>
            </h1>

            {/* Subtitle */}
            <p
              className="animate-fade-in-up mx-auto mb-8 max-w-3xl text-xl text-gray-600 sm:text-2xl"
              style={{ animationDelay: '0.2s' }}
            >
              Why pay $100+ for a ride to the airport? We help you{' '}
              <span className="animate-pulse font-semibold text-teal-600">
                split the cost
              </span>{' '}
              and{' '}
              <span
                className="animate-pulse font-semibold text-blue-600"
                style={{ animationDelay: '0.5s' }}
              >
                share the journey
              </span>{' '}
              with fellow travelers.
            </p>

            {/* CTA Button with mobile scroll indicators */}
            <div className="mb-16">
              <div className="flex items-center justify-center gap-2 sm:gap-0">
                {/* Left arrow - mobile only */}
                <div className="animate-bounce sm:hidden">
                  <svg
                    className="h-4 w-4 text-teal-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>

                <button
                  onClick={handleGetStarted}
                  className="inline-flex items-center rounded-lg bg-gradient-to-r from-teal-500 to-yellow-100 px-8 py-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-105 hover:from-teal-600 hover:to-yellow-200 hover:shadow-xl"
                >
                  {user ? (
                    <>
                      <svg
                        className="mr-3 h-6 w-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                      Get Started
                    </>
                  ) : (
                    <>
                      <svg className="mr-3 h-6 w-6" viewBox="0 0 48 48">
                        <path
                          fill="white"
                          d="M24 9.5c3.41 0 6.44 1.19 8.86 3.12l6.58-6.59C34.89 2.23 29.76 0 24 0 14.54 0 6.6 5.86 3.06 14.31l7.91 6.14C13.01 13.73 18.1 9.5 24 9.5z"
                        ></path>
                        <path
                          fill="white"
                          d="M46.5 24.42c0-1.55-.14-3.06-.4-4.42H24v8.34h12.91c-.58 3.16-2.18 5.79-4.53 7.57l7.32 5.66c4.27-3.94 6.8-9.73 6.8-16.15z"
                        ></path>
                        <path
                          fill="white"
                          d="M10.86 28.49C9.92 26.08 9.5 23.61 9.5 21s.42-5.08 1.36-7.49L3 7.37C.97 11.33 0 16 0 21s.97 9.67 3 13.63l7.86-6.14z"
                        ></path>
                        <path
                          fill="white"
                          d="M24 48c6.48 0 11.91-2.14 15.88-5.81l-7.32-5.66c-2.03 1.38-4.61 2.24-7.56 2.24-5.89 0-10.88-4.23-12.7-9.92l-7.91 6.14C6.6 42.14 14.54 48 24 48z"
                        ></path>
                      </svg>
                      Sign in with Google
                    </>
                  )}
                </button>

                {/* Right arrow - mobile only */}
                <div
                  className="animate-bounce sm:hidden"
                  style={{ animationDelay: '0.5s' }}
                >
                  <svg
                    className="h-4 w-4 text-teal-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Scroll Indicator - Desktop only */}
            <div className="mt-8 hidden animate-bounce sm:block">
              <div className="flex flex-col items-center text-gray-600">
                <span className="mb-2 text-sm font-medium">
                  Scroll to explore
                </span>
                <svg
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 14l-7 7m0 0l-7-7m7 7V3"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        {/* Background decoration */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-50/30 to-transparent"></div>

        <div className="relative mb-20 text-center">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-yellow-100">
            <svg
              className="h-8 w-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="animate-fade-in-up text-4xl font-bold text-gray-900 sm:text-5xl">
            How PICKUP Works
          </h2>
          <p
            className="animate-fade-in-up mx-auto mt-6 max-w-2xl text-xl text-gray-600"
            style={{ animationDelay: '0.1s' }}
          >
            Simple, safe, and cost-effective airport transportation that
            connects you with fellow travelers
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {/* Feature 1 */}
          <div
            className="animate-fade-in-up group relative rounded-3xl border border-gray-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm transition-all duration-500 hover:-translate-y-3 hover:rotate-1 hover:shadow-2xl"
            style={{ animationDelay: '0.1s' }}
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-teal-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200 text-teal-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900 transition-colors duration-300 group-hover:text-teal-600">
                Smart Matching
              </h3>
              <p className="text-lg leading-relaxed text-gray-600 transition-colors duration-300 group-hover:text-gray-700">
                Our intelligent algorithm matches you with fellow travelers
                heading to the same airport at similar times, ensuring perfect
                compatibility.
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div
            className="animate-fade-in-up group relative rounded-3xl border border-gray-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm transition-all duration-500 hover:-translate-y-3 hover:-rotate-1 hover:shadow-2xl"
            style={{ animationDelay: '0.2s' }}
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900 transition-colors duration-300 group-hover:text-blue-600">
                Split Costs
              </h3>
              <p className="text-lg leading-relaxed text-gray-600 transition-colors duration-300 group-hover:text-gray-700">
                Share ride costs with your travel companions and save up to 70%
                on airport transportation while making new connections.
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div
            className="animate-fade-in-up group relative rounded-3xl border border-gray-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm transition-all duration-500 hover:-translate-y-3 hover:rotate-1 hover:shadow-2xl"
            style={{ animationDelay: '0.3s' }}
          >
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"></div>
            <div className="relative">
              <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-200 text-indigo-600 shadow-lg transition-transform duration-300 group-hover:scale-110">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="mb-4 text-2xl font-bold text-gray-900 transition-colors duration-300 group-hover:text-indigo-600">
                Safe & Reliable
              </h3>
              <p className="text-lg leading-relaxed text-gray-600 transition-colors duration-300 group-hover:text-gray-700">
                All users are verified through Google authentication, ensuring a
                safe and trustworthy experience for everyone.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA */}
      <div className="from-slate-50 relative overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100 py-20">
        {/* Background decoration */}
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 h-96 w-96 rounded-full bg-gradient-to-r from-teal-500/10 to-yellow-100/10 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-gradient-to-l from-teal-500/10 to-yellow-100/10 blur-3xl"></div>
        </div>

        <div className="relative mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-teal-500 to-yellow-100 shadow-xl">
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
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>

          <h2 className="animate-fade-in-up text-4xl font-bold text-gray-900 sm:text-5xl lg:text-6xl">
            Ready to Save on Your Next{' '}
            <span className="bg-gradient-to-r from-teal-500 to-yellow-100 bg-clip-text text-transparent">
              Airport Trip?
            </span>
          </h2>

          <p
            className="animate-fade-in-up mx-auto mt-6 max-w-3xl text-xl text-gray-600"
            style={{ animationDelay: '0.2s' }}
          >
            Join fellow travelers who are already saving money and making new
            connections. Start your journey today!
          </p>

          <div
            className="animate-fade-in-up mt-12"
            style={{ animationDelay: '0.4s' }}
          >
            <button
              onClick={handleGetStarted}
              className="hover:shadow-3xl inline-flex items-center rounded-2xl bg-gradient-to-r from-teal-500 to-yellow-100 px-10 py-5 text-xl font-bold text-white shadow-2xl transition-all duration-300 hover:rotate-1 hover:scale-110 hover:from-teal-600 hover:to-yellow-200"
            >
              {user ? (
                <>
                  <svg
                    className="mr-4 h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Start Your Journey
                </>
              ) : (
                <>
                  <svg className="mr-4 h-6 w-6" viewBox="0 0 48 48">
                    <path
                      fill="white"
                      d="M24 9.5c3.41 0 6.44 1.19 8.86 3.12l6.58-6.59C34.89 2.23 29.76 0 24 0 14.54 0 6.6 5.86 3.06 14.31l7.91 6.14C13.01 13.73 18.1 9.5 24 9.5z"
                    ></path>
                    <path
                      fill="white"
                      d="M46.5 24.42c0-1.55-.14-3.06-.4-4.42H24v8.34h12.91c-.58 3.16-2.18 5.79-4.53 7.57l7.32 5.66c4.27-3.94 6.8-9.73 6.8-16.15z"
                    ></path>
                    <path
                      fill="white"
                      d="M10.86 28.49C9.92 26.08 9.5 23.61 9.5 21s.42-5.08 1.36-7.49L3 7.37C.97 11.33 0 16 0 21s.97 9.67 3 13.63l7.86-6.14z"
                    ></path>
                    <path
                      fill="white"
                      d="M24 48c6.48 0 11.91-2.14 15.88-5.81l-7.32-5.66c-2.03 1.38-4.61 2.24-7.56 2.24-5.89 0-10.88-4.23-12.7-9.92l-7.91 6.14C6.6 42.14 14.54 48 24 48z"
                    ></path>
                  </svg>
                  Get Started Free
                </>
              )}
            </button>
          </div>

          <div
            className="animate-fade-in-up mt-8 flex items-center justify-center space-x-8 text-sm text-gray-500"
            style={{ animationDelay: '0.6s' }}
          >
            <div className="flex items-center">
              <svg
                className="mr-2 h-4 w-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Free to use
            </div>
            <div className="flex items-center">
              <svg
                className="mr-2 h-4 w-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Secure & verified
            </div>
            <div className="flex items-center">
              <svg
                className="mr-2 h-4 w-4 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Save up to 70%
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
