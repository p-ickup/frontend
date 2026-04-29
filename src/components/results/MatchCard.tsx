'use client'

import Image from 'next/image'
import Link from 'next/link'
import { MatchWithDetails } from '@/app/results/page'
import { useAuth } from '@/hooks/useAuth'
import { useState } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { formatTime12Hour } from '@/utils/formatTime'
import ConfirmCancelMatch from './ConfirmCancelMatch'

interface MatchCardProps {
  matches: MatchWithDetails[]
  upcoming: boolean
  onDelete?: (rideId: number) => Promise<void>
  rideId?: number
  isGroupReady?: boolean
}

const getAirportAddress = (airport: string | null): string => {
  if (!airport) return ''
  const airports: Record<string, string> = {
    LAX: 'World Way, Los Angeles, CA 90045',
    SNA: '18601 Airport Way, Santa Ana, CA 92707',
  }
  return airports[airport] || ''
}

// Helper function to generate an ICS file for match date/time
const createICSFile = (
  eventTitle: string,
  description: string,
  startDate: Date,
  startTime: string,
) => {
  const pad = (num: number) => String(num).padStart(2, '0')

  const formatDateTime = (date: Date) => {
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate()) +
      'T' +
      pad(date.getUTCHours()) +
      pad(date.getUTCMinutes()) +
      pad(date.getUTCSeconds()) +
      'Z'
    )
  }

  // Create start date/time
  const [hours, minutes] = startTime.split(':').map(Number)
  const startDateTime = new Date(startDate)
  startDateTime.setHours(hours, minutes, 0, 0)
  const start = formatDateTime(startDateTime)

  // Create end date/time (1 hour later)
  const endDateTime = new Date(startDateTime)
  endDateTime.setHours(hours + 1, minutes, 0, 0)
  const end = formatDateTime(endDateTime)

  const content = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${eventTitle}
