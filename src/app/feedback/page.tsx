'use client'

import { createBrowserClient } from '@/utils/supabase'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import StarRating from '@/components/feedback/StarRating'

export default function FeedbackForm() {
  const supabase = createBrowserClient()

  type Ride = {
    ride_id: string
    user_id: string
    flight_id: string
  }

  const [rides, setRides] = useState<Ride[]>([])
  const [selectedRide, setSelectedRide] = useState('')
  const [overall, setOverall] = useState<number>(0)
  const [convenience, setConvenience] = useState<number>(0)
  const [comments, setComments] = useState('')
  const [userId, setUserId] = useState('')

  useEffect(() => {
    // Fetch rides (matches) from Supabase
    const fetchRides = async () => {
      const { data, error } = await supabase.from('Matches').select('*')
      if (error) console.error('Error fetching rides:', error)
      else setRides(data)
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

    const { error } = await supabase.from('Feedback').insert([
      {
        user_id: userId,
        ride_id: selectedRide,
        overall,
        convenience,
        comments,
      },
    ])

    if (error) {
      console.error('Error submitting feedback:', error)
      alert('Error submitting feedback!')
    } else {
      alert('Feedback submitted successfully!')
      // Optionally, clear form
      setSelectedRide('')
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

        <form
          onSubmit={handleSubmit}
          className="w-96 rounded-lg bg-white p-6 shadow-md"
        >
          {/* Ride Selection */}
          <label className="mb-2 block font-medium">
            Select Match:
            <select
              value={selectedRide}
              onChange={(e) => setSelectedRide(e.target.value)}
              className="mt-1 w-full rounded border bg-white p-2 text-black"
              required
            >
              <option value="">-- Select Match --</option>
              {rides
                .filter((ride) => ride.user_id === userId)
                .map((ride) => (
                  <option key={ride.ride_id} value={ride.ride_id}>
                    {ride.flight_id}
                  </option>
                ))}
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
