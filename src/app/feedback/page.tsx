'use client'

import { createBrowserClient } from '@/utils/supabase'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import StarRating from '@/components/feedback/StarRating'

export default function FeedbackForm() {
  const supabase = createBrowserClient()

  type Ride = {
    user_id: string
    flight_id: string
    Flights: {
      date: string
      to_airport: boolean
      airport: string
    }
  }

  const [rides, setRides] = useState<Ride[]>([])
  const [selectedFlight, setSelectedFlight] = useState('')
  const [overall, setOverall] = useState<number>(0)
  const [convenience, setConvenience] = useState<number>(0)
  const [comments, setComments] = useState('')
  const [userId, setUserId] = useState('')

  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  useEffect(() => {
    // Fetch rides (matches) from Supabase
    const fetchRides = async () => {
      const { data, error } = await supabase
        .from('Matches')
        .select('user_id, flight_id, Flights(date, to_airport, airport)') // join Flights table

      if (error) {
        console.error('Error fetching rides:', error)
      } else {
        setRides(data as unknown as Ride[])
      }
    }

    // Fetch current user
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Error fetching user:', error)
      } else if (data?.user) {
        setUserId(data.user.id)
      }
    }

    fetchRides()
    fetchUser()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    setErrorMessage('')
    setSuccessMessage('')

    if (!selectedFlight) {
      setErrorMessage('Please select a match before submitting.')
      return
    }

    if (overall < 1 || convenience < 1) {
      setErrorMessage(
        'Please provide a rating for both overall and convenience.',
      )
      return
    }

    const { data: matchedRide, error: rideError } = await supabase
      .from('Matches')
      .select('user_id, flight_id, Flights(date, to_airport, airport)')
      .eq('flight_id', selectedFlight)
      .eq('user_id', userId)
      .single() // ensure you only get one match

    console.log('Matched ride data:', matchedRide)

    const { error: feedbackError } = await supabase.from('Feedback').insert([
      {
        user_id: userId,
        flight_id: selectedFlight,
        overall,
        convenience,
        comments,
      },
    ])

    if (feedbackError) {
      console.error('Error submitting feedback:', feedbackError)
      alert(`Error submitting feedback: ${feedbackError.message}`)
    } else {
      alert('Feedback submitted successfully!')
      setSelectedFlight('')
      setOverall(0)
      setConvenience(0)
      setComments('')
    }
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
        <div className="w-full max-w-2xl">
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
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900 md:mb-4 md:text-4xl">
              Leave Feedback
            </h1>
            <p className="text-lg text-gray-600 md:text-xl">
              We value your feedback. Help us improve PICKUP for everyone.
            </p>
          </div>

          {/* Form Container - Hidden on mobile, shown on desktop */}
          <div className="hidden rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm md:block">
            {errorMessage && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                <div className="flex items-center">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errorMessage}
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                <div className="flex items-center">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {successMessage}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Ride Selection */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Select Match
                </span>
                <select
                  value={selectedFlight}
                  onChange={(e) => setSelectedFlight(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                >
                  <option value="">-- Select Match --</option>
                  {rides
                    .filter((ride) => {
                      const oneYearAgo = new Date()
                      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                      const [year, month, day] = ride.Flights.date
                        .split('-')
                        .map(Number)
                      const flightDate = new Date(year, month - 1, day)

                      return ride.user_id === userId && flightDate >= oneYearAgo
                    })
                    .map((ride) => {
                      const [year, month, day] = ride.Flights.date
                        .split('-')
                        .map(Number)
                      const flightDate = new Date(year, month - 1, day)
                      return (
                        <option key={ride.flight_id} value={ride.flight_id}>
                          {flightDate.toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                          })}{' '}
                          -{' '}
                          {ride.Flights.to_airport
                            ? 'School to ' + ride.Flights.airport
                            : ride.Flights.airport + ' to School'}
                        </option>
                      )
                    })}
                </select>
              </label>

              {/* Overall Rating */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Overall Rating
                </span>
                <div className="rounded-xl border border-gray-300 bg-white/50 p-3 transition-all duration-200 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20">
                  <StarRating
                    rating={overall}
                    onChange={(newRating) => setOverall(newRating)}
                  />
                </div>
              </label>

              {/* Convenience Rating */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Convenience Rating
                </span>
                <div className="rounded-xl border border-gray-300 bg-white/50 p-3 transition-all duration-200 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20">
                  <StarRating
                    rating={convenience}
                    onChange={(newRating) => setConvenience(newRating)}
                  />
                </div>
              </label>

              {/* Comments */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">
                  Comments (Optional)
                </span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  rows={4}
                  placeholder="Share your experience or suggestions..."
                />
              </label>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 p-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-teal-600 hover:to-teal-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>

          {/* Mobile Form - No container, simpler */}
          <div className="block md:hidden">
            {errorMessage && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
                <div className="flex items-center">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {errorMessage}
                </div>
              </div>
            )}

            {successMessage && (
              <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
                <div className="flex items-center">
                  <svg
                    className="mr-2 h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {successMessage}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Ride Selection */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Select Match
                </span>
                <select
                  value={selectedFlight}
                  onChange={(e) => setSelectedFlight(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  required
                >
                  <option value="">-- Select Match --</option>
                  {rides
                    .filter((ride) => {
                      const oneYearAgo = new Date()
                      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
                      const [year, month, day] = ride.Flights.date
                        .split('-')
                        .map(Number)
                      const flightDate = new Date(year, month - 1, day)

                      return ride.user_id === userId && flightDate >= oneYearAgo
                    })
                    .map((ride) => {
                      const [year, month, day] = ride.Flights.date
                        .split('-')
                        .map(Number)
                      const flightDate = new Date(year, month - 1, day)
                      return (
                        <option key={ride.flight_id} value={ride.flight_id}>
                          {flightDate.toLocaleDateString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                          })}{' '}
                          -{' '}
                          {ride.Flights.to_airport
                            ? 'School to ' + ride.Flights.airport
                            : ride.Flights.airport + ' to School'}
                        </option>
                      )
                    })}
                </select>
              </label>

              {/* Overall Rating */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Overall Rating
                </span>
                <div className="rounded-xl border border-gray-300 bg-white/50 p-3 transition-all duration-200 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20">
                  <StarRating
                    rating={overall}
                    onChange={(newRating) => setOverall(newRating)}
                  />
                </div>
              </label>

              {/* Convenience Rating */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                  Convenience Rating
                </span>
                <div className="rounded-xl border border-gray-300 bg-white/50 p-3 transition-all duration-200 focus-within:border-teal-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-teal-500/20">
                  <StarRating
                    rating={convenience}
                    onChange={(newRating) => setConvenience(newRating)}
                  />
                </div>
              </label>

              {/* Comments */}
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-gray-700">
                  Comments (Optional)
                </span>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  rows={4}
                  placeholder="Share your experience or suggestions..."
                />
              </label>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 p-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-teal-600 hover:to-teal-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                >
                  Submit Feedback
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