DESCRIPTION:${description}
URL:https://p-ickup.com/results
DTSTART:${start}
DTEND:${end}
BEGIN:VALARM
TRIGGER:-P1D
ACTION:DISPLAY
DESCRIPTION:Reminder: Your PICKUP Match is tomorrow!
END:VALARM
END:VEVENT
END:VCALENDAR`

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${eventTitle.replace(/\s+/g, '_')}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

const MatchCard = ({
  matches,
  upcoming,
  onDelete,
  rideId,
  isGroupReady,
}: MatchCardProps) => {
  const { user } = useAuth()
  /** Prefer the logged-in user's row for date/voucher; fallback for edge cases */
  const primaryMatch = matches.find((m) => m.user_id === user?.id) ?? matches[0]
  /** Alias for fields shared with merged main-branch UI (Connect / voucher checks) */
  const firstMatch = primaryMatch
  const otherRiders = user ? matches.filter((m) => m.user_id !== user.id) : []
  const isSolo = otherRiders.length === 0
  const voucherStr = (primaryMatch.voucher ?? '').trim()
  const contingencyStr = (primaryMatch.contingency_voucher ?? '').trim()
  const hasUberVoucher = voucherStr.length > 0
  const hasContingencyVoucher = contingencyStr.length > 0
  /**
   * Contingency is meant for post-delay solo rides (your own group). Do not show
   * or require pickup for it while other riders are on the same ride.
   */
  const contingencyAppliesHere = isSolo && hasContingencyVoucher
  /** Reveal contingency URL on Results only after ASPC “confirm ready” (group ready). */
  const showContingencyBlock =
    contingencyAppliesHere && contingencyStr !== voucherStr && isGroupReady
  const hasAnyVoucher = hasUberVoucher || contingencyAppliesHere
  /** Uber always; contingency only when solo */
  const needsPickupConfirmation =
    hasAnyVoucher && rideId && upcoming && !isGroupReady
  const supabase = createBrowserClient()
  const [isDeleting, setIsDeleting] = useState(false)
  const [urlCache, setUrlCache] = useState<Record<string, string>>({})

  const getProfileUrl = (photoPath: string | null) => {
    if (!photoPath) return '/images/profileIcon.webp'
    if (photoPath.startsWith('/images')) return photoPath
    if (photoPath.includes('supabase.co')) return photoPath

    // Check cache first
    if (urlCache[photoPath]) {
      return urlCache[photoPath]
    }

    // Generate URL and cache it
    const { data } = supabase.storage
      .from('profile_picture')
      .getPublicUrl(photoPath)

    const publicUrl = data?.publicUrl || '/images/profileIcon.webp'
    setUrlCache((prev: Record<string, string>) => ({
      ...prev,
      [photoPath]: publicUrl,
    }))
    return publicUrl
  }

  const [showCancelModal, setShowCancelModal] = useState(false)

  const handleCancelClick = () => {
    setShowCancelModal(true)
  }

  const handleConfirmCancel = async () => {
    if (!onDelete || isDeleting) return
    try {
      setIsDeleting(true)
      await onDelete(primaryMatch.ride_id)
      setShowCancelModal(false)
    } catch (error) {
      console.error('Error deleting match:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  // Use voucher existence (not is_subsidized). Connect rides never have vouchers, so exclude them.
  const hasVoucher =
    Boolean(firstMatch.voucher?.trim()) &&
    firstMatch.uber_type?.toLowerCase() !== 'connect'

  const isConnect = firstMatch.uber_type?.toLowerCase() === 'connect'

  const handleReminderClick = () => {
    if (!primaryMatch.date || !primaryMatch.time) return

    // Parse date manually to avoid timezone issues
    const [year, month, day] = primaryMatch.date.split('-').map(Number)
    const matchDate = new Date(year, month - 1, day)
    const matchTime = primaryMatch.time
    const flightData = primaryMatch.Flights

    const title = `PICKUP Group: ${flightData?.to_airport ? 'School → ' + flightData.airport : flightData.airport + ' → School'}`

    createICSFile(title, 'Your PICKUP ride share match!', matchDate, matchTime)
  }

  return (
    <div className="mb-6 w-full rounded-xl border border-gray-100 bg-white p-4 shadow-md transition-all hover:shadow-lg sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:gap-6">
        <div className="flex flex-col gap-3">
          <div>
            <p className="flex items-center gap-1 font-medium text-indigo-600">
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {primaryMatch.date
                ? (() => {
                    const [year, month, day] = primaryMatch.date
                      .split('-')
                      .map(Number)
                    return new Date(year, month - 1, day).toLocaleDateString()
                  })()
                : 'No date'}
              ,{' '}
              {primaryMatch.time
                ? formatTime12Hour(primaryMatch.time)
                : 'No time'}
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-800">
              {isConnect
                ? `You are matched with ${matches.length} ${matches.length === 1 ? 'person' : 'people'}`
                : otherRiders.length === 0
                  ? "You're the only rider in this group right now."
                  : otherRiders.length === 1
                    ? `You are matched with ${otherRiders[0].Users.firstname}`
                    : `You are matched with ${otherRiders.length} people`}
            </p>
            {isConnect && (
              <p className="mt-1.5 inline-flex w-fit items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-800">
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
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                Subsidized Connect shuttle — no Uber needed
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="font-medium text-gray-800">
                {primaryMatch.Flights.to_airport
                  ? `School → ${primaryMatch.Flights.airport}`
                  : `${primaryMatch.Flights.airport} → School`}
              </span>
              <span className="text-sm text-gray-500">
                {getAirportAddress(primaryMatch.Flights.airport)}
              </span>
            </p>
            {hasVoucher && isGroupReady ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 shrink-0 text-gray-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <span className="font-medium text-gray-800">
                  Uber voucher:{' '}
                  {voucherStr.startsWith('https') ? (
                    <a
                      href={voucherStr}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-indigo-600 underline hover:text-indigo-800"
                    >
                      {voucherStr}
                    </a>
                  ) : (
                    voucherStr
                  )}
                </span>
              </p>
            ) : needsPickupConfirmation ? (
              <Link
                href={`/aspc-ready?ride_id=${rideId}`}
                className="flex flex-col gap-2 rounded-lg border-2 border-teal-300 bg-teal-50 p-3 transition hover:border-teal-400 hover:bg-teal-100 sm:flex-row sm:items-center sm:gap-3"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 shrink-0 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-teal-800">
                    {isSolo
                      ? hasUberVoucher
                        ? 'Confirm you are ready for pickup to unlock your voucher'
                        : 'Confirm you are ready for pickup to use your contingency voucher'
                      : hasUberVoucher
                        ? 'Confirm your group is ready to unlock your voucher'
                        : 'Confirm your group is ready before using contingency vouchers'}
                  </p>
                  <p className="text-sm text-teal-600">
                    {isSolo
                      ? 'Confirm you are at the pickup location. After everyone is accounted for, your voucher details stay available on this page.'
                      : 'Everyone in your group must confirm they are at the pickup location'}
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 shrink-0 text-teal-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            ) : null}
            {showContingencyBlock ? (
              <p className="flex flex-wrap items-center gap-1.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 shrink-0 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="font-medium text-gray-800">
                  Contingency voucher:{' '}
                  {contingencyStr.startsWith('https') ? (
                    <a
                      href={contingencyStr}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-amber-950 break-all text-amber-800 underline"
                    >
                      {contingencyStr}
                    </a>
                  ) : (
                    contingencyStr
                  )}
                </span>
              </p>
            ) : null}
          </div>

          {!hasAnyVoucher ? (
            <p className="text-sm font-semibold text-gray-600">
              You do not have a voucher available for your group.
            </p>
          ) : isSolo ? (
            <p className="text-sm font-semibold text-teal-700">
              {isGroupReady
                ? 'You have a voucher!'
                : 'You have a voucher! Please confirm you are ready to unlock it!'}
            </p>
          ) : null}

          {upcoming && rideId && !primaryMatch.Flights?.to_airport && (
            <Link
              href={`/aspc-delay/${rideId}`}
              className="mt-3 flex items-center gap-2 self-start rounded-lg border-2 border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 shrink-0 text-amber-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Report a delay
            </Link>
          )}
          {upcoming && (
            <button
              onClick={handleReminderClick}
              className="mt-1 flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
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
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
              Set a Reminder
            </button>
          )}
        </div>

        {(otherRiders.length > 0 || upcoming) && (
          <div className="flex flex-col items-center gap-3 lg:items-end">
            {!isConnect && otherRiders.length > 0 && (
              <>
                <p className="text-sm font-medium text-indigo-600">
                  Other Riders Contact Information
                </p>
                <div className="flex flex-wrap justify-center gap-3 lg:justify-end">
                  {otherRiders.map((match) => (
                    <div
                      key={match.Users.user_id}
                      className="relative flex flex-col items-center gap-1 rounded-xl p-1 transition-all duration-300 hover:scale-105 hover:cursor-pointer hover:shadow-md hover:shadow-gray-600"
                    >
                      <p className="text-center text-sm font-medium text-gray-700">
                        {match.Users.firstname}
                      </p>
                      <div className="relative overflow-hidden rounded-full">
                        <Image
                          src={getProfileUrl(match.Users.photo_url)}
                          alt={`${match.Users.firstname}'s profile`}
                          width={60}
                          height={60}
                          className="rounded-full"
                        />
                      </div>
                      <p className="text-center text-xs text-gray-500">
                        {match.Users.email || 'No email provided'}
                      </p>
                      <p className="text-center text-xs text-gray-500">
                        {match.Users.phonenumber || 'No phone provided'}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {upcoming && (
              <>
                <button
                  type="button"
                  onClick={handleCancelClick}
                  disabled={isDeleting}
                  className={`mt-3 flex items-center gap-1 rounded-lg border border-red-200 bg-white px-4 py-1.5 text-sm font-medium transition-colors ${
                    isDeleting
                      ? 'cursor-not-allowed text-gray-500 opacity-60'
                      : 'text-red-500 hover:bg-red-50 active:bg-red-100'
                  }`}
                >
                  {isDeleting ? (
                    <span className="flex items-center gap-2">
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    <>
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                      Cancel Match
                    </>
                  )}
                </button>
                <ConfirmCancelMatch
                  isOpen={showCancelModal}
                  onClose={() => setShowCancelModal(false)}
                  onConfirm={handleConfirmCancel}
                  isDeleting={isDeleting}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MatchCard
