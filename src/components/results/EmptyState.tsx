import RedirectButton from '../RedirectButton'

const EmptyState = ({ type }: { type: 'upcoming' | 'previous' }) => {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
      <div className="mb-4 rounded-full bg-gray-100 p-3">
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
      </div>
      <h3 className="mb-2 text-lg font-medium text-gray-900">
        No {type} matches found
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        {type === 'upcoming'
          ? "You don't have any upcoming matches. Create a new match to get started!"
          : "You haven't completed any rides yet."}
      </p>
      {type === 'upcoming' && (
        <RedirectButton label="Find a Match" route="/questionnaires" />
      )}
    </div>
  )
}

export default EmptyState
