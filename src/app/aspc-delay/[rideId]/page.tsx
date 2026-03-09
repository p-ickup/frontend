'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { useCallback, useEffect, useState } from 'react'
import RedirectButton from '@/components/buttons/RedirectButton'
import FlightConfirmStep from '@/components/aspc-delay/FlightConfirmStep'
import NewFlightStep, {
  type NewFlightTimeRange,
} from '@/components/aspc-delay/NewFlightStep'
import ReasonForDelayStep from '@/components/aspc-delay/ReasonForDelayStep'
import DelayInfoStep from '@/components/aspc-delay/DelayInfoStep'
import {
  useFindNewMatch,
  type FindNewMatchResult,
} from '@/hooks/useFindNewMatch'
import type {
  AspcDelayFormState,
  DelayFormCurrentFlight,
  DelayFormNewFlight,
  DelayReasonKey,
} from '@/components/aspc-delay/types'
import { REASON_FOR_DELAY_LABELS } from '@/components/aspc-delay/types'

const initialFormState: AspcDelayFormState = {
  step: 0,
  flightUnchanged: null,
  newFlight: null,
  reasonForDelay: null,
  customReasonText: '',
  newEtaDate: '',
  newEtaTime: '',
  newEtaTimeEarliest: '',
  newEtaTimeLatest: '',
}

