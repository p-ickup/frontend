'use client'

import { useRouter } from 'next/navigation'

interface RedirectButtonProps {
  label: string
  route: string
  color?: string // Optional color prop
  size?: string // Optional size prop
  className?: string // Optional custom className
}

const RedirectButton: React.FC<RedirectButtonProps> = ({
  label,
  route,
  color = 'bg-teal-500',
  size = 'px-6 py-3 text-lg',
  className = '',
}) => {
  const router = useRouter()

  // If custom className is provided, use it; otherwise use the default styling
  const buttonClassName =
    className ||
    `mt-4 rounded-lg ${color} ${size} font-semibold text-white hover:bg-opacity-80`

  return (
    <button onClick={() => router.push(route)} className={buttonClassName}>
      {label}
    </button>
  )
}

export default RedirectButton
