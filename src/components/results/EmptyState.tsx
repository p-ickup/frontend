import RedirectButton from '@/components/buttons/RedirectButton'

interface EmptyStateProps {
  type: 'upcoming' | 'previous' | 'login'
  onLogin?: () => void
}

const EmptyState = ({ type, onLogin }: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-3">
        {type === 'login' ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        )}
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        {type === 'login' ? 'Please Log In' : `No ${type} matches found`}
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        {type === 'upcoming'
          ? "You don't have any upcoming matches. Create a new match to get started!"
          : type === 'previous'
            ? "You haven't completed any rides yet."
            : 'Log in to see your matches and manage your rides.'}
      </p>
      {type === 'upcoming' && (
        <RedirectButton label="Find a Match" route="/questionnaires" />
      )}
      {type === 'login' &&
        (onLogin ? (
          <button
            onClick={onLogin}
            className="mt-4 rounded-lg bg-teal-500 px-6 py-3 text-lg font-semibold text-white hover:bg-opacity-80"
          >
            Log in
          </button>
        ) : (
          <RedirectButton label="Log in" route="/login" />
        ))}
    </div>
  )
}

export default EmptyState
