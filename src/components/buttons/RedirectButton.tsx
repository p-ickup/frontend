'use client'

import { useRouter } from 'next/navigation'

interface RedirectButtonProps {
  label: string
  route: string
  color?: string // Optional color prop
  size?: string // Optional size prop
}

const RedirectButton: React.FC<RedirectButtonProps> = ({
  label,
  route,
  color = 'bg-teal-500',
  size = 'px-6 py-3 text-lg',
}) => {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(route)}
      className={`mt-4 rounded-lg ${color} ${size} font-semibold text-white hover:bg-opacity-80`}
    >
      {label}
    </button>
  )
}

export default RedirectButton
