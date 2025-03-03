'use client'

import { useRouter } from 'next/navigation'

interface RedirectButtonProps {
  label: string
  route: string
}

const RedirectButton: React.FC<RedirectButtonProps> = ({ label, route }) => {
  const router = useRouter()

  return (
    <button
      onClick={() => router.push(route)}
      className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white hover:bg-blue-700"
    >
      {label}
    </button>
  )
}

export default RedirectButton
