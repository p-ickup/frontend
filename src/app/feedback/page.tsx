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
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h2 className="mb-4 text-3xl font-bold">Leave Feedback</h2>
        <p className="mb-6">
          We value your feedback. Please fill out the form below.
        </p>
        {errorMessage && (
          <div className="mb-4 w-full rounded border border-red-400 bg-red-100 px-4 py-2 text-red-700">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 w-full rounded border border-green-400 bg-green-100 px-4 py-2 text-green-700">
            {successMessage}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="w-96 rounded-lg bg-white p-6 shadow-md"
        >
          {/* Ride Selection */}
          <label className="mb-2 block font-medium">
            Select Match:
            <select
              value={selectedFlight}
              onChange={(e) => setSelectedFlight(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
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
          <label className="mb-2 block font-medium">
            Overall Rating:
            <StarRating
              rating={overall}
              onChange={(newRating) => setOverall(newRating)}
            />
          </label>

          {/* Convenience Rating */}
          <label className="mb-2 block font-medium">
            Convenience Rating:
            <StarRating
              rating={convenience}
              onChange={(newRating) => setConvenience(newRating)}
            />
          </label>

          {/* Comments */}
          <label className="mb-4 block font-medium">
            Comments:
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              rows={4}
            />
          </label>

          {/* Submit */}
          <button
            type="submit"
            className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Submit Feedback
          </button>
        </form>
      </div>
    </div>
  )
}
