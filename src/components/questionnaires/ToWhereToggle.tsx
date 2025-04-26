import { useState } from 'react'

export default function ToWhereToggle({
  onSelect,
}: {
  onSelect: (tripType: boolean) => void
}) {
  const [isToAirport, setIsToAirport] = useState(true) // true = "To Airport", false = "To School"

  const handleSelect = (toAirport: boolean) => {
    setIsToAirport(toAirport)
    onSelect(toAirport) // Pass boolean value to parent component
  }

  return (
    <div className="flex justify-center space-x-4">
      <button
        type="button" // Prevents unintended form submission
        className={`rounded-lg px-4 py-2 ${
          isToAirport ? 'bg-teal-600 text-white' : 'bg-gray-200 text-black'
        }`}
        onClick={() => handleSelect(true)}
      >
        To Airport
      </button>
      <button
        type="button" // Prevents unintended form submission
        className={`rounded-lg px-4 py-2 ${
          !isToAirport ? 'bg-teal-600 text-white' : 'bg-gray-200 text-black'
        }`}
        onClick={() => handleSelect(false)}
      >
        To School
      </button>
    </div>
  )
}
