'use client'

import { useEffect, useState } from 'react'
import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import { createBrowserClient } from '@/utils/supabase'

interface MatchForm {
  flight_id: string
  flight_no: string
  date: string
}

export default function Questionnaires() {
  const supabase = createBrowserClient()
  const [matchForms, setMatchForms] = useState<MatchForm[]>([]) // Define state type
  const [message, setMessage] = useState('')

  useEffect(() => {
    const fetchMatchForms = async () => {
      const { data, error: authError } = await supabase.auth.getUser()

      if (authError || !data?.user) {
        setMessage('Error: You must be logged in to view match forms.')
        return
      }

      const userId = data.user.id // ✅ Correctly access user ID

      const { data: matchForms, error } = await supabase
        .from('Flights')
        .select('flight_id, flight_no, date')
        .eq('user_id', userId) // ✅ Now using correct user ID
        .order('date', { ascending: false })

      if (error) {
        console.error(
          'Error fetching match forms:',
          error.message,
          error.details,
        )
        setMessage(`Error fetching match forms: ${error.message}`)
      } else {
        setMatchForms(matchForms as MatchForm[]) // ✅ Ensure TypeScript knows the format
      }
    }

    fetchMatchForms()
  }, [])

  const handleDelete = async (flightId: string) => {
    const { error } = await supabase
      .from('Flights')
      .delete()
      .eq('flight_id', flightId)

    if (error) {
      console.error('Error deleting match form:', error)
      setMessage('Error deleting form.')
    } else {
      setMatchForms((prevForms) =>
        prevForms.filter((form) => form.flight_id !== flightId),
      )
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      {/* Header at the top */}
      <PickupHeader />

      {/* Buttons Section */}
      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <RedirectButton label="Update Profile" route="/profile" />
          <RedirectButton label="Add New Match" route="/matchForm" />
        </div>
      </div>

      {/* Recent Match Forms */}
      <div className="mt-6 flex w-full flex-col items-center px-4">
        <h1 className="text-2xl font-bold">Recent Match Forms</h1>

        {message && <p className="mb-4 text-red-500">{message}</p>}

        {matchForms.length > 0 ? (
          <ul className="w-96 rounded-lg bg-white p-4 shadow-md">
            {matchForms.map((form) => (
              <li key={form.flight_id} className="mb-4 border-b pb-2">
                <p>
                  <strong>Flight Number:</strong> {form.flight_no}
                </p>
                <p>
                  <strong>Date:</strong> {form.date}
                </p>
                <div className="mt-2 flex justify-between">
                  <RedirectButton
                    label="Edit"
                    route={`/editForm/${form.flight_id}`}
                  />
                  <button
                    onClick={() => handleDelete(form.flight_id)}
                    className="ml-4 rounded bg-red-600 px-3 py-1 text-white hover:bg-red-700"
                  >
                    Cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No match forms found.</p>
        )}
      </div>
    </div>
  )
}
