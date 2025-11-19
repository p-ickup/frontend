'use client'

import Image from 'next/image'
import { MatchWithDetails } from '@/app/results/page'
import { useState } from 'react'
import { createBrowserClient } from '@/utils/supabase'

interface MatchCardProps {
  matches: MatchWithDetails[]
  upcoming: boolean
  onDelete?: (rideId: number) => Promise<void>
}

const getAirportAddress = (airport: string): string => {
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

const MatchCard = ({ matches, upcoming, onDelete }: MatchCardProps) => {
  const firstMatch = matches[0]
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

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return

    try {
      setIsDeleting(true)
      await onDelete(firstMatch.ride_id)
    } catch (error) {
      console.error('Error deleting match:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReminderClick = () => {
    if (!firstMatch.date || !firstMatch.time) return

    // Parse date manually to avoid timezone issues
    const [year, month, day] = firstMatch.date.split('-').map(Number)
    const matchDate = new Date(year, month - 1, day)
    const matchTime = firstMatch.time
    const flightData = firstMatch.Flights

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
              {firstMatch.date
                ? (() => {
                    const [year, month, day] = firstMatch.date
                      .split('-')
                      .map(Number)
                    return new Date(year, month - 1, day).toLocaleDateString()
                  })()
                : 'No date'}
              , {firstMatch.time || 'No time'}
            </p>
            <p className="mt-1 text-xl font-semibold text-gray-800">
              You are matched with{' '}
              {matches.length === 1
                ? firstMatch.Users.firstname
                : `${matches.length} people`}
            </p>
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
                {firstMatch.Flights.airport}
              </span>
              <span className="text-sm text-gray-500">
                {getAirportAddress(firstMatch.Flights.airport)}
              </span>
            </p>
            {firstMatch.voucher && (
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
                    d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z"
                  />
                </svg>
                <span className="font-medium text-gray-800">
                  Voucher: {firstMatch.voucher}
                </span>
              </p>
            )}
          </div>

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

        {/* Right side with contact info and profile pictures */}
        <div className="flex flex-col items-center gap-3 lg:items-end">
          <p className="text-sm font-medium text-indigo-600">
            Other Riders Contact Information
          </p>
          <div className="flex flex-wrap justify-center gap-3 lg:justify-end">
            {matches.map((match) => (
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

          {upcoming && (
            <button
              onClick={handleDelete}
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
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
          )}
        </div>
      </div>
    </div>
  )
}

export default MatchCard
