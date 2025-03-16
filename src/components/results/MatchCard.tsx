import Image from 'next/image'
import { MatchWithDetails } from '../../types/match'

interface MatchCardProps {
  matches: MatchWithDetails[]
  upcoming: boolean
}

const getAirportAddress = (airport: string): string => {
  const airports: Record<string, string> = {
    LAX: 'World Way, Los Angeles, CA 90045',
    SNA: '18601 Airport Way, Santa Ana, CA 92707',
  }
  return airports[airport] || ''
}

const MatchCard = ({ matches, upcoming }: MatchCardProps) => {
  // Use the first match for common information
  const firstMatch = matches[0]

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
            <button className="mt-1 flex items-center gap-1 self-start text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline">
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
                    src={match.Users.photo_url || '/images/profileIcon.webp'}
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
              className="mt-3 flex items-center gap-1 rounded-lg border border-red-200 bg-white 
            px-4 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 active:bg-red-100"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Cancel Match
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default MatchCard
