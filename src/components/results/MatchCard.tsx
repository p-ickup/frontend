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

// Helper function to generate an all-day ICS file with two alarms
const createICSFile = (
  eventTitle: string,
  description: string,
  location: string,
  startDate: Date,
) => {
  const pad = (num: number) => String(num).padStart(2, '0')

  const formatDate = (date: Date) => {
    return (
      date.getUTCFullYear().toString() +
      pad(date.getUTCMonth() + 1) +
      pad(date.getUTCDate())
    )
  }

  const start = formatDate(startDate)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 1) // End is exclusive
  const end = formatDate(endDate)

  const content = `BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${eventTitle}
DESCRIPTION:${description}
LOCATION:${location}
DTSTART;VALUE=DATE:${start}
DTEND;VALUE=DATE:${end}
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
    setUrlCache((prev) => ({ ...prev, [photoPath]: publicUrl }))
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
    const flightDate = new Date(firstMatch.Flights.date) // Full day event on flight date

    createICSFile(
      'pickup_reminder',
      'Reminder to prepare for your PICKUP ride share!',
      getAirportAddress(firstMatch.Flights.airport),
      flightDate,
    )
  }

  return (
    <div className="mb-6 w-full max-w-3xl rounded-xl border border-gray-100 bg-white p-5 shadow-md transition-all hover:shadow-lg">
      <div className="flex justify-between">
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
              {new Date(firstMatch.created_at).toLocaleDateString()},{' '}
              {firstMatch.Flights.airport}
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
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="font-medium text-gray-800">
                ${firstMatch.Flights.max_price}
              </span>
            </p>
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
        <div className="flex flex-col items-end gap-3">
          <p className="text-sm font-medium text-indigo-600">
            Other Riders Contact Information
          </p>
          <div className="flex flex-wrap justify-end gap-3">
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
