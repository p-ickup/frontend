'use client'

import { useEffect, useState } from 'react'
import RedirectButton from '@/components/buttons/RedirectButton'
import { createBrowserClient } from '@/utils/supabase'
import Image from 'next/image'
import ConfirmCancel from '@/components/questionnaires/ConfirmCancel'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAuth } from '@/hooks/useAuth'
import EmptyState from '@/components/results/EmptyState'

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
  const { user, isAuthenticated, signInWithGoogle } = useAuth()
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
    if (user) {
      void fetchMatchForms()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchMatchForms = async () => {
    try {
      setLoading(true)

      if (!user) {
        console.error('No authenticated user found')
        return
      }

      const userId = user.id

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
        setMatchForms(matchForms as MatchForm[])
      }
    } catch (error) {
      console.error('Error in fetchMatchForms:', error)
      setMessage('Error loading match forms')
    } finally {
      setLoading(false)
    }
  }

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
  // COMMENTED OUT - ORIGINAL LOGIC (3-day threshold)
  // const today = new Date()
  // today.setHours(0, 0, 0, 0) // Normalize to midnight to avoid timezone issues
  // const threeDaysFromNow = new Date(today)
  // threeDaysFromNow.setDate(today.getDate() + 3) // Add 3 days

  // const editableUnmatched = matchForms.filter((form) => {
  //   const formDate = new Date(form.date)
  //   formDate.setHours(0, 0, 0, 0)
  //   return form.matched === false && formDate >= threeDaysFromNow
  // })

  // const noneditableUnmatched = matchForms.filter((form) => {
  //   const formDate = new Date(form.date)
  //   formDate.setHours(0, 0, 0, 0)
  //   return (
  //     form.matched == false && formDate < threeDaysFromNow && formDate >= today
  //   )
  // })

  // NEW LOGIC - Allow modification of any current flight forms until 10/4/2025
  const today = new Date()
  today.setHours(0, 0, 0, 0) // Normalize to midnight to avoid timezone issues
  const cutoffDate = new Date('2025-10-04') // October 4, 2025
  cutoffDate.setHours(23, 59, 59, 999) // End of day

  // All unmatched forms are editable if today is before the cutoff date
  // After the cutoff date, no forms are editable regardless of flight date
  const isBeforeCutoff = today <= cutoffDate

  const editableUnmatched = matchForms.filter((form) => {
    const formDate = new Date(form.date)
    formDate.setHours(0, 0, 0, 0)
    return form.matched === false && isBeforeCutoff && formDate >= today
  })

  const noneditableUnmatched = matchForms.filter((form) => {
    const formDate = new Date(form.date)
    formDate.setHours(0, 0, 0, 0)
    return form.matched === false && (!isBeforeCutoff || formDate < today)
  })

  if (!isAuthenticated) {
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
        </div>

        <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-6">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="mb-6 text-4xl font-bold text-gray-900">
              Your Match Forms
            </h1>
            <p className="mb-8 text-xl text-gray-600">
              Sign in to view and manage your flight match requests
            </p>
            <div className="rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
              <EmptyState type="login" onLogin={signInWithGoogle} />
              <div className="mt-6">
                <RedirectButton label="Back to Home" route="/" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading)
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        </div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div className="flex items-center space-x-4 rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
            <span className="text-lg font-medium text-gray-700">
              Loading Match Forms...
            </span>
          </div>
        </div>
      </div>
    )

  // DISPLAY!
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

      <div className="relative flex min-h-screen w-full flex-col">
        {/* Header Section */}
        <div className="relative px-6 pb-6 pt-8">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h1 className="mb-4 text-4xl font-bold text-gray-900">
              Your Match Forms
            </h1>
            <p className="text-xl text-gray-600">
              Manage your flight requests and find travel companions
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="relative mb-8 flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-4">
            <RedirectButton label="Update Profile" route="/profile" />
            <RedirectButton label="Request Match" route="/matchForm" />
          </div>
        </div>

        {/* Content Section */}
        <div className="relative flex-1 px-6 pb-8">
          <div className="mx-auto max-w-4xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold text-gray-900">
                Recent Match Forms
              </h2>
            </div>

            {message && (
              <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
                <p className="font-medium text-red-600">{message}</p>
              </div>
            )}

            {/* Unmatched Forms Section */}
            {noneditableUnmatched.length > 0 && (
              <div className="mb-8">
                <div className="mb-4 text-center">
                  <h3 className="text-xl font-semibold text-gray-800">
                    ⚠️ Unmatched Flights
                  </h3>
                  <p className="text-gray-600">
                    We couldn&apos;t find matches for these flights
                  </p>
                </div>
                <div className="space-y-4">
                  {noneditableUnmatched.map((form) => (
                    <div
                      key={form.flight_id}
                      className="group relative rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-red-50 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:shadow-xl"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="mb-3 flex items-center space-x-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                              <svg
                                className="h-4 w-4 text-orange-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                              </svg>
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">
                              No Match Found
                            </h4>
                          </div>
                          <div className="space-y-2 text-gray-700">
                            <p>
                              <span className="font-medium">Flight:</span>{' '}
                              {form.airline_iata} {form.flight_no}
                            </p>
                            <p>
                              <span className="font-medium">Date:</span>{' '}
                              {formatDate(form.date)}
                            </p>
                          </div>
                        </div>
                        <div className="ml-4">
                          <RedirectButton
                            label="Find Others"
                            route="/unmatched"
                            color="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                            size="px-6 py-2 text-sm font-medium"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Editable Forms Section */}
            <div className="mb-8">
              <div className="mb-4 text-center">
                <h3 className="text-xl font-semibold text-gray-800">
                  📝 Editable Forms
                </h3>
                <p className="text-gray-600">
                  Forms you can still modify (until 10/4/2025)
                </p>
              </div>

              {editableUnmatched.length > 0 ? (
                <ScrollArea className="h-[50vh]">
                  <div className="space-y-4 pr-4">
                    {editableUnmatched.map((form) => (
                      <div
                        key={form.flight_id}
                        className="group relative rounded-2xl border border-gray-200 bg-white/80 p-6 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="mb-3 flex items-center space-x-2">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100">
                                <svg
                                  className="h-4 w-4 text-teal-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                              <h4 className="text-lg font-semibold text-gray-800">
                                Flight Request
                              </h4>
                            </div>
                            <div className="space-y-2 text-gray-700">
                              <p>
                                <span className="font-medium">Flight:</span>{' '}
                                {form.airline_iata} {form.flight_no}
                              </p>
                              <p>
                                <span className="font-medium">Date:</span>{' '}
                                {formatDate(form.date)}
                              </p>
                            </div>
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <RedirectButton
                              label="Edit"
                              route={`/editForm/${form.flight_id}`}
                              color="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
                              size="px-4 py-2 text-sm font-medium"
                            />
                            <button
                              onClick={() => handleDelete(form.flight_id)}
                              className="flex items-center justify-center rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <Image
                                src="/images/trashIcon.webp"
                                alt="Delete Form"
                                width={20}
                                height={20}
                                className="object-contain"
                              />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="rounded-2xl bg-white/80 p-8 text-center shadow-lg backdrop-blur-sm">
                  <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <h3 className="mb-2 text-lg font-semibold text-gray-800">
                    No Forms Yet
                  </h3>
                  <p className="text-gray-600">
                    Create your first flight request to get started!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
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
