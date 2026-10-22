'use client'

import type { AdminSummaryDto } from '@/contracts/readModels'
import type { NoShowRiderInfo } from '@/utils/adminMatchNoShows'
import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'
import { requestJson } from '@/utils/api'
import {
  estimateCancellationFee,
  formatCancellationFee,
} from '@/utils/cancellationFees'
import EmailComposerModal from '@/components/admin/EmailComposerModal'
import { useEffect, useState } from 'react'

const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)
  const datePart = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  })

  return `${datePart} – ${timePart} PT`
}

const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

type EmailAirport = '' | 'LAX' | 'ONT'
type EmailDirection = '' | 'TO' | 'FROM'

const describeMatchEmailAudience = (
  dateStart: string,
  dateEnd: string,
  airport: EmailAirport,
  direction: EmailDirection,
) => {
  const dates =
    dateStart && dateEnd
      ? `rides ${dateStart} to ${dateEnd}`
      : dateStart
        ? `rides from ${dateStart}`
        : dateEnd
          ? `rides until ${dateEnd}`
          : 'all ride dates'
  const route =
    direction === 'TO'
      ? `to ${airport || 'any airport'}`
      : direction === 'FROM'
        ? `from ${airport || 'any airport'}`
        : airport
          ? `to and from ${airport}`
          : 'all airports and directions'
  return `verified matches not yet emailed (${dates}, ${route})`
}

