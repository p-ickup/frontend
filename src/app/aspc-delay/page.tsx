'use client'

import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import RedirectButton from '@/components/buttons/RedirectButton'

type RideEntry = {
  ride_id: number
  label: string
  sortKey: number
}

function AspcDelayListContent() {
  const { user, isAuthenticated, signInWithGoogle } = useAuth()
  const supabase = createBrowserClient()

  const [userRides, setUserRides] = useState<
    { ride_id: number; label: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchRideData = useCallback(async () => {
    if (!user) return

    const { data: userMatches, error: rideError } = await supabase
      .from('Matches')
      .select(
        `
        ride_id,
        date,
        time,
        Flights (airport, to_airport, date)
      `,
      )
      .eq('user_id', user.id)

    if (rideError) {
      setError(rideError.message)
      setUserRides([])
      return
    }

    const now = new Date()
    const rideEntries = (userMatches || []).map(
      (m: {
        ride_id: number
        date: string | null
        time: string | null
        Flights: unknown
      }) => {
        const flight = Array.isArray(m.Flights)
          ? (
              m.Flights as {
                airport?: string
                to_airport?: boolean
                date?: string
              }[]
            )[0]
          : (m.Flights as {
              airport?: string
              to_airport?: boolean
              date?: string
            } | null)
        const date = m.date || flight?.date || ''
        const time = m.time || '00:00'
        const d = date
          ? new Date(date + 'T00:00:00').toLocaleDateString()
          : 'Unknown'
        const dir = flight?.to_airport ? 'School → ' : ''
        const sortKey = date && time ? new Date(date + 'T' + time).getTime() : 0
        return {
          ride_id: m.ride_id,
          label: `${dir}${flight?.airport || 'Airport'} | ${d}`,
          sortKey,
        }
      },
    )
    // Deduplicate by ride_id (keep first)
    const seenRideIds = new Set<number>()
    const deduped = rideEntries.filter((r: RideEntry) => {
      if (seenRideIds.has(r.ride_id)) return false
      seenRideIds.add(r.ride_id)
      return true
    })
    // Sort: upcoming first (soonest first), then past (most recent past first)
    const sorted = deduped.sort((a: RideEntry, b: RideEntry) => {
      const aUpcoming = a.sortKey >= now.getTime()
      const bUpcoming = b.sortKey >= now.getTime()
      if (aUpcoming && !bUpcoming) return -1
      if (!aUpcoming && bUpcoming) return 1
      if (aUpcoming && bUpcoming) return a.sortKey - b.sortKey
      return b.sortKey - a.sortKey
    })
    setUserRides(sorted.map(({ ride_id, label }) => ({ ride_id, label })))
  }, [user, supabase])

  useEffect(() => {
    if (user) {
      setLoading(true)
      setError('')
      void fetchRideData().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user, fetchRideData])

  if (!isAuthenticated) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
          <div className="mx-auto max-w-md rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <h1 className="mb-4 text-2xl font-bold text-gray-800">
              Report a Delay
            </h1>
            <p className="mb-6 text-gray-600">
              Sign in to report a flight delay and get rematched or a
              contingency voucher.
            </p>
            <button
              onClick={() => void signInWithGoogle()}
              className="w-full rounded-lg bg-teal-500 px-4 py-3 font-semibold text-white transition hover:bg-teal-600"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="from-slate-50 relative flex min-h-screen items-center justify-center bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
      </div>
    )
  }

  if (userRides.length > 0) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-12">
          <h1 className="mb-6 text-2xl font-bold text-gray-800 sm:text-3xl">
            Report a Delay
          </h1>
          <p className="mb-6 text-gray-600">
            Select a ride to report a flight delay:
          </p>
          <div className="space-y-3">
            {userRides.map((r) => (
              <Link
                key={r.ride_id}
                href={`/aspc-delay/${r.ride_id}`}
                className="block min-h-[48px] rounded-xl border border-gray-200 bg-white p-4 shadow-md transition hover:border-orange-300 hover:shadow-lg"
              >
                {r.label}
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <RedirectButton label="Back to Results" route="/results" />
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="relative mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-6 text-3xl font-bold text-gray-800">
            Report a Delay
          </h1>
          <p className="mb-6 text-red-600">{error}</p>
          <RedirectButton label="Back to Results" route="/results" />
        </div>
      </div>
    )
  }

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      <div className="relative mx-auto max-w-2xl px-4 py-12">
        <h1 className="mb-6 text-3xl font-bold text-gray-800">
          Report a Delay
        </h1>
        <p className="mb-6 text-gray-600">
          You don&apos;t have any rides. Go to the results page to view your
          matches.
        </p>
        <RedirectButton label="Back to Results" route="/results" />
      </div>
    </div>
  )
}

export default function AspcDelayListPage() {
  return (
    <Suspense
      fallback={
        <div className="from-slate-50 relative flex min-h-screen items-center justify-center bg-gradient-to-br via-blue-50 to-indigo-100">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
        </div>
      }
    >
      <AspcDelayListContent />
    </Suspense>
  )
}
