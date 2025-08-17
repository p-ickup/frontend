'use client'

import { useEffect, useState } from 'react'
import RedirectButton from '@/components/buttons/RedirectButton'
import { createBrowserClient } from '@/utils/supabase'
import Image from 'next/image'
import ConfirmCancel from '@/components/questionnaires/ConfirmCancel'
import { ScrollArea } from '@/components/ui/scroll-area'

interface MatchForm {
  flight_id: string
  flight_no: string
  airline_iata: string
  date: string
  matched: boolean
  opt_in: boolean
}

export default function Questionnaires() {
  const supabase = createBrowserClient()
  const [matchForms, setMatchForms] = useState<MatchForm[]>([])
  const [message, setMessage] = useState('')
  const [modalFlightId, setModalFlightId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Function to format date from yyyy-mm-dd to mm/dd/yy
  const formatDate = (dateString: string) => {
    if (!dateString) return ''

    // Handle different date formats
    let date: Date

    if (dateString.includes('-')) {
      // Handle yyyy-mm-dd format
      const [year, month, day] = dateString.split('-')
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    } else {
      // Fallback for other formats
      date = new Date(dateString)
    }

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString // Return original string if parsing fails
    }

    // Format to mm/dd/yy
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2) // Get last 2 digits of year

    return `${month}/${day}/${year}`
  }

  useEffect(() => {
    const fetchMatchForms = async () => {
      const { data, error: authError } = await supabase.auth.getUser()
      setLoading(true)

      if (authError || !data?.user) {
        setMessage('Error: You must be logged in to view match forms.')
        return
      }

      const userId = data.user.id

      const { data: matchForms, error } = await supabase
        .from('Flights')
        .select('flight_id, flight_no, airline_iata, date, matched')
        .eq('user_id', userId)
        .order('date', { ascending: true })

      if (error) {
        console.error(
          'Error fetching match forms:',
          error.message,
          error.details,
        )
        setMessage(`Error fetching match forms: ${error.message}`)
      } else {
        setLoading(false)
        setMatchForms(matchForms as MatchForm[])
      }
    }

    fetchMatchForms()
  }, [])

  const handleDelete = (flightId: string) => {
    setModalFlightId(flightId) // ✅ Set the specific flight ID
  }

  const confirmDelete = async () => {
    if (!modalFlightId) return // Ensure there is a flight ID

    console.log('Deleting flight with ID:', modalFlightId)
    const { error } = await supabase
      .from('Flights')
      .delete()
      .eq('flight_id', modalFlightId)

    if (error) {
      console.error('Error deleting match form:', error)
      setMessage('Error deleting form.')
    } else {
      setMatchForms((prevForms) =>
        prevForms.filter((form) => form.flight_id !== modalFlightId),
      )
      console.log(`Flight ${modalFlightId} deleted successfully.`)
    }

    setModalFlightId(null) // ✅ Close modal after deletion
  }

  // variables dealing with showing specific forms
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to midnight to avoid timezone issues
  const threeDaysFromNow = new Date(today)
  threeDaysFromNow.setDate(today.getDate() + 3) // Add 3 days

  const editableUnmatched = matchForms.filter((form) => {
    const formDate = new Date(form.date)
    formDate.setHours(0, 0, 0, 0)
    return form.matched === false && formDate >= threeDaysFromNow
  })

  const noneditableUnmatched = matchForms.filter((form) => {
    const formDate = new Date(form.date)
    formDate.setHours(0, 0, 0, 0)
    return (
      form.matched == false && formDate < threeDaysFromNow && formDate >= today
    )
  })

  if (loading)
    return (
      <div className="flex items-center justify-center bg-blue-50 p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
        <span className="ml-2 text-teal-600">Loading Match Forms...</span>
      </div>
    )

  // DISPLAY!
  return (
    <div className="flex min-h-[calc(100vh-165px)] w-full flex-col bg-gray-100 text-black">
      {/* Buttons Section */}
      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <RedirectButton label="Update Profile" route="/profile" />
          <RedirectButton label="Request Match" route="/matchForm" />
        </div>
      </div>

      {/* Recent Match Forms */}
      <div className="mt-6 flex w-full flex-col items-center px-4 pb-8">
        <h1 className="text-2xl font-bold">Recent Match Forms</h1>

        {message && <p className="mb-4 text-red-500">{message}</p>}

        {/* Show forms within 3 days that havent been matched, redirect to Unmatched page*/}
        {noneditableUnmatched.length > 0 ? (
          <ul className="w-96 rounded-lg bg-white p-4 shadow-md">
            {noneditableUnmatched.map((form) => (
              <li key={form.flight_id} className="relative mb-4 border-b pb-2">
                <h1 className="text-lg">
                  <strong>‼️‼️We were unable to match you😕:</strong>{' '}
                </h1>
                <p>
                  <strong>Flight Number:</strong> {form.airline_iata}{' '}
                  {form.flight_no}
                </p>
                <p>
                  <strong>Date: </strong>
                  <span className="text-lg">{formatDate(form.date)}</span>
                </p>

                {/* Button container */}
                <div className="mt-[-20px] flex items-center justify-end gap-x-4">
                  <RedirectButton
                    label="Find others who need a ride!"
                    route={`/unmatched`} //TODO: direct to the Unmatched page
                    color="bg-teal-400"
                    size="px-4 py-2 text-lg"
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p> </p>
        )}

        <p> ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~</p>

        <ScrollArea className="h-[50vh]">
          {/* Show forms that can still be edited (3+ days prior to ride share) */}
          {editableUnmatched.length > 0 ? (
            <ul className="w-96 rounded-lg bg-white p-4 shadow-md">
              {editableUnmatched.map((form) => (
                <li
                  key={form.flight_id}
                  className="relative mb-4 border-b pb-2"
                >
                  <p>
                    <strong>Flight Number:</strong> {form.airline_iata}{' '}
                    {form.flight_no}
                  </p>
                  <p>
                    <strong>Date: </strong>
                    <span className="text-lg">{formatDate(form.date)}</span>
                  </p>

                  {/* Button container */}
                  <div className="mt-[-20px] flex items-center justify-end gap-x-4">
                    <RedirectButton
                      label="Edit"
                      route={`/editForm/${form.flight_id}`}
                      color="bg-teal-600"
                      size="px-4 py-2 text-lg"
                    />
                    <button
                      onClick={() => handleDelete(form.flight_id)}
                      className="flex items-center justify-center rounded-lg p-2 hover:bg-red-600"
                    >
                      <Image
                        src="/images/trashIcon.webp"
                        alt="Cancel Pending Match Form"
                        width={30}
                        height={30}
                        className="object-contain"
                      />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No match forms found.</p>
          )}
        </ScrollArea>
      </div>

      {/* ConfirmCancel Modal */}
      <ConfirmCancel
        isOpen={modalFlightId !== null}
        onClose={() => setModalFlightId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  )
}
