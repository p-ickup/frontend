'use client'

import { useState } from 'react'

export default function StarRating({
  rating,
  onChange,
}: {
  rating: number
  onChange: (newRating: number) => void
}) {
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)

  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive =
          hoveredStar !== null ? star <= hoveredStar : star <= rating
        return (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(null)}
            className={`text-2xl transition-colors duration-200 focus:outline-none ${
              isActive ? 'text-yellow-400' : 'text-gray-300'
            }`}
            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
