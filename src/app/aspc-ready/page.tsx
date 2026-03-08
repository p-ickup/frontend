'use client'

import { Suspense } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { useSearchParams } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import RedirectButton from '@/components/buttons/RedirectButton'
import { isGroupReady } from '@/utils/groupReadiness'

type MatchRow = {
  ride_id: number
  user_id: string
  date: string | null
  time: string | null
  ready_for_pickup_at: string | null
  ready_for_pickup_status: 'ready' | 'reporting_missing' | null
  reported_missing_user_ids: string[] | null
  group_ready_at: string | null
  uber_type: string | null
  voucher: string | null
  Flights: {
    airport: string
    to_airport: boolean
    date: string
  } | null
  Users: {
    user_id: string
    firstname: string
  } | null
}

const getPickupLocation = (airport: string, toAirport: boolean): string => {
  if (toAirport) {
    return '647 N College Way (outside Lincoln Hall)'
  }
  if (airport === 'LAX') {
    return 'Take the LAX-it shuttle to rideshare area'
  }
  if (airport === 'ONT') {
    return 'At ONT: Group picks a curbside terminal meeting point. Use the inter-terminal bus between T2 and T4 if needed.'
  }
  return `${airport}'s rideshare location`
}

const DELAY_VERIFICATION_FORM_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfmAK5eeJK1Z-zgH-5f3YLpD4sywjpsjYZwgiZPGlis5a-04A/viewform'

function countConfirmed(matches: MatchRow[]): number {
  return matches.filter((m) => m.ready_for_pickup_at).length
}

function AspcReadyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rideIdParam = searchParams.get('ride_id')
  const rideId = rideIdParam ? parseInt(rideIdParam, 10) : null

  const { user, isAuthenticated, signInWithGoogle } = useAuth()
  const supabase = createBrowserClient()

  const [matches, setMatches] = useState<MatchRow[]>([])
  const [userRides, setUserRides] = useState<
    { ride_id: number; label: string }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [atPickupLocation, setAtPickupLocation] = useState(false)
  const [ackVehicleSize, setAckVehicleSize] = useState(false)
  const [ackWaitForGroup, setAckWaitForGroup] = useState(false)
  const [everyoneReady, setEveryoneReady] = useState(true)
  const [missingUserIds, setMissingUserIds] = useState<string[]>([])

  const fetchRideData = useCallback(async () => {
    if (!user) return

    if (rideId) {
      const { data, error: fetchError } = await supabase
        .from('Matches')
        .select(
          `
          ride_id,
          user_id,
          date,
          time,
          ready_for_pickup_at,
          ready_for_pickup_status,
          reported_missing_user_ids,
          group_ready_at,
          uber_type,
          voucher,
          Flights (airport, to_airport, date),
          Users (user_id, firstname)
        `,
        )
        .eq('ride_id', rideId)

      if (fetchError) {
        setError(fetchError.message)
        setMatches([])
        return
      }

      const matchesData = (data || []) as unknown as MatchRow[]
      const isMember = matchesData.some((m) => m.user_id === user.id)
      if (!isMember) {
        setError('You are not a member of this ride.')
        setMatches([])
        return
      }

      setMatches(matchesData)
    } else {
      const { data: userMatches, error: rideError } = await supabase
        .from('Matches')
        .select(
          `
          ride_id,
          date,
          time,
          group_ready_at,
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
          const sortKey =
            date && time ? new Date(date + 'T' + time).getTime() : 0
          return {
            ride_id: m.ride_id,
            label: `${dir}${flight?.airport || 'Airport'} | ${d}`,
            sortKey,
          }
        },
      )
      // Deduplicate by ride_id (keep first)
      const seenRideIds = new Set<number>()
      const deduped = rideEntries.filter((r) => {
        if (seenRideIds.has(r.ride_id)) return false
        seenRideIds.add(r.ride_id)
        return true
      })
      // Sort: upcoming first (soonest first), then past (most recent past first)
      const sorted = deduped.sort((a, b) => {
        const aUpcoming = a.sortKey >= now.getTime()
        const bUpcoming = b.sortKey >= now.getTime()
        if (aUpcoming && !bUpcoming) return -1
        if (!aUpcoming && bUpcoming) return 1
        if (aUpcoming && bUpcoming) return a.sortKey - b.sortKey
        return b.sortKey - a.sortKey
      })
      setUserRides(sorted.map(({ ride_id, label }) => ({ ride_id, label })))
    }
  }, [user, rideId, supabase])

  useEffect(() => {
    if (user) {
      setLoading(true)
      setError('')
      void fetchRideData().finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [user, fetchRideData])

  const firstMatch = matches[0]
  const groupReady = firstMatch?.group_ready_at != null
  const everyoneAccountedFor = isGroupReady(matches)
  const confirmedCount = countConfirmed(matches)
  const totalCount = matches.length
  const otherMembers = matches.filter((m) => m.user_id !== user?.id)
  const rideVoucher =
    matches.find((m) => m.voucher)?.voucher ?? firstMatch?.voucher ?? null
  const pickupLocation = firstMatch?.Flights
    ? getPickupLocation(
        firstMatch.Flights.airport,
        firstMatch.Flights.to_airport,
      )
    : ''
  const uberType = firstMatch?.uber_type || 'Uber'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !rideId) return

    if (!atPickupLocation || !ackVehicleSize || !ackWaitForGroup) {
      setError('Please confirm all items above before submitting.')
      return
    }

    if (!everyoneReady && missingUserIds.length === 0) {
      setError('Please select who is missing.')
      return
    }

    setSubmitting(true)
    setError('')

    const status = everyoneReady ? 'ready' : 'reporting_missing'
    const reportedMissing = everyoneReady ? [] : missingUserIds

    const { error: updateError } = await supabase
      .from('Matches')
      .update({
        ready_for_pickup_at: new Date().toISOString(),
        ready_for_pickup_status: status,
        reported_missing_user_ids: reportedMissing,
      })
      .eq('ride_id', rideId)
      .eq('user_id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSubmitting(false)
      return
    }

    const { data: updatedMatches } = await supabase
      .from('Matches')
      .select(
        'user_id, ready_for_pickup_at, ready_for_pickup_status, reported_missing_user_ids',
      )
      .eq('ride_id', rideId)

    const matchesData = (updatedMatches || []) as MatchRow[]
    const nowReady = isGroupReady(matchesData)

    if (nowReady) {
      await supabase
        .from('Matches')
        .update({ group_ready_at: new Date().toISOString() })
        .eq('ride_id', rideId)
    }

    setSuccess('Your response was saved.')
    setSubmitting(false)

    if (nowReady) {
      setSuccess(
        'Your group is ready! Your voucher is now available on the results page.',
      )
      router.refresh()
      setTimeout(() => router.push('/results'), 2000)
    } else {
      router.refresh()
      void fetchRideData()
    }
  }

  const toggleMissing = (userId: string) => {
    setMissingUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="relative flex min-h-screen flex-col items-center justify-center p-6">
          <div className="mx-auto max-w-md rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <h1 className="mb-4 text-2xl font-bold text-gray-800">
              ASPC Ready for Pickup
            </h1>
            <p className="mb-6 text-gray-600">
              Sign in to confirm your group is ready for pickup.
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

  if (!rideId && userRides.length > 0) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-12">
          <h1 className="mb-6 text-2xl font-bold text-gray-800 sm:text-3xl">
            Ready for Pickup
          </h1>
          <p className="mb-6 text-gray-600">
            Select a ride to confirm your group is ready:
          </p>
          <div className="space-y-3">
            {userRides.map((r) => (
              <a
                key={r.ride_id}
                href={`/aspc-ready?ride_id=${r.ride_id}`}
                className="block min-h-[48px] rounded-xl border border-gray-200 bg-white p-4 shadow-md transition hover:border-teal-300 hover:shadow-lg"
              >
                {r.label}
              </a>
            ))}
          </div>
          <div className="mt-8">
            <RedirectButton label="Back to Results" route="/results" />
          </div>
        </div>
      </div>
    )
  }

  if (!rideId && userRides.length === 0) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="relative mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-6 text-3xl font-bold text-gray-800">
            Ready for Pickup
          </h1>
          <p className="mb-6 text-gray-600">
            You don&apos;t have any upcoming rides. Go to the results page to
            view your matches.
          </p>
          <RedirectButton label="Back to Results" route="/results" />
        </div>
      </div>
    )
  }

  if (error && matches.length === 0) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="relative mx-auto max-w-2xl px-4 py-12">
          <h1 className="mb-6 text-3xl font-bold text-gray-800">
            Ready for Pickup
          </h1>
          <p className="mb-6 text-red-600">{error}</p>
          <RedirectButton label="Back to Results" route="/results" />
        </div>
      </div>
    )
  }

  if (groupReady) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative mx-auto max-w-2xl px-4 py-12">
          <div className="rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-800">
              Your group is ready!
            </h1>
            <p className="mb-6 text-gray-600">
              Your voucher is available on the results page.
            </p>
            <RedirectButton label="View Results" route="/results" />
          </div>
        </div>
      </div>
    )
  }

  const matchDate = firstMatch?.date
    ? new Date(firstMatch.date + 'T00:00:00').toLocaleDateString()
    : firstMatch?.Flights?.date
      ? new Date(firstMatch.Flights.date + 'T00:00:00').toLocaleDateString()
      : ''

  const matchTime = firstMatch?.time ? firstMatch.time.slice(0, 5) : ''

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <div className="rounded-2xl bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-8">
          {/* Delayed / Missing notice */}
          <a
            href={DELAY_VERIFICATION_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-6 flex w-full items-center gap-3 rounded-xl border-2 border-orange-200 bg-orange-50 p-4 transition hover:border-orange-300 hover:bg-orange-100"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-200">
              <svg
                className="h-5 w-5 text-orange-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-orange-900">
                Delayed or missing?
              </p>
              <p className="text-sm text-orange-800">
                If you are delayed or will miss this ride, fill out the Delay
                Verification Form.
              </p>
            </div>
            <svg
              className="h-5 w-5 shrink-0 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>

          <h1 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">
            Confirm your group is ready to receive voucher
          </h1>
          <p className="mb-6 text-gray-600">
            {firstMatch?.Flights?.to_airport
              ? `${firstMatch.Flights.airport} — School → Airport`
              : `${firstMatch?.Flights?.airport} — Airport → School`}
          </p>

          <div
            className={`mb-6 flex flex-col gap-3 rounded-lg border-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between ${
              everyoneAccountedFor
                ? 'border-green-300 bg-green-50'
                : 'border-orange-300 bg-orange-50'
            }`}
          >
            <div className="min-w-0 flex-1">
              <p
                className={`font-semibold ${everyoneAccountedFor ? 'text-green-800' : 'text-orange-800'}`}
              >
                {confirmedCount} of {totalCount} group members have confirmed
              </p>
              {everyoneAccountedFor ? (
                <p className="mt-1 text-sm text-green-700">
                  Everyone accounted for! You may return to the Results.
                  {rideVoucher && (
                    <span className="mt-2 block font-medium">
                      Voucher:{' '}
                      {rideVoucher.startsWith('https') ? (
                        <a
                          href={rideVoucher}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-green-800 underline hover:text-green-900"
                        >
                          {rideVoucher}
                        </a>
                      ) : (
                        rideVoucher
                      )}
                    </span>
                  )}
                  Your voucher will also appear on the results page.
                </p>
              ) : (
                <p className="mt-1 text-sm text-orange-700">
                  Complete the form below and press Confirm. If some members are
                  missing, select them below.
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void fetchRideData()}
              className={`min-h-[44px] shrink-0 text-sm font-medium hover:underline sm:min-h-0 ${
                everyoneAccountedFor ? 'text-green-600' : 'text-orange-600'
              }`}
            >
              Refresh
            </button>
          </div>

          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">
              {matchDate}
              {matchTime && ` at ${matchTime}`}
            </p>
            <p className="mt-1 text-sm text-gray-600">
              Pickup: {pickupLocation}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 sm:min-h-0 sm:items-center">
                <input
                  type="checkbox"
                  checked={atPickupLocation}
                  onChange={(e) => setAtPickupLocation(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-teal-600 sm:mt-0"
                />
                <span className="text-sm font-medium text-gray-700">
                  I&apos;m at the correct pickup location ({pickupLocation})
                </span>
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 sm:min-h-0 sm:items-center">
                <input
                  type="checkbox"
                  checked={ackVehicleSize}
                  onChange={(e) => setAckVehicleSize(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-teal-600 sm:mt-0"
                />
                <span className="text-sm font-medium text-gray-700">
                  I acknowledge the suggested vehicle size (Uber {uberType}). If
                  there are more people or bags than expected, you can order a
                  larger ride.
                </span>
              </label>
              <label className="flex min-h-[44px] cursor-pointer items-start gap-3 sm:min-h-0 sm:items-center">
                <input
                  type="checkbox"
                  checked={ackWaitForGroup}
                  onChange={(e) => setAckWaitForGroup(e.target.checked)}
                  className="mt-1 h-5 w-5 shrink-0 rounded border-gray-300 text-teal-600 sm:mt-0"
                />
                <span className="text-sm font-medium text-gray-700">
                  I acknowledge that I will wait for everyone in my group before
                  requesting the ride. If I know they are not showing up, are
                  delayed, or we have waited at least 15 minutes for them, I
                  will report them missing from the group.
                </span>
              </label>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-gray-700">
                Everyone in my group is:
              </p>
              <div className="space-y-3">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 sm:min-h-0">
                  <input
                    type="radio"
                    name="readyStatus"
                    checked={everyoneReady}
                    onChange={() => {
                      setEveryoneReady(true)
                      setMissingUserIds([])
                    }}
                    className="h-5 w-5 border-gray-300 text-teal-600"
                  />
                  <span>Here and ready</span>
                </label>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 sm:min-h-0">
                  <input
                    type="radio"
                    name="readyStatus"
                    checked={!everyoneReady}
                    onChange={() => setEveryoneReady(false)}
                    className="h-5 w-5 border-gray-300 text-teal-600"
                  />
                  <span>Some people are missing</span>
                </label>
              </div>

              {!everyoneReady && otherMembers.length > 0 && (
                <div className="mt-4 rounded-lg border border-gray-200 p-4">
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Who is missing? (check all that apply)
                  </p>
                  <div className="space-y-3">
                    {otherMembers.map((m) => (
                      <label
                        key={m.user_id}
                        className="flex min-h-[44px] cursor-pointer items-center gap-3 sm:min-h-0"
                      >
                        <input
                          type="checkbox"
                          checked={missingUserIds.includes(m.user_id)}
                          onChange={() => toggleMissing(m.user_id)}
                          className="h-5 w-5 rounded border-gray-300 text-teal-600"
                        />
                        <span>{m.Users?.firstname || 'Unknown'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="min-h-[48px] w-full rounded-lg bg-teal-500 px-4 py-3 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Confirm'}
            </button>
          </form>

          <div className="mt-8">
            <RedirectButton label="Back to Results" route="/results" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AspcReadyPage() {
  return (
    <Suspense
      fallback={
        <div className="from-slate-50 relative flex min-h-screen items-center justify-center bg-gradient-to-br via-blue-50 to-indigo-100">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500" />
        </div>
      }
    >
      <AspcReadyContent />
    </Suspense>
  )
}