const getDefaultUnmatchedDateWindow = () => {
  const start = new Date()
  start.setDate(start.getDate() - 7)

  const end = new Date()
  end.setMonth(end.getMonth() + 1)

  return {
    start: formatDateForInput(start),
    end: formatDateForInput(end),
  }
}

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [school, setSchool] = useState<string>('')
  const [matchRate, setMatchRate] = useState<number>(0)
  const [matchedRiders, setMatchedRiders] = useState<number>(0)
  const [totalRiders, setTotalRiders] = useState<number>(0)
  const [algorithmLastRan, setAlgorithmLastRan] = useState<string>('')
  const [lastRunStatus, setLastRunStatus] = useState<string>('')
  const [nextScheduledRunDate, setNextScheduledRunDate] = useState<string>('')
  const [nextScheduledRunTarget, setNextScheduledRunTarget] =
    useState<string>('')
  const [unmatchedFlightsCount, setUnmatchedFlightsCount] = useState<number>(0)
  const [unmatchedDateStart, setUnmatchedDateStart] = useState<string>(
    () => getDefaultUnmatchedDateWindow().start,
  )
  const [unmatchedDateEnd, setUnmatchedDateEnd] = useState<string>(
    () => getDefaultUnmatchedDateWindow().end,
  )
  // Match emails: ride date range plus optional airport/direction filters
  const [matchEmailDateStart, setMatchEmailDateStart] = useState<string>(() =>
    formatDateForInput(new Date()),
  )
  const [matchEmailDateEnd, setMatchEmailDateEnd] = useState<string>('')
  const [matchEmailAirport, setMatchEmailAirport] = useState<EmailAirport>('')
  const [matchEmailDirection, setMatchEmailDirection] =
    useState<EmailDirection>('')
  const [showMatchEmailComposer, setShowMatchEmailComposer] = useState(false)

  // Unmatched emails state
  const [unmatchedEmailDateStart, setUnmatchedEmailDateStart] =
    useState<string>(() => formatDateForInput(new Date()))
  const [unmatchedEmailDateEnd, setUnmatchedEmailDateEnd] = useState<string>('')
  const [showUnmatchedEmailComposer, setShowUnmatchedEmailComposer] =
    useState(false)

  // Match cancellations (for fee billing)
  const [cancellationsDateStart, setCancellationsDateStart] = useState<string>(
    () => {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().split('T')[0]
    },
  )
  const [cancellationsDateEnd, setCancellationsDateEnd] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )
  const [cancellationsLoading, setCancellationsLoading] = useState(false)
  const [cancellationsFetchTarget, setCancellationsFetchTarget] = useState<
    'billable' | 'waived' | null
  >(null)
  const [cancellationsView, setCancellationsView] = useState<
    'billable' | 'waived' | null
  >(null)
  const [cancellations, setCancellations] = useState<
    Array<{
      id: number
      ride_id: number
      user_id: string
      flight_id: number
      cancelled_at: string
      match_date: string
      match_time: string
      airport: string
      to_airport: boolean
      is_subsidized: boolean | null
      cancelled_after_deadline: boolean
      cancelled_before_1hr: boolean
      cancellation_type: string | null
      waived: boolean
      firstname?: string
      lastname?: string
      email?: string
    }>
  >([])

  // Match no-shows: missing reports, pickup / delay follow-up
  const [noShowsDateStart, setNoShowsDateStart] = useState<string>(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0]
  })
  const [noShowsDateEnd, setNoShowsDateEnd] = useState<string>(
    () => new Date().toISOString().split('T')[0],
  )
  const [noShowsLoading, setNoShowsLoading] = useState(false)
  const [noShowRows, setNoShowRows] = useState<
    Array<{
      rideId: number
      missingUserId: string
      name: string
      /** Match date for this ride (`Matches.date` on the group / ride). */
      matchDate: string | null
      reporterCount: number
      /** Distinct riders on this ride in the loaded match rows (group size for ratio). */
      rideRosterSize: number
      info: NoShowRiderInfo
    }>
  >([])

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const defaultWindow = getDefaultUnmatchedDateWindow()
        const params = new URLSearchParams({
          unmatchedStart: unmatchedDateStart || defaultWindow.start,
          unmatchedEnd: unmatchedDateEnd || defaultWindow.end,
        })
        const summary = await requestJson<AdminSummaryDto>(
          `/api/admin/dashboard-summary?${params.toString()}`,
        )

        setSchool(summary.school)
        setAlgorithmLastRan(summary.algorithmLastRan)
        setLastRunStatus(summary.lastRunStatus)
        setNextScheduledRunDate(summary.nextScheduledRunDate)
        setNextScheduledRunTarget(summary.nextScheduledRunTarget)
        setTotalRiders(summary.totalRiders)
        setMatchedRiders(summary.matchedRiders)
        setMatchRate(summary.matchRate)
        setUnmatchedFlightsCount(summary.unmatchedFlightsCount)
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [unmatchedDateStart, unmatchedDateEnd])

  const fetchCancellations = async (waived: boolean) => {
    if (!cancellationsDateStart || !cancellationsDateEnd) return
    setCancellationsLoading(true)
    setCancellationsFetchTarget(waived ? 'waived' : 'billable')
    try {
      const result = await requestJson<{ rows: typeof cancellations }>(
        `/api/admin/reports?kind=cancellations&start=${encodeURIComponent(cancellationsDateStart)}&end=${encodeURIComponent(cancellationsDateEnd)}&waived=${waived}`,
      )
      setCancellations(result.rows)
      setCancellationsView(waived ? 'waived' : 'billable')
    } catch (err) {
      console.error('Error fetching cancellations:', err)
      setCancellations([])
      setCancellationsView(null)
    } finally {
      setCancellationsLoading(false)
      setCancellationsFetchTarget(null)
    }
  }

  const fetchMatchNoShows = async () => {
    if (!noShowsDateStart || !noShowsDateEnd) return
    setNoShowsLoading(true)
    try {
      const result = await requestJson<{ rows: typeof noShowRows }>(
        `/api/admin/reports?kind=no-shows&start=${encodeURIComponent(noShowsDateStart)}&end=${encodeURIComponent(noShowsDateEnd)}`,
      )
      setNoShowRows(result.rows)
    } catch (err) {
      console.error('Error fetching match no-shows:', err)
      setNoShowRows([])
    } finally {
      setNoShowsLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="relative flex min-h-screen items-center justify-center p-4">
          <div
            className="flex items-center space-x-4 rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm"
            role="status"
            aria-live="polite"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
            <span className="text-lg font-medium text-gray-700">
              Loading Dashboard...
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <h1 className="mb-8 text-3xl font-bold text-gray-900">
          Pickup Dashboard
        </h1>

        {/* Stats Cards - 5 Column Grid */}
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Last Run */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-teal-500 to-teal-600"></div>
            <div className="p-6">
              <p className="mb-2 text-sm text-gray-500">Last Run</p>
              <p className="mb-2 text-2xl font-bold text-gray-900">
                {algorithmLastRan || 'Never'}
              </p>
              {lastRunStatus && (
                <div className="mt-2">
                  <span className="inline-block rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    {lastRunStatus}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Next Scheduled Run */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-500"></div>
            <div className="p-6">
              <p className="mb-2 text-sm text-gray-500">Next Scheduled Run</p>
              <p className="mb-2 text-2xl font-bold text-gray-900">
                {nextScheduledRunDate || 'N/A'}
              </p>
              {nextScheduledRunTarget && (
                <div className="mt-2">
                  <span className="inline-block rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    Scheduled ({nextScheduledRunTarget})
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Card 3: Match Rate */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-cyan-500 to-cyan-600"></div>
            <div className="p-6">
              <p className="mb-2 text-sm text-gray-500">Match Rate</p>
              <p className="mb-2 text-3xl font-bold text-gray-900">
                {matchRate}%
              </p>
              <p className="mb-3 text-sm text-gray-600">
                {matchedRiders} / {totalRiders} riders matched
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-400">
                <div
                  className="h-full bg-[linear-gradient(to_right,theme(colors.red.500)_0%,theme(colors.orange.500)_10%,theme(colors.green.500)_60%)] transition-all duration-500"
                  style={{ width: `${matchRate}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Card 4: Unmatched Flight Forms */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-purple-500 to-purple-600"></div>
            <div className="p-6">
              <p className="mb-2 text-sm text-gray-500">
                Unmatched Flight Forms
              </p>
              <p className="mb-2 text-3xl font-bold text-gray-900">
                {unmatchedFlightsCount}
              </p>
              <div className="mt-4 space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={unmatchedDateStart}
                    onChange={(e) => setUnmatchedDateStart(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700">
                    To Date (optional)
                  </label>
                  <input
                    type="date"
                    value={unmatchedDateEnd}
                    onChange={(e) => setUnmatchedDateEnd(e.target.value)}
                    className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 5: School */}
          <div className="overflow-hidden rounded-lg bg-white shadow-md">
            <div className="h-1 bg-gradient-to-r from-lime-500 to-lime-600"></div>
            <div className="p-6">
              <p className="mb-2 text-sm text-gray-500">School</p>
              <p className="text-2xl font-bold text-gray-900">
                {school || 'Not set'}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap justify-center gap-4">
          <SimpleRedirectButton
            label="View & Manage Groups"
            route="/admin/groups"
            variant="cta"
          />
        </div>

        {/* Match no-shows — warm orange–yellow banner (Cancellations keeps red–orange) */}
        <div className="mb-8 rounded-lg bg-white shadow-md">
          <div className="border-b border-orange-300/90 bg-gradient-to-r from-yellow-200 via-amber-200 to-orange-300 px-6 py-4">
            <h2 className="text-orange-950 text-xl font-bold">
              Match No-Shows
            </h2>
            <p className="text-orange-950/90 mt-1 text-sm">
              View Riders reported as missing and whether they submitted their
              pickup or delay form.
            </p>
          </div>
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[160px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Match date from
                </label>
                <input
                  type="date"
                  value={noShowsDateStart}
                  onChange={(e) => setNoShowsDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Match date to (today)
                </label>
                <input
                  type="date"
                  value={noShowsDateEnd}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setNoShowsDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <button
                type="button"
                onClick={() => void fetchMatchNoShows()}
                disabled={noShowsLoading}
                className="rounded-lg bg-orange-500 px-4 py-2 font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {noShowsLoading ? 'Loading…' : 'Load no-shows'}
              </button>
            </div>

            {noShowRows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Rider (reported missing)
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Group #
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Ride match date
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Reported by
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Reporters / group
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Submitted ready-for-pickup later
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Delay / new flight (ChangeLog)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {noShowRows.map((row) => (
                      <tr key={`${row.rideId}-${row.missingUserId}`}>
                        <td className="px-4 py-2 font-medium text-gray-900">
                          {row.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                          {row.rideId}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                          {row.matchDate ? row.matchDate : '—'}
                        </td>
                        <td className="max-w-[12rem] px-4 py-2 text-gray-700">
                          {row.info.reporterNames.join(', ') || '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 font-medium tabular-nums text-gray-700">
                          {row.rideRosterSize > 0
                            ? `${row.reporterCount}/${row.rideRosterSize}`
                            : row.reporterCount}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.info.missingRiderSubmittedReady ? (
                            <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
                              Yes
                            </span>
                          ) : (
                            <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700">
                              Not yet
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.info.submittedDelayForRide
                            ? row.info.hadNewFlightOnDelay
                              ? 'Delay + new flight in log'
                              : 'Delay form in log'
                            : 'No delay in log'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-3 text-xs text-gray-600">
                  <strong>Ride match date</strong> = this group’s match date
                  from <code className="rounded bg-gray-100 px-1">Matches</code>
                  .<strong> Reporters / group</strong> = reporters ÷ riders on
                  the ride. Delay ={' '}
                  <code className="rounded bg-gray-100 px-1">ASPC_DELAY</code>.
                </p>
              </div>
            )}

            {noShowRows.length === 0 && !noShowsLoading && (
              <p className="py-4 text-center text-gray-500">
                Choose match dates above, then click &quot;Load no-shows&quot;
                to view records
              </p>
            )}
          </div>
        </div>

        {/* Match Cancellations (Fee Billing) */}
        <div className="mb-8 rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 bg-gradient-to-r from-red-500 to-orange-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">
              Match Cancellations (Fee Billing)
            </h2>
            <p className="mt-1 text-sm text-white/90">
              Billable = riders who were subsidized with a voucher or Connect
              shuttle. Waived = unsubsidized riders.
            </p>
          </div>
          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[160px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  From Date
                </label>
                <input
                  type="date"
                  value={cancellationsDateStart}
                  onChange={(e) => setCancellationsDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <div className="min-w-[160px]">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  To Date
                </label>
                <input
                  type="date"
                  value={cancellationsDateEnd}
                  onChange={(e) => setCancellationsDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900"
                />
              </div>
              <button
                type="button"
                onClick={() => fetchCancellations(false)}
                disabled={cancellationsLoading}
                className="rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {cancellationsLoading && cancellationsFetchTarget === 'billable'
                  ? 'Loading...'
                  : 'Load billable cancellations'}
              </button>
              <button
                type="button"
                onClick={() => fetchCancellations(true)}
                disabled={cancellationsLoading}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {cancellationsLoading && cancellationsFetchTarget === 'waived'
                  ? 'Loading...'
                  : 'Load waived cancellations'}
              </button>
            </div>

            {cancellationsView && cancellations.length > 0 && (
              <p className="mb-3 text-sm font-medium text-gray-600">
                Viewing:{' '}
                {cancellationsView === 'billable' ? 'Billable' : 'Waived'}{' '}
                cancellations
              </p>
            )}

            {cancellations.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Cancelled
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Rider
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Match Date/Time
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Airport
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        After Deadline
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-600">
                        Before 1hr
                      </th>
                      {cancellationsView === 'billable' && (
                        <th className="px-4 py-2 text-left font-medium text-gray-600">
                          Est. Fee
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {cancellations.map((c) => {
                      const fee = estimateCancellationFee({
                        airport: c.airport,
                        cancelled_after_deadline: c.cancelled_after_deadline,
                        cancelled_before_1hr: c.cancelled_before_1hr,
                        waived: c.waived,
                      })
                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                            {formatDateTime(c.cancelled_at)}
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-medium">
                              {c.firstname} {c.lastname}
                            </span>
                            <br />
                            <span className="text-xs text-gray-500">
                              {c.email}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-2 text-gray-700">
                            {c.match_date} {c.match_time?.slice(0, 5)}
                          </td>
                          <td className="px-4 py-2">{c.airport}</td>
                          <td className="px-4 py-2">
                            {c.cancelled_after_deadline ? (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                                Yes
                              </span>
                            ) : (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
                                No
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2">
                            {c.cancelled_before_1hr ? (
                              <span className="rounded bg-green-100 px-2 py-0.5 text-green-800">
                                Yes
                              </span>
                            ) : (
                              <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">
                                No
                              </span>
                            )}
                          </td>
                          {cancellationsView === 'billable' && (
                            <td className="whitespace-nowrap px-4 py-2 font-medium">
                              {formatCancellationFee(fee)}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm text-gray-600">
                  <span>
                    {cancellations.length} cancellation
                    {cancellations.length !== 1 ? 's' : ''}
                  </span>
                  <button
                    onClick={() => {
                      const csvHeaders =
                        cancellationsView === 'billable'
                          ? [
                              'Cancelled At',
                              'Name',
                              'Email',
                              'Match Date',
                              'Match Time',
                              'Airport',
                              'After Deadline',
                              'Before 1hr',
                              'Est. Fee',
                            ]
                          : [
                              'Cancelled At',
                              'Name',
                              'Email',
                              'Match Date',
                              'Match Time',
                              'Airport',
                              'After Deadline',
                              'Before 1hr',
                            ]
                      const csv = [
                        csvHeaders,
                        ...cancellations.map((c) => {
                          const fee = estimateCancellationFee({
                            airport: c.airport,
                            cancelled_after_deadline:
                              c.cancelled_after_deadline,
                            cancelled_before_1hr: c.cancelled_before_1hr,
                            waived: c.waived,
                          })
                          const row = [
                            formatDateTime(c.cancelled_at),
                            `${c.firstname || ''} ${c.lastname || ''}`.trim(),
                            c.email || '',
                            c.match_date,
                            c.match_time?.slice(0, 5) || '',
                            c.airport,
                            c.cancelled_after_deadline ? 'Yes' : 'No',
                            c.cancelled_before_1hr ? 'Yes' : 'No',
                          ]
                          if (cancellationsView === 'billable') {
                            row.push(formatCancellationFee(fee))
                          }
                          return row
                        }),
                      ]
                        .map((row) => row.join(','))
                        .join('\n')
                      const blob = new Blob([csv], { type: 'text/csv' })
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      const viewLabel =
                        cancellationsView === 'waived' ? 'waived' : 'billable'
                      a.download = `match-cancellations-${viewLabel}-${cancellationsDateStart}-to-${cancellationsDateEnd}.csv`
                      a.click()
                      window.URL.revokeObjectURL(url)
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            )}

            {cancellations.length === 0 && !cancellationsLoading && (
              <p className="py-4 text-center text-gray-500">
                Choose a date range, then load billable or waived cancellations
              </p>
            )}
          </div>
        </div>

        {/* Match Emails Section */}
        <div className="mb-8 rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Send Match Emails</h2>
          </div>

          <div className="p-6">
            <p className="mb-4 text-sm text-gray-600">
              Emails every verified match that has not been emailed yet. Narrow
              the recipients by ride date, airport and direction.
            </p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label
                  htmlFor="match-email-date-start"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Ride date from (optional)
                </label>
                <input
                  id="match-email-date-start"
                  type="date"
                  value={matchEmailDateStart}
                  onChange={(e) => setMatchEmailDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="match-email-date-end"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Ride date to (optional)
                </label>
                <input
                  id="match-email-date-end"
                  type="date"
                  value={matchEmailDateEnd}
                  min={matchEmailDateStart || undefined}
                  onChange={(e) => setMatchEmailDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label
                  htmlFor="match-email-airport"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Airport
                </label>
                <select
                  id="match-email-airport"
                  value={matchEmailAirport}
                  onChange={(e) =>
                    setMatchEmailAirport(e.target.value as EmailAirport)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All airports</option>
                  <option value="LAX">LAX</option>
                  <option value="ONT">ONT</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="match-email-direction"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Direction
                </label>
                <select
                  id="match-email-direction"
                  value={matchEmailDirection}
                  onChange={(e) =>
                    setMatchEmailDirection(e.target.value as EmailDirection)
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Both directions</option>
                  <option value="TO">To the airport</option>
                  <option value="FROM">From the airport</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowMatchEmailComposer(true)}
                className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
              >
                Email matched riders
              </button>
            </div>
            {showMatchEmailComposer && (
              <EmailComposerModal
                title="Email matched riders"
                audience={describeMatchEmailAudience(
                  matchEmailDateStart,
                  matchEmailDateEnd,
                  matchEmailAirport,
                  matchEmailDirection,
                )}
                placeholders={[
                  '{{name}}',
                  '{{rideDate}}',
                  '{{rideTime}}',
                  '{{airport}}',
                  '{{terminal}}',
                  '{{flightNumber}}',
                  '{{groupMembers}}',
                ]}
                endpoint="/api/admin/send-match-emails"
                filters={{
                  date_start: matchEmailDateStart || undefined,
                  date_end: matchEmailDateEnd || undefined,
                  airport: matchEmailAirport || undefined,
                  direction: matchEmailDirection || undefined,
                }}
                onClose={() => setShowMatchEmailComposer(false)}
              />
            )}
          </div>
        </div>

        {/* Unmatched Emails Section */}
        <div className="mb-8 rounded-lg bg-white shadow-md">
          <div className="border-b border-gray-200 bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white">
              Send Unmatched Rider Emails
            </h2>
          </div>

          <div className="p-6">
            <p className="mb-4 text-sm text-gray-600">
              Emails riders whose flights in this date range were not matched
              and have not been emailed yet.
            </p>
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="unmatched-email-date-start"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Flight date from
                </label>
                <input
                  id="unmatched-email-date-start"
                  type="date"
                  value={unmatchedEmailDateStart}
                  onChange={(e) => setUnmatchedEmailDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div>
                <label
                  htmlFor="unmatched-email-date-end"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Flight date to
                </label>
                <input
                  id="unmatched-email-date-end"
                  type="date"
                  value={unmatchedEmailDateEnd}
                  min={unmatchedEmailDateStart || undefined}
                  onChange={(e) => setUnmatchedEmailDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowUnmatchedEmailComposer(true)}
                className="rounded-lg bg-orange-600 px-6 py-3 font-medium text-white hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2"
              >
                Email unmatched riders
              </button>
            </div>
            {showUnmatchedEmailComposer && (
              <EmailComposerModal
                title="Email unmatched riders"
                audience={`unmatched riders not yet emailed (flights ${unmatchedEmailDateStart || '?'} to ${unmatchedEmailDateEnd || '?'})`}
                placeholders={[
                  '{{name}}',
                  '{{rideDate}}',
                  '{{airport}}',
                  '{{direction}}',
                ]}
                endpoint="/api/admin/send-unmatched-emails"
                filters={{
                  date_start: unmatchedEmailDateStart,
                  date_end: unmatchedEmailDateEnd,
                }}
                validate={() =>
                  unmatchedEmailDateStart && unmatchedEmailDateEnd
                    ? null
                    : 'Select both flight dates before previewing or sending.'
                }
                onClose={() => setShowUnmatchedEmailComposer(false)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
