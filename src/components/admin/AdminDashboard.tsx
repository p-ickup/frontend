'use client'

import type { AdminSummaryDto } from '@/contracts/readModels'
import type { NoShowRiderInfo } from '@/utils/adminMatchNoShows'
import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'
import { postJson, requestJson } from '@/utils/api'
import {
  estimateCancellationFee,
  formatCancellationFee,
} from '@/utils/cancellationFees'
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

  const [rideDateStart, setRideDateStart] = useState<string>(() => {
    // Default to today's date
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [rideDateEnd, setRideDateEnd] = useState<string>('')
  const [coveredAirport, setCoveredAirport] = useState<string>('LAX')
  const [coveredDirections, setCoveredDirections] = useState<string>('TO')
  //show email editor
  const [showEditor, setShowEditor] = useState(false)
  //show unmatched email editor
  const [showUnmatchedEditor, setShowUnmatchedEditor] = useState(false)

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

  const handleDryRunBatchEmails = async () => {
    try {
      setBatchEmailLoading(true)
      setDryRunResult(null)
      setBatchEmailResult(null)

      const body: any = { dry_run: true }

      // Add date range if provided
      if (matchEmailDateStart) {
        body.date_start = matchEmailDateStart
      }
      if (matchEmailDateEnd) {
        body.date_end = matchEmailDateEnd
      }

      const result = await postJson<any>('/api/admin/send-match-emails', body)

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

      const body: any = {}

      // Add date range if provided
      if (matchEmailDateStart) {
        body.date_start = matchEmailDateStart
      }
      if (matchEmailDateEnd) {
        body.date_end = matchEmailDateEnd
      }

      const result = await postJson<any>('/api/admin/send-match-emails', body)

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

      if (!unmatchedEmailDateStart || !unmatchedEmailDateEnd) {
        alert(
          '⚠️ Please select both start and end dates for the unmatched email range.',
        )
        return
      }

      const result = await postJson<any>('/api/admin/send-unmatched-emails', {
        date_start: unmatchedEmailDateStart,
        date_end: unmatchedEmailDateEnd,
        dry_run: true,
      })

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

  function Spinner() {
    return (
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
    )
  }

  type EmailEditorModalProps = {
    onClose: () => void
  }

  function EmailEditorModal({ onClose }: EmailEditorModalProps) {
    const [subject, setSubject] = useState('')
    const [email_body, setBody] = useState('')

    const handleDryRunBatchCustomEmails = async () => {
      try {
        setBatchEmailLoading(true)
        setDryRunResult(null)
        setBatchEmailResult(null)

        const body: any = {
          dry_run: true,
          custom_subject: subject,
          custom_body: email_body,
          ride_date_start: rideDateStart,
          ride_date_end: rideDateEnd,
          airport: coveredAirport,
          direction: coveredDirections,
        }

        // Add date range if provided
        if (matchEmailDateStart) {
          body.date_start = matchEmailDateStart
        }
        if (matchEmailDateEnd) {
          body.date_end = matchEmailDateEnd
        }

        const result = await postJson<any>('/api/admin/send-match-emails', body)

        if (result.success) {
          const wouldSend = result.would_send ?? 0
          const preview = result.preview || []

          setDryRunResult({
            would_send: wouldSend,
            preview: preview,
          })

          if (wouldSend === 0) {
            alert(
              `📋 Dry Run Results:\n\nNo customized emails to send.\n\nAll verified matches have already been sent, or there are no verified matches that need emails.`,
            )
          } else {
            const previewText =
              preview.length > 0
                ? preview.map((p: any) => `- ${p.to}: ${p.subject}`).join('\n')
                : 'No preview available'
            alert(
              `📋 Dry Run Results:\n\nWould send: ${wouldSend} customized emails\n\nPreview (first ${Math.min(3, preview.length)}):\n${previewText}`,
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

    const handleSendBatchCustomEmails = async () => {
      const dateRangeMsg =
        matchEmailDateStart && matchEmailDateEnd
          ? ` between ${matchEmailDateStart} and ${matchEmailDateEnd}`
          : matchEmailDateStart
            ? ` from ${matchEmailDateStart} onwards`
            : ''

      if (
        !confirm(
          `Send customized emails to all verified matches that haven't been emailed yet${dateRangeMsg}? This will send all pending match emails at once using batch API.`,
        )
      ) {
        return
      }

      try {
        setBatchEmailLoading(true)
        setBatchEmailResult(null)
        setDryRunResult(null)

        const body: any = {
          dry_run: true,
          custom_subject: subject,
          custom_body: email_body,
          ride_date_start: rideDateStart,
          ride_date_end: rideDateEnd,
          airport: coveredAirport,
          direction: coveredDirections,
        }

        // Add date range if provided
        if (matchEmailDateStart) {
          body.date_start = matchEmailDateStart
        }
        if (matchEmailDateEnd) {
          body.date_end = matchEmailDateEnd
        }

        const result = await postJson<any>('/api/admin/send-match-emails', body)

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
              `✅ Batch Custom email sending complete!\n\nNo emails to send.\n\nAll verified matches have already been sent, or there are no verified matches that need emails.`,
            )
          } else {
            alert(
              `✅ Batch Custom email sending complete!\n\nSent: ${sent}\nFailed: ${failed}\nTotal: ${total}`,
            )
          }
        } else {
          throw new Error(result.message || 'Batch Custom email sending failed')
        }
      } catch (error) {
        console.error('Error sending batch custom emails:', error)
        alert(
          `❌ Error sending batch custom emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } finally {
        setBatchEmailLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className="
          relative w-full max-w-3xl scale-100 transform animate-[fadeIn_0.15s_ease-out] rounded-xl
          border border-gray-200
          bg-white
          p-6 opacity-100 shadow-2xl
          transition-all duration-200
        "
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b pb-2">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-800">
              Custom Email
            </h2>

            <button
              onClick={onClose}
              className="
              rounded-full p-2
              text-gray-500 transition-colors
              duration-150 hover:bg-gray-100 hover:text-gray-700
            "
            >
              ✕
            </button>
          </div>

          {/* Subject */}
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="
            mb-5 w-full rounded-md border border-gray-300 p-2
            transition-all duration-150 hover:border-gray-400
            focus:outline-none focus:ring-2
            focus:ring-blue-400
          "
            placeholder="Email subject..."
          />

          {/* Body */}
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Body
          </label>
          <textarea
            value={email_body}
            onChange={(e) => setBody(e.target.value)}
            className="
            h-40 w-full rounded-md border border-gray-300 p-3
            transition-all duration-150 hover:border-gray-400
            focus:outline-none focus:ring-2
            focus:ring-blue-400
          "
            placeholder="Write your email here..."
          />

          {/* Preview Panel */}
          <div className="mt-8 border-t pt-5">
            <h3 className="mb-3 text-lg font-semibold text-gray-800">
              Preview
            </h3>

            <div
              className="
              whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50
              p-4 shadow-sm
              transition-all duration-150
            "
            >
              <div className="mb-2 font-medium text-gray-900">
                {subject || '(No subject)'}
              </div>

              <div className="leading-relaxed text-gray-700">
                {email_body || '(No body content)'}
              </div>
            </div>
          </div>

          {batchEmailLoading && (
            <div className="mt-6 flex animate-pulse items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-700">
              <Spinner />
              <span>Processing your request…</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            {/* Preview Button */}
            <button
              onClick={handleDryRunBatchCustomEmails}
              disabled={batchEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              batchEmailLoading
                ? 'cursor-not-allowed bg-green-400 opacity-70'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            }
          `}
            >
              {batchEmailLoading ? <Spinner /> : '🔍 Preview Email'}
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendBatchCustomEmails}
              disabled={batchEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              batchEmailLoading
                ? 'cursor-not-allowed bg-blue-400 opacity-70'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
            >
              {batchEmailLoading ? <Spinner /> : '✉️ Send Email'}
            </button>

            {/* Cancel Button */}
            <button
              onClick={onClose}
              disabled={batchEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              batchEmailLoading
                ? 'cursor-not-allowed bg-gray-300 opacity-70'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }
          `}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  function UnmatchedEmailEditorModal({ onClose }: EmailEditorModalProps) {
    const [subject, setSubject] = useState('')
    const [email_body, setBody] = useState('')

    const handleDryRunUnmatchedCustomEmails = async () => {
      try {
        setUnmatchedEmailLoading(true)
        setUnmatchedDryRunResult(null)
        setUnmatchedEmailResult(null)

        if (!unmatchedEmailDateStart || !unmatchedEmailDateEnd) {
          alert(
            '⚠️ Please select both start and end dates for the unmatched email range.',
          )
          return
        }

        const result = await postJson<any>('/api/admin/send-unmatched-emails', {
          date_start: unmatchedEmailDateStart,
          date_end: unmatchedEmailDateEnd,
          dry_run: true,
          custom_subject: subject,
          custom_body: email_body,
        })

        if (result.success) {
          const wouldSend = result.would_send ?? 0
          const preview = result.preview || []

          setUnmatchedDryRunResult({
            would_send: wouldSend,
            preview: preview,
          })

          if (wouldSend === 0) {
            alert(
              `📋 Dry Run Results (Unmatched Custom Emails):\n\nNo unmatched flights found in date range ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}.`,
            )
          } else {
            const previewText =
              preview.length > 0
                ? preview.map((p: any) => `- ${p.to}: ${p.subject}`).join('\n')
                : 'No preview available'
            alert(
              `📋 Dry Run Results (Unmatched Custom Emails):\n\nWould send: ${wouldSend} emails\nDate range: ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}\n\nPreview (first ${Math.min(3, preview.length)}):\n${previewText}`,
            )
          }
        } else {
          throw new Error(result.message || 'Dry run failed')
        }
      } catch (error) {
        console.error('Error in unmatched custom emails dry run:', error)
        alert(
          `❌ Error in dry run: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } finally {
        setUnmatchedEmailLoading(false)
      }
    }

    const handleSendUnmatchedCustomEmails = async () => {
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

        const result = await postJson<any>('/api/admin/send-unmatched-emails', {
          date_start: unmatchedEmailDateStart,
          date_end: unmatchedEmailDateEnd,
          dry_run: false,
          custom_subject: subject,
          custom_body: email_body,
        })

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
              `✅ Unmatched Custom email sending complete!\n\nNo unmatched flights found in date range ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}.`,
            )
          } else {
            alert(
              `✅ Unmatched Custom email sending complete!\n\nSent: ${sent}\nFailed: ${failed}\nTotal: ${total}\nDate range: ${unmatchedEmailDateStart} to ${unmatchedEmailDateEnd}`,
            )
          }
        } else {
          throw new Error(
            result.message || 'Unmatched Custom email sending failed',
          )
        }
      } catch (error) {
        console.error('Error sending unmatched custom emails:', error)
        alert(
          `❌ Error sending unmatched custom emails: ${error instanceof Error ? error.message : 'Unknown error'}`,
        )
      } finally {
        setUnmatchedEmailLoading(false)
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div
          className="
          relative w-full max-w-3xl scale-100 transform animate-[fadeIn_0.15s_ease-out] rounded-xl
          border border-gray-200
          bg-white
          p-6 opacity-100 shadow-2xl
          transition-all duration-200
        "
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b pb-2">
            <h2 className="text-2xl font-semibold tracking-tight text-gray-800">
              Custom Email
            </h2>

            <button
              onClick={onClose}
              className="
              rounded-full p-2
              text-gray-500 transition-colors
              duration-150 hover:bg-gray-100 hover:text-gray-700
            "
            >
              ✕
            </button>
          </div>

          {/* Subject */}
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Subject
          </label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="
            mb-5 w-full rounded-md border border-gray-300 p-2
            transition-all duration-150 hover:border-gray-400
            focus:outline-none focus:ring-2
            focus:ring-blue-400
          "
            placeholder="Email subject..."
          />

          {/* Body */}
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Body
          </label>
          <textarea
            value={email_body}
            onChange={(e) => setBody(e.target.value)}
            className="
            h-40 w-full rounded-md border border-gray-300 p-3
            transition-all duration-150 hover:border-gray-400
            focus:outline-none focus:ring-2
            focus:ring-blue-400
          "
            placeholder="Write your email here..."
          />

          {/* Preview Panel */}
          <div className="mt-8 border-t pt-5">
            <h3 className="mb-3 text-lg font-semibold text-gray-800">
              Preview
            </h3>

            <div
              className="
              whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50
              p-4 shadow-sm
              transition-all duration-150
            "
            >
              <div className="mb-2 font-medium text-gray-900">
                {subject || '(No subject)'}
              </div>

              <div className="leading-relaxed text-gray-700">
                {email_body || '(No body content)'}
              </div>
            </div>
          </div>

          {unmatchedEmailLoading && (
            <div className="mt-6 flex animate-pulse items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-blue-700">
              <Spinner />
              <span>Processing your request…</span>
            </div>
          )}

          {/* Footer */}
          <div className="mt-8 flex justify-end gap-3 border-t pt-4">
            {/* Preview Button */}
            <button
              onClick={handleDryRunUnmatchedCustomEmails}
              disabled={unmatchedEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              unmatchedEmailLoading
                ? 'cursor-not-allowed bg-green-400 opacity-70'
                : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
            }
          `}
            >
              {unmatchedEmailLoading ? <Spinner /> : '🔍 Preview Email'}
            </button>

            {/* Send Button */}
            <button
              onClick={handleSendUnmatchedCustomEmails}
              disabled={unmatchedEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              unmatchedEmailLoading
                ? 'cursor-not-allowed bg-blue-400 opacity-70'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
            >
              {unmatchedEmailLoading ? <Spinner /> : '✉️ Send Email'}
            </button>

            {/* Cancel Button */}
            <button
              onClick={onClose}
              disabled={unmatchedEmailLoading}
              className={`
            flex items-center gap-2 rounded-md px-4 py-2 font-medium
            shadow-sm transition-all duration-150 hover:shadow-md
            ${
              unmatchedEmailLoading
                ? 'cursor-not-allowed bg-gray-300 opacity-70'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }
          `}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
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

      const result = await postJson<any>('/api/admin/send-unmatched-emails', {
        date_start: unmatchedEmailDateStart,
        date_end: unmatchedEmailDateEnd,
        dry_run: false,
      })

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

            <div className="grid grid-cols-2 grid-rows-2 gap-4">
              {/* Date Field- start coverage for rides */}
              <div className="flex-1">
                <label
                  htmlFor="arrival_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Ride Date: Start of Coverage
                </label>
                <input
                  type="date"
                  id="ride_date_start"
                  name="ride_date_start"
                  value={rideDateStart}
                  onChange={(e) => setRideDateStart(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm
                     focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Date Field-end coverage for rides*/}
              <div className="flex-1">
                <label
                  htmlFor="arrival_date"
                  className="block text-sm font-medium text-gray-700"
                >
                  Ride Date: End of Coverage
                </label>
                <input
                  type="date"
                  id="ride_date_end"
                  name="ride_date_end"
                  value={rideDateEnd}
                  onChange={(e) => setRideDateEnd(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm
                     focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              {/* Airport Selection */}
              <div className="flex-1">
                <label
                  htmlFor="airport"
                  className="block text-sm font-medium text-gray-700"
                >
                  Airport
                </label>
                <select
                  id="airport"
                  name="airport"
                  value={coveredAirport}
                  onChange={(e) => setCoveredAirport(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm
                     focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="LAX">LAX</option>
                  <option value="ONT">ONT</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>

              {/* Direction Selection */}
              <div className="flex-1">
                <label
                  htmlFor="direction"
                  className="block text-sm font-medium text-gray-700"
                >
                  Direction
                </label>
                <select
                  id="direction"
                  name="direction"
                  value={coveredDirections}
                  onChange={(e) => setCoveredDirections(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm
                     focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="TO">TO</option>
                  <option value="FROM">FROM</option>
                  <option value="BOTH">BOTH</option>
                </select>
              </div>
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

            <div className="flex justify-end">
              <button
                onClick={() => setShowEditor(true)}
                className="
                mt-6
                rounded-md bg-blue-600 px-4 py-2 font-medium text-white
                hover:bg-blue-700 focus:outline-none
                focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 active:bg-blue-800
              "
              >
                Send Custom Email
              </button>
              {showEditor && (
                <EmailEditorModal onClose={() => setShowEditor(false)} />
              )}
            </div>
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

            <div className="flex justify-end">
              <button
                onClick={() => setShowUnmatchedEditor(true)}
                className="
                mt-6
                rounded-md bg-blue-600 px-4 py-2 font-medium text-white
                hover:bg-blue-700 focus:outline-none
                focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 active:bg-blue-800
              "
              >
                Send Custom Email
              </button>
              {showUnmatchedEditor && (
                <UnmatchedEmailEditorModal
                  onClose={() => setShowUnmatchedEditor(false)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