export default function AspcDelayPage() {
  const params = useParams()
  const rideId = params.rideId as string
  const { user } = useAuth()
  const supabase = createBrowserClient()
  const {
    findNewMatch,
    joinGroup,
    declineAllGroups,
    loading: findNewMatchLoading,
  } = useFindNewMatch()

  const [formState, setFormState] =
    useState<AspcDelayFormState>(initialFormState)
  const [currentFlight, setCurrentFlight] =
    useState<DelayFormCurrentFlight | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [defaultEtaDate, setDefaultEtaDate] = useState('')
  const [findResult, setFindResult] = useState<FindNewMatchResult | null>(null)
  const [joinedRideId, setJoinedRideId] = useState<number | null>(null)
  const [joiningRideId, setJoiningRideId] = useState<number | null>(null)
  const [choseUnmatched, setChoseUnmatched] = useState(false)
  const [declining, setDeclining] = useState(false)

  const fetchRideAndFlight = useCallback(async () => {
    if (!user || !rideId) return
    setLoading(true)
    setError(null)
    try {
      const rid = parseInt(rideId, 10)
      if (Number.isNaN(rid)) {
        setError('Invalid ride.')
        return
      }
      const { data, error: fetchError } = await supabase
        .from('Matches')
        .select(
          `
          ride_id,
          user_id,
          date,
          time,
          Flights (
            airport,
            to_airport,
            date,
            flight_no,
            airline_iata,
            earliest_time,
            latest_time
          )
        `,
        )
        .eq('ride_id', rid)
        .eq('user_id', user.id)
        .maybeSingle()

      if (fetchError) {
        setError(fetchError.message)
        return
      }
      if (!data) {
        setError('You are not part of this ride.')
        return
      }
      const flight = Array.isArray(data.Flights)
        ? data.Flights[0]
        : data.Flights
      if (!flight) {
        setError('No flight found for this match.')
        return
      }
      const f = flight as {
        airport: string
        to_airport: boolean
        date: string
        flight_no: string
        airline_iata: string
        earliest_time?: string
        latest_time?: string
      }
      setCurrentFlight({
        airport: f.airport,
        to_airport: f.to_airport,
        date: f.date,
        flight_no: f.flight_no ?? '',
        airline_iata: f.airline_iata ?? '',
        earliest_time: f.earliest_time,
        latest_time: f.latest_time,
      })
      setDefaultEtaDate(f.date)
      setFormState((s) => ({ ...s, newEtaDate: s.newEtaDate || f.date }))
    } finally {
      setLoading(false)
    }
  }, [user, rideId, supabase])

  useEffect(() => {
    if (user && rideId) void fetchRideAndFlight()
    else setLoading(false)
  }, [user, rideId, fetchRideAndFlight])

  const goToStep2 = () => setFormState((s) => ({ ...s, step: 2 }))
  const goToStep3 = () => setFormState((s) => ({ ...s, step: 3 }))
  const goBack = () =>
    setFormState((s) => {
      if (s.step === 1) return { ...s, step: 0 }
      if (s.step === 2)
        return { ...s, step: s.flightUnchanged === false ? 1 : 0 }
      if (s.step === 3) return { ...s, step: 2 }
      return s
    })

  const persistReasonForDelay = useCallback(
    async (reason: DelayReasonKey, customText: string) => {
      if (!user || !rideId) return
      const value =
        reason === 'custom'
          ? `Custom Delay: "${customText.trim()}"`
          : REASON_FOR_DELAY_LABELS[reason as DelayReasonKey]
      const { error: updateError } = await supabase
        .from('Matches')
        .update({ reason_for_delay: value } as Record<string, unknown>)
        .eq('ride_id', parseInt(rideId, 10))
        .eq('user_id', user.id)
      if (updateError) {
        console.error('Failed to save reason_for_delay:', updateError)
      }
    },
    [user, rideId, supabase],
  )

  const handleConfirmSame = () => {
    setFormState((s) => ({ ...s, flightUnchanged: true, step: 2 }))
  }

  const handleConfirmChanged = () => {
    setFormState((s) => ({ ...s, flightUnchanged: false, step: 1 }))
  }

  const handleNewFlightSubmit = (
    flight: DelayFormNewFlight,
    timeRange?: NewFlightTimeRange,
  ) => {
    setFormState((s) => ({
      ...s,
      newFlight: flight,
      newEtaTimeEarliest: timeRange?.earliest ?? '',
      newEtaTimeLatest: timeRange?.latest ?? '',
      step: 2,
    }))
  }

  const handleReasonContinue = async () => {
    if (
      formState.reasonForDelay &&
      (formState.reasonForDelay !== 'custom' ||
        formState.customReasonText.trim())
    ) {
      await persistReasonForDelay(
        formState.reasonForDelay as DelayReasonKey,
        formState.customReasonText,
      )
    }
    goToStep3()
  }

  const defaultDateForEta =
    formState.newFlight?.date || currentFlight?.date || defaultEtaDate
  const newEtaDate = formState.newEtaDate || defaultDateForEta
  const isDifferentDay =
    defaultDateForEta && newEtaDate && newEtaDate !== defaultDateForEta
  const showTimeRangeOnDelayStep =
    isDifferentDay || Boolean(formState.newFlight)

  const handleFindNewMatch = async () => {
    if (!user) return
    const reasonValue =
      formState.reasonForDelay === 'custom'
        ? `Custom Delay: "${formState.customReasonText.trim()}"`
        : formState.reasonForDelay
          ? REASON_FOR_DELAY_LABELS[formState.reasonForDelay]
          : ''
    const fromNewFlight = Boolean(formState.newFlight)
    const result = await findNewMatch({
      rideId,
      userId: user.id,
      reasonForDelay: reasonValue,
      newEtaDate: fromNewFlight
        ? formState.newFlight!.date
        : formState.newEtaDate || defaultDateForEta,
      newEtaTime: fromNewFlight
        ? formState.newEtaTimeEarliest || formState.newFlight!.time
        : isDifferentDay
          ? formState.newEtaTimeEarliest
          : formState.newEtaTime,
      ...(fromNewFlight &&
      formState.newEtaTimeEarliest &&
      formState.newEtaTimeLatest
        ? {
            newEtaTimeEarliest: formState.newEtaTimeEarliest,
            newEtaTimeLatest: formState.newEtaTimeLatest,
          }
        : isDifferentDay &&
            formState.newEtaTimeEarliest &&
            formState.newEtaTimeLatest
          ? {
              newEtaTimeEarliest: formState.newEtaTimeEarliest,
              newEtaTimeLatest: formState.newEtaTimeLatest,
            }
          : {}),
      newFlight: formState.newFlight ?? undefined,
    })
    if (result) {
      if (!result.success) {
        setError(result.error ?? 'Something went wrong')
        return
      }
      setFindResult(result)
    }
  }

  if (loading) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-12">
          <div className="rounded-2xl bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-8">
            <p className="mb-4 text-red-600">{error}</p>
            <RedirectButton label="Back to Results" route="/results" />
          </div>
        </div>
      </div>
    )
  }

  if (findResult?.success) {
    const groups = findResult.availableGroups ?? []
    const hasGroups = groups.length > 0
    const showVoucher =
      !hasGroups && findResult.wasSubsidized && findResult.contingencyVoucher

    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="relative flex min-h-screen w-full items-center justify-center p-4">
          <div className="w-full max-w-2xl">
            <div className="rounded-2xl bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-6 md:rounded-3xl md:p-8">
              {joinedRideId != null ? (
                <>
                  <p className="mb-4 text-gray-800">
                    You&apos;ve been added to the group. Your Results page has
                    been updated.
                  </p>
                </>
              ) : choseUnmatched ? (
                <>
                  <p className="mb-4 text-gray-800">
                    You&apos;ve been removed from your group. You can look for
                    other riders on the unmatched page.
                  </p>
                  <p className="text-sm text-gray-600">
                    <Link
                      href="/unmatched"
                      className="font-medium text-teal-600 underline hover:text-teal-700"
                    >
                      Go to unmatched page
                    </Link>
                  </p>
                </>
              ) : hasGroups ? (
                <>
                  <h2 className="mb-2 text-lg font-semibold text-gray-800 sm:text-xl">
                    Available groups
                  </h2>
                  <p className="mb-4 text-sm text-gray-600">
                    Groups on your date and route that can accommodate you.
                  </p>
                  <ul className="space-y-3">
                    {groups.map((g) => (
                      <li
                        key={g.rideId}
                        className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-gray-900">
                            {new Date(g.date + 'T00:00:00').toLocaleDateString(
                              'en-US',
                              {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              },
                            )}{' '}
                            at {g.rideTime}
                          </span>
                          <span className="text-sm text-gray-600">
                            Uber {g.rideType} · {g.riderCount}{' '}
                            {g.riderCount === 1 ? 'person' : 'people'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!user) return
                            setJoiningRideId(g.rideId)
                            const res = await joinGroup({
                              currentRideId: parseInt(rideId, 10),
                              userId: user.id,
                              selectedRideId: g.rideId,
                            })
                            setJoiningRideId(null)
                            if (res?.success) setJoinedRideId(g.rideId)
                            else setError(res?.error ?? 'Failed to join group')
                          }}
                          disabled={joiningRideId != null}
                          className="shrink-0 rounded-xl border-2 border-teal-600 bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                        >
                          {joiningRideId === g.rideId
                            ? 'Joining…'
                            : 'Join this group'}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!user) return
                        setDeclining(true)
                        const res = await declineAllGroups({
                          currentRideId: parseInt(rideId, 10),
                          userId: user.id,
                        })
                        setDeclining(false)
                        if (res?.success) setChoseUnmatched(true)
                        else setError(res?.error ?? 'Failed to leave group')
                      }}
                      disabled={declining}
                      className="text-sm font-medium text-gray-600 underline hover:text-gray-800 disabled:opacity-50"
                    >
                      {declining
                        ? 'Leaving…'
                        : "Don't join any group — I'll go to unmatched"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {showVoucher ? (
                    <>
                      <p className="mb-3 text-gray-800">
                        We couldn&apos;t find a new group, but you qualify for a
                        contingency voucher.
                      </p>
                      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <p className="mb-2 text-sm font-semibold text-amber-900">
                          Contingency voucher
                        </p>
                        <a
                          href={findResult.contingencyVoucher ?? '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-sm font-medium text-teal-600 underline hover:text-teal-700"
                        >
                          {findResult.contingencyVoucher}
                        </a>
                        <p className="mt-2 text-xs text-amber-800">
                          Take note of this voucher.
                        </p>
                      </div>
                      <p className="text-sm text-gray-600">
                        This voucher is also saved on your Results page for
                        reference.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-4 text-gray-800">
                        Unfortunately, your flight did not qualify for a
                        contingency voucher and we were unable to find a match
                        for you.
                      </p>
                      <p className="text-sm text-gray-600">
                        Please keep an eye out on the{' '}
                        <Link
                          href="/unmatched"
                          className="font-medium text-teal-600 underline hover:text-teal-700"
                        >
                          unmatched page
                        </Link>{' '}
                        for opportunities to connect with other riders.
                      </p>
                    </>
                  )}
                </>
              )}
              <div className="mt-6 border-t border-gray-200 pt-4">
                <RedirectButton
                  label="Back to Results"
                  route="/results"
                  className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-700 hover:bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20" />
        <div
          className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="animate-float absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        />
      </div>

      <div className="relative flex min-h-screen w-full items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="mb-4 text-center md:mb-6">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg md:h-16 md:w-16">
              <svg
                className="h-7 w-7 text-white md:h-8 md:w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h1 className="mb-1 text-xl font-bold text-gray-900 sm:text-2xl md:text-3xl">
              Report a delay
            </h1>
            <p className="text-sm text-gray-600 sm:text-base">
              Ride ID: {rideId}
            </p>
          </div>

          <div className="rounded-2xl bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-6 md:rounded-3xl md:p-8">
            {formState.step >= 1 && (
              <div className="mb-4">
                <button
                  type="button"
                  onClick={goBack}
                  className="flex items-center gap-2 rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  Back
                </button>
              </div>
            )}
            {formState.step === 0 && (
              <FlightConfirmStep
                currentFlight={currentFlight}
                onConfirmSame={handleConfirmSame}
                onConfirmChanged={handleConfirmChanged}
              />
            )}
            {formState.step === 1 && (
              <NewFlightStep
                defaultDate={currentFlight?.date ?? defaultEtaDate}
                newFlight={formState.newFlight}
                onContinue={handleNewFlightSubmit}
              />
            )}
            {formState.step === 2 && (
              <ReasonForDelayStep
                selectedReason={formState.reasonForDelay}
                customReasonText={formState.customReasonText}
                onSelect={(reason) =>
                  setFormState((s) => ({ ...s, reasonForDelay: reason }))
                }
                onCustomTextChange={(text) =>
                  setFormState((s) => ({ ...s, customReasonText: text }))
                }
                onContinue={handleReasonContinue}
              />
            )}
            {formState.step === 3 && (
              <DelayInfoStep
                flightChanged={formState.flightUnchanged === false}
                newFlight={formState.newFlight}
                newFlightTimeEarliest={formState.newEtaTimeEarliest}
                newFlightTimeLatest={formState.newEtaTimeLatest}
                defaultDate={defaultDateForEta}
                newEtaDate={newEtaDate}
                newEtaTime={formState.newEtaTime}
                newEtaTimeEarliest={formState.newEtaTimeEarliest}
                newEtaTimeLatest={formState.newEtaTimeLatest}
                showTimeRange={showTimeRangeOnDelayStep}
                onDateChange={(date) =>
                  setFormState((s) => ({ ...s, newEtaDate: date }))
                }
                onTimeChange={(time) =>
                  setFormState((s) => ({ ...s, newEtaTime: time }))
                }
                onEarliestChange={(time) =>
                  setFormState((s) => ({ ...s, newEtaTimeEarliest: time }))
                }
                onLatestChange={(time) =>
                  setFormState((s) => ({ ...s, newEtaTimeLatest: time }))
                }
                onFindNewMatch={handleFindNewMatch}
                isFindNewMatchLoading={findNewMatchLoading}
              />
            )}

            <div className="mt-6 border-t border-gray-200 pt-4">
              <RedirectButton
                label="Back to Results"
                route="/results"
                className="rounded-xl border-2 border-gray-300 bg-white px-4 py-2.5 text-base font-semibold text-gray-700 hover:bg-gray-50"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
