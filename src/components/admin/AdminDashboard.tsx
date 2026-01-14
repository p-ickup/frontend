'use client'

import { useAuth } from '@/hooks/useAuth'
import { createBrowserClient } from '@/utils/supabase'
import { User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

interface AdminDashboardProps {
  user: User
}

interface DryRunResult {
  ride_id: number
  name: string
  email: string
  date: string
  time_range: string
  carry_on_bags: number
  checked_bags: number
  airport: string
  to_airport: boolean
}

// Helper function to normalize date and time formatting (UTC to Pacific Time)
const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString)

  // Format date in Pacific Time (America/Los_Angeles)
  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  })

  // Format time in Pacific Time
  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'America/Los_Angeles',
  })

  return `${dateStr} – ${timeStr} PT`
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const supabase = createBrowserClient()
  const { user: authUser } = useAuth()
  const router = useRouter()
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
  const [dryRunComplete, setDryRunComplete] = useState(false)
  const [dryRunResults, setDryRunResults] = useState<DryRunResult[]>([])
  const [showDryRunTable, setShowDryRunTable] = useState(false)
  const [changesCount, setChangesCount] = useState<number | null>(null)
  const [unmatchedFlightsCount, setUnmatchedFlightsCount] = useState<number>(0)
  const [unmatchedDateStart, setUnmatchedDateStart] =
    useState<string>('2026-01-14')
  const [unmatchedDateEnd, setUnmatchedDateEnd] = useState<string>('')
  const [batchEmailLoading, setBatchEmailLoading] = useState(false)
  const [batchEmailResult, setBatchEmailResult] = useState<{
    sent: number
    failed: number
    total: number
  } | null>(null)
  const [dryRunResult, setDryRunResult] = useState<{
    would_send: number
    preview: Array<{ to: string; subject: string }>
  } | null>(null)
  const [matchEmailDateStart, setMatchEmailDateStart] = useState<string>(() => {
    // Default to today's date
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [matchEmailDateEnd, setMatchEmailDateEnd] = useState<string>('')

  // Unmatched emails state
  const [unmatchedEmailLoading, setUnmatchedEmailLoading] = useState(false)
  const [unmatchedEmailDateStart, setUnmatchedEmailDateStart] =
    useState<string>(() => {
      // Default to today's date
      const today = new Date()
      return today.toISOString().split('T')[0]
    })
  const [unmatchedEmailDateEnd, setUnmatchedEmailDateEnd] = useState<string>('')
  const [unmatchedDryRunResult, setUnmatchedDryRunResult] = useState<{
    would_send: number
    preview: Array<{ to: string; subject: string }>
  } | null>(null)
  const [unmatchedEmailResult, setUnmatchedEmailResult] = useState<{
    sent: number
    failed: number
    total: number
  } | null>(null)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true)
        const currentUser = authUser || user

        let adminScope: string | null = null

        // Fetch user's school and admin scope from Users table
        if (currentUser) {
          const { data: userProfile } = await supabase
            .from('Users')
            .select('school, role, admin_scope')
            .eq('user_id', currentUser.id)
            .single()

          if (userProfile?.school) {
            setSchool(userProfile.school)
          }
          adminScope = userProfile?.admin_scope || null
        }

        // Fetch last completed algorithm run (success or failed) from AlgorithmStatus table
        // Only get runs that have finished_at set
        const { data: lastRun, error: lastRunError } = await supabase
          .from('AlgorithmStatus')
          .select('finished_at, status, target, algorithm_name')
          .in('status', ['success', 'failed'])
          .not('finished_at', 'is', null)
          .order('finished_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (lastRunError) {
          // PGRST116 is "no rows returned" which is fine
          // PGRST301 is RLS policy violation
          if (lastRunError.code === 'PGRST116') {
            // No rows found - this is expected if table is empty
            console.log('No algorithm runs found (table may be empty)')
          } else if (
            lastRunError.code === 'PGRST301' ||
            lastRunError.message?.includes('RLS')
          ) {
            // RLS policy violation
            console.error(
              'RLS policy violation when fetching last run. Check RLS policies for AlgorithmStatus table:',
              lastRunError,
            )
          } else {
            console.error('Error fetching last run:', lastRunError)
          }
        }

        // Fetch next scheduled run
        const { data: nextScheduledRun, error: nextRunError } = await supabase
          .from('AlgorithmStatus')
          .select('scheduled_for, target')
          .eq('status', 'scheduled')
          .not('scheduled_for', 'is', null)
          .order('scheduled_for', { ascending: true })
          .limit(1)
          .maybeSingle()

        if (nextRunError) {
          if (nextRunError.code === 'PGRST116') {
            // No rows found - this is expected if table is empty
            console.log('No scheduled runs found (table may be empty)')
          } else if (
            nextRunError.code === 'PGRST301' ||
            nextRunError.message?.includes('RLS')
          ) {
            // RLS policy violation
            console.error(
              'RLS policy violation when fetching scheduled run. Check RLS policies for AlgorithmStatus table:',
              nextRunError,
            )
          } else {
            console.error('Error fetching next scheduled run:', nextRunError)
          }
        }

        if (lastRun?.finished_at) {
          setAlgorithmLastRan(formatDateTime(lastRun.finished_at))
          setLastRunStatus(
            lastRun.status === 'success'
              ? `Completed (${lastRun.target || 'All'})`
              : `Failed (${lastRun.target || 'All'})`,
          )
        } else {
          setAlgorithmLastRan('Never')
          setLastRunStatus('')
        }

        if (nextScheduledRun?.scheduled_for) {
          setNextScheduledRunDate(
            formatDateTime(nextScheduledRun.scheduled_for),
          )
          setNextScheduledRunTarget(nextScheduledRun.target || 'All')
        } else {
          setNextScheduledRunDate('N/A')
          setNextScheduledRunTarget('')
        }

        // Calculate match rate based on last completed algorithm run
        if (lastRun?.finished_at && adminScope) {
          const lastRunDate = new Date(lastRun.finished_at)
          const endDate = new Date(lastRunDate)
          endDate.setDate(endDate.getDate() + 15) // 15 days after algorithm ran

          // Fetch flights for users whose school matches admin scope
          // Only flights on the day or until 15 days after the algorithm was ran
          const { data: flightsData } = await supabase
            .from('Flights')
            .select(
              `
              flight_id,
              user_id,
              date,
              matched,
              Users:Users!Flights_user_id_fkey(school)
            `,
            )
            .gte('date', lastRunDate.toISOString().split('T')[0])
            .lte('date', endDate.toISOString().split('T')[0])

          // Filter flights by admin scope (school)
          const scopedFlights = (flightsData || []).filter(
            (flight: any) => flight.Users?.school === adminScope,
          )

          // Fetch matches for these flights
          const flightIds = scopedFlights.map((f: any) => f.flight_id)
          const { data: matchesData } = await supabase
            .from('Matches')
            .select('ride_id, flight_id, user_id')
            .in('flight_id', flightIds)

          // Count unique users who filled out forms (total riders)
          const uniqueUsers = new Set(scopedFlights.map((f: any) => f.user_id))
          const totalRidersCount = uniqueUsers.size

          // Count unique users who got matched
          const matchedFlightIds = new Set(
            (matchesData || []).map((m: any) => m.flight_id),
          )
          const matchedUsers = new Set(
            scopedFlights
              .filter((f: any) => matchedFlightIds.has(f.flight_id))
              .map((f: any) => f.user_id),
          )
          const matchedRidersCount = matchedUsers.size

          setTotalRiders(totalRidersCount)
          setMatchedRiders(matchedRidersCount)
          const rate =
            totalRidersCount > 0
              ? Math.round((matchedRidersCount / totalRidersCount) * 100)
              : 0
          setMatchRate(rate)
        } else {
          // If no algorithm run or no admin scope, set defaults
          setTotalRiders(0)
          setMatchedRiders(0)
          setMatchRate(0)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [authUser, user, supabase])

  // Fetch unmatched flights count (where matched is NULL)
  useEffect(() => {
    const fetchUnmatchedFlights = async () => {
      try {
        const startDate = unmatchedDateStart || '2026-01-14'
        let query = supabase
          .from('Flights')
          .select('flight_id', { count: 'exact', head: true })
          .is('matched', null)
          .gte('date', startDate)

        if (unmatchedDateEnd) {
          query = query.lte('date', unmatchedDateEnd)
        }

        const { count, error: unmatchedError } = await query

        if (unmatchedError) {
          console.error('Error fetching unmatched flights:', unmatchedError)
        } else {
          setUnmatchedFlightsCount(count || 0)
        }
      } catch (error) {
        console.error('Error fetching unmatched flights:', error)
      }
    }

    fetchUnmatchedFlights()
  }, [supabase, unmatchedDateStart, unmatchedDateEnd])

  const handleRunDryRun = async () => {
    try {
      setLoading(true)
      // Mock dry run - in production, this would call an API endpoint
      // that runs the matching algorithm without committing results

      // Fetch flights with user data for dry run
      const { data: flightsData, error } = await supabase
        .from('Flights')
        .select(
          `
          flight_id,
          date,
          earliest_time,
          latest_time,
          bag_no_personal,
          bag_no,
          bag_no_large,
          airport,
          to_airport,
          Users:Users!Flights_user_id_fkey(firstname, lastname, user_id)
        `,
        )
        .eq('matched', false)
        .limit(50) // Limit for demo

      if (error) throw error

      // Transform to dry run results format
      const results: DryRunResult[] = (flightsData || []).map(
        (flight: any, index) => ({
          ride_id: index + 1,
          name:
            `${flight.Users?.firstname || ''} ${flight.Users?.lastname || ''}`.trim() ||
            'Unknown',
          email: '', // Would need to fetch from auth.users
          date: flight.date || '',
          time_range: `${flight.earliest_time || ''} - ${flight.latest_time || ''}`,
          carry_on_bags: flight.bag_no_personal || 0,
          checked_bags: (flight.bag_no || 0) + (flight.bag_no_large || 0),
          airport: flight.airport || '',
          to_airport: flight.to_airport || false,
        }),
      )

      setDryRunResults(results)
      setDryRunComplete(true)
      setShowDryRunTable(true)
    } catch (error) {
      console.error('Error running dry run:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShowChanges = async () => {
    // Mock - in production, this would compare current state with last run state
    setChangesCount(Math.floor(Math.random() * 20) + 1)
  }

  const handleDryRunBatchEmails = async () => {
    try {
      setBatchEmailLoading(true)
      setDryRunResult(null)
      setBatchEmailResult(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration')
      }

      const body: any = { dry_run: true }

      // Add date range if provided
      if (matchEmailDateStart) {
        body.date_start = matchEmailDateStart
      }
      if (matchEmailDateEnd) {
        body.date_end = matchEmailDateEnd
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-all-match-emails-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        const wouldSend = result.would_send ?? 0
        const preview = result.preview || []

        setDryRunResult({
          would_send: wouldSend,
          preview: preview,
        })

        if (wouldSend === 0) {
          alert(
            `📋 Dry Run Results:\n\nNo emails to send.\n\nAll verified matches have already been sent, or there are no verified matches that need emails.`,
          )
        } else {
          const previewText =
            preview.length > 0
              ? preview.map((p: any) => `- ${p.to}: ${p.subject}`).join('\n')
              : 'No preview available'
          alert(
            `📋 Dry Run Results:\n\nWould send: ${wouldSend} emails\n\nPreview (first ${Math.min(3, preview.length)}):\n${previewText}`,
          )
        }
      } else {
        throw new Error(result.message || 'Dry run failed')
      }
    } catch (error) {
      console.error('Error in dry run:', error)
      alert(
        `❌ Error in dry run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setBatchEmailLoading(false)
    }
  }

  const handleSendBatchEmails = async () => {
    const dateRangeMsg =
      matchEmailDateStart && matchEmailDateEnd
        ? ` between ${matchEmailDateStart} and ${matchEmailDateEnd}`
        : matchEmailDateStart
          ? ` from ${matchEmailDateStart} onwards`
          : ''

    if (
      !confirm(
        `Send emails to all verified matches that haven't been emailed yet${dateRangeMsg}? This will send all pending match emails at once using batch API.`,
      )
    ) {
      return
    }

    try {
      setBatchEmailLoading(true)
      setBatchEmailResult(null)
      setDryRunResult(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration')
      }

      const body: any = {}

      // Add date range if provided
      if (matchEmailDateStart) {
        body.date_start = matchEmailDateStart
      }
      if (matchEmailDateEnd) {
        body.date_end = matchEmailDateEnd
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-all-match-emails-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        const sent = result.sent ?? 0
        const failed = result.failed ?? 0
        const total = result.total ?? 0

        setBatchEmailResult({
          sent: sent,
          failed: failed,
          total: total,
        })

        if (total === 0) {
          alert(
            `✅ Batch email sending complete!\n\nNo emails to send.\n\nAll verified matches have already been sent, or there are no verified matches that need emails.`,
          )
        } else {
          alert(
            `✅ Batch email sending complete!\n\nSent: ${sent}\nFailed: ${failed}\nTotal: ${total}`,
          )
        }
      } else {
        throw new Error(result.message || 'Batch email sending failed')
      }
    } catch (error) {
      console.error('Error sending batch emails:', error)
      alert(
        `❌ Error sending batch emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setBatchEmailLoading(false)
    }
  }

  const handleDryRunUnmatchedEmails = async () => {
    try {
      setUnmatchedEmailLoading(true)
      setUnmatchedDryRunResult(null)
      setUnmatchedEmailResult(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration')
      }

      if (!unmatchedEmailDateStart || !unmatchedEmailDateEnd) {
        alert(
          '⚠️ Please select both start and end dates for the unmatched email range.',
        )
        return
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-unmatched-emails-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date_start: unmatchedEmailDateStart,
            date_end: unmatchedEmailDateEnd,
            dry_run: true,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        const wouldSend = result.would_send ?? 0
        const preview = result.preview || []

        setUnmatchedDryRunResult({
          would_send: wouldSend,
          preview: preview,
        })

        if (wouldSend === 0) {
          alert(
            `📋 Dry Run Results (Unmatched Emails):\n\nNo unmatched flights found in date range ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}.`,
          )
        } else {
          const previewText =
            preview.length > 0
              ? preview.map((p: any) => `- ${p.to}: ${p.subject}`).join('\n')
              : 'No preview available'
          alert(
            `📋 Dry Run Results (Unmatched Emails):\n\nWould send: ${wouldSend} emails\nDate range: ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}\n\nPreview (first ${Math.min(3, preview.length)}):\n${previewText}`,
          )
        }
      } else {
        throw new Error(result.message || 'Dry run failed')
      }
    } catch (error) {
      console.error('Error in unmatched emails dry run:', error)
      alert(
        `❌ Error in dry run: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setUnmatchedEmailLoading(false)
    }
  }

  const handleSendUnmatchedEmails = async () => {
    if (!unmatchedEmailDateStart || !unmatchedEmailDateEnd) {
      alert(
        '⚠️ Please select both start and end dates for the unmatched email range.',
      )
      return
    }

    if (
      !confirm(
        `Send emails to all unmatched riders between ${unmatchedEmailDateStart} and ${unmatchedEmailDateEnd}? This will notify them that no match was found.`,
      )
    ) {
      return
    }

    try {
      setUnmatchedEmailLoading(true)
      setUnmatchedEmailResult(null)
      setUnmatchedDryRunResult(null)

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase configuration')
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-unmatched-emails-batch`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${supabaseAnonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            date_start: unmatchedEmailDateStart,
            date_end: unmatchedEmailDateEnd,
            dry_run: false,
          }),
        },
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        const sent = result.sent ?? 0
        const failed = result.failed ?? 0
        const total = result.total ?? 0

        setUnmatchedEmailResult({
          sent: sent,
          failed: failed,
          total: total,
        })

        if (total === 0) {
          alert(
            `✅ Unmatched email sending complete!\n\nNo unmatched flights found in date range ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}.`,
          )
        } else {
          alert(
            `✅ Unmatched email sending complete!\n\nSent: ${sent}\nFailed: ${failed}\nTotal: ${total}\nDate range: ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}`,
          )
        }
      } else {
        throw new Error(result.message || 'Unmatched email sending failed')
      }
    } catch (error) {
      console.error('Error sending unmatched emails:', error)
      alert(
        `❌ Error sending unmatched emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    } finally {
      setUnmatchedEmailLoading(false)
    }
  }

  const handleViewGroups = () => {
    router.push('/admin/groups')
  }

  if (loading && !dryRunResults.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading dashboard...</div>
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

        {/* Action Buttons - Centered Row */}
        <div className="mb-8 flex flex-wrap justify-center gap-4">
          <button
            onClick={handleRunDryRun}
            disabled={true}
            className="cursor-not-allowed rounded-lg border-2 border-gray-300 bg-gray-100 px-6 py-3 font-medium text-gray-500 opacity-50 transition-all"
          >
            Run Dry Run
          </button>

          <button
            onClick={handleShowChanges}
            disabled={true}
            className="flex cursor-not-allowed items-center gap-2 rounded-lg border-2 border-gray-300 bg-gray-100 px-6 py-3 font-medium text-gray-500 opacity-50 transition-all"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Show Changed Since Last Run
            {changesCount !== null && (
              <span className="ml-2 rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-500">
                {changesCount}
              </span>
            )}
          </button>

          <button
            onClick={handleViewGroups}
            className="rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-3 font-medium text-white transition-all hover:from-teal-600 hover:to-cyan-600"
          >
            View & Manage Groups
          </button>
        </div>

        {/* Match Emails Section */}
        <div className="pointer-events-none mb-8 rounded-lg bg-white opacity-50 shadow-md">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-400 to-gray-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">Send Match Emails</h2>
            <p className="mt-1 text-sm text-white/90">Temporarily disabled</p>
          </div>

          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={matchEmailDateStart}
                  onChange={(e) => setMatchEmailDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="min-w-[200px] flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={matchEmailDateEnd}
                  onChange={(e) => setMatchEmailDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDryRunBatchEmails}
                disabled={batchEmailLoading}
                className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-all ${
                  batchEmailLoading
                    ? 'cursor-not-allowed bg-gray-400 opacity-50'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                }`}
                title="Preview what emails would be sent without actually sending them"
              >
                {batchEmailLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Preview Match Emails (Dry Run)
                  </>
                )}
                {dryRunResult && dryRunResult.would_send !== undefined && (
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold">
                    {dryRunResult.would_send}
                  </span>
                )}
              </button>

              <button
                onClick={handleSendBatchEmails}
                disabled={batchEmailLoading}
                className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-all ${
                  batchEmailLoading
                    ? 'cursor-not-allowed bg-gray-400 opacity-50'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
                title="Send all pending match emails at once using Resend Batch API (avoids rate limits)"
              >
                {batchEmailLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Send All Match Emails
                  </>
                )}
                {batchEmailResult && batchEmailResult.total !== undefined && (
                  <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold">
                    {batchEmailResult.sent}/{batchEmailResult.total}
                  </span>
                )}
              </button>
            </div>

            {dryRunResult && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-900">
                  📋 Preview: Would send {dryRunResult.would_send} email
                  {dryRunResult.would_send !== 1 ? 's' : ''}
                </p>
                {dryRunResult.preview && dryRunResult.preview.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs text-purple-800">
                    {dryRunResult.preview.map((p, idx) => (
                      <li key={idx}>• {p.to}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {batchEmailResult && (
              <div
                className={`mt-4 rounded-lg border p-4 ${
                  batchEmailResult.failed > 0
                    ? 'border-red-200 bg-red-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    batchEmailResult.failed > 0
                      ? 'text-red-900'
                      : 'text-green-900'
                  }`}
                >
                  {batchEmailResult.failed > 0 ? '❌' : '✅'} Sent{' '}
                  {batchEmailResult.sent} email
                  {batchEmailResult.sent !== 1 ? 's' : ''}
                  {batchEmailResult.failed > 0 &&
                    ` (${batchEmailResult.failed} failed)`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Unmatched Emails Section */}
        <div className="pointer-events-none mb-8 rounded-lg bg-white opacity-50 shadow-md">
          <div className="border-b border-gray-200 bg-gradient-to-r from-gray-400 to-gray-500 px-6 py-4">
            <h2 className="text-xl font-bold text-white">
              Send Unmatched Rider Emails
            </h2>
            <p className="mt-1 text-sm text-white/90">Temporarily disabled</p>
          </div>

          <div className="p-6">
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="min-w-[200px] flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  type="date"
                  value={unmatchedEmailDateStart}
                  onChange={(e) => setUnmatchedEmailDateStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="min-w-[200px] flex-1">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  type="date"
                  value={unmatchedEmailDateEnd}
                  onChange={(e) => setUnmatchedEmailDateEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleDryRunUnmatchedEmails}
                disabled={unmatchedEmailLoading}
                className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-all ${
                  unmatchedEmailLoading
                    ? 'cursor-not-allowed bg-gray-400 opacity-50'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                }`}
                title="Preview what unmatched emails would be sent"
              >
                {unmatchedEmailLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Checking...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    Preview Unmatched (Dry Run)
                  </>
                )}
                {unmatchedDryRunResult &&
                  unmatchedDryRunResult.would_send !== undefined && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold">
                      {unmatchedDryRunResult.would_send}
                    </span>
                  )}
              </button>

              <button
                onClick={handleSendUnmatchedEmails}
                disabled={unmatchedEmailLoading}
                className={`flex items-center gap-2 rounded-lg px-6 py-3 font-medium text-white transition-all ${
                  unmatchedEmailLoading
                    ? 'cursor-not-allowed bg-gray-400 opacity-50'
                    : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
                }`}
                title="Send emails to all unmatched riders in the date range"
              >
                {unmatchedEmailLoading ? (
                  <>
                    <svg
                      className="h-5 w-5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Sending...
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    Send Unmatched Emails
                  </>
                )}
                {unmatchedEmailResult &&
                  unmatchedEmailResult.total !== undefined && (
                    <span className="ml-2 rounded-full bg-white/20 px-2 py-1 text-xs font-semibold">
                      {unmatchedEmailResult.sent}/{unmatchedEmailResult.total}
                    </span>
                  )}
              </button>
            </div>

            {unmatchedDryRunResult && (
              <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 p-4">
                <p className="text-sm font-medium text-purple-900">
                  📋 Preview: Would send {unmatchedDryRunResult.would_send}{' '}
                  email{unmatchedDryRunResult.would_send !== 1 ? 's' : ''}
                </p>
                {unmatchedDryRunResult.preview &&
                  unmatchedDryRunResult.preview.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-purple-800">
                      {unmatchedDryRunResult.preview.map((p, idx) => (
                        <li key={idx}>• {p.to}</li>
                      ))}
                    </ul>
                  )}
              </div>
            )}

            {unmatchedEmailResult && (
              <div
                className={`mt-4 rounded-lg border p-4 ${
                  unmatchedEmailResult.failed > 0
                    ? 'border-red-200 bg-red-50'
                    : 'border-green-200 bg-green-50'
                }`}
              >
                <p
                  className={`text-sm font-medium ${
                    unmatchedEmailResult.failed > 0
                      ? 'text-red-900'
                      : 'text-green-900'
                  }`}
                >
                  {unmatchedEmailResult.failed > 0 ? '❌' : '✅'} Sent{' '}
                  {unmatchedEmailResult.sent} email
                  {unmatchedEmailResult.sent !== 1 ? 's' : ''}
                  {unmatchedEmailResult.failed > 0 &&
                    ` (${unmatchedEmailResult.failed} failed)`}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dry Run Results Table */}
        {showDryRunTable && (
          <div className="rounded-lg bg-white shadow-md">
            <div className="flex items-center justify-between border-b border-gray-200 bg-gradient-to-r from-teal-500 to-cyan-500 px-6 py-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-bold text-white">
                  Dry Run Results
                </h2>
                <button
                  onClick={() => setShowDryRunTable(false)}
                  className="rounded bg-white/20 px-3 py-1 text-sm font-medium text-white transition-all hover:bg-white/30"
                  title="Collapse table"
                >
                  Collapse
                </button>
              </div>
              <button
                onClick={() => {
                  // CSV download functionality
                  const csv = [
                    [
                      'RIDE_ID',
                      'NAME',
                      'EMAIL',
                      'DATE',
                      'TIME_RANGE',
                      'CARRY_ON_BAGS',
                      'CHECKED_BAGS',
                      'AIRPORT',
                      'TO_AIRPORT',
                    ],
                    ...dryRunResults.map((r) => [
                      r.ride_id,
                      r.name,
                      r.email,
                      r.date,
                      r.time_range,
                      r.carry_on_bags,
                      r.checked_bags,
                      r.airport,
                      r.to_airport ? 'true' : 'false',
                    ]),
                  ]
                    .map((row) => row.join(','))
                    .join('\n')

                  const blob = new Blob([csv], { type: 'text/csv' })
                  const url = window.URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'dry-run-results.csv'
                  a.click()
                }}
                className="flex items-center gap-2 rounded bg-white/20 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/30"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      RIDE_ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      NAME
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      EMAIL
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      DATE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      TIME_RANGE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      CARRY_ON
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      CHECKED
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      AIRPORT
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      TO_AIRPORT
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {dryRunResults.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No results available
                      </td>
                    </tr>
                  ) : (
                    dryRunResults.map((result, index) => (
                      <tr
                        key={result.ride_id}
                        className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.ride_id}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.name}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.email || 'N/A'}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.date}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.time_range}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.carry_on_bags}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.checked_bags}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.airport}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                          {result.to_airport ? 'Yes' : 'No'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-gray-200 bg-gray-50 px-6 py-4">
              <p className="text-sm text-gray-600">
                Total riders: {dryRunResults.length} | Total rides:{' '}
                {new Set(dryRunResults.map((r) => r.ride_id)).size}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
