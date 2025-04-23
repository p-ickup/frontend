'use client'

import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'

export default function PickupHeader() {
  const { user, avatarUrl, signOut } = useAuth()
  const router = useRouter()

  const handleProfileClick = () => {
    if (user) {
      router.push('/profile')
    } else {
      router.push('/login')
    }
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      router.refresh()
    }
  }

  return (
    <header className="flex min-h-[80px] items-center justify-between bg-gradient-to-r from-teal-500 to-yellow-100 p-2 text-white pl-11 pr-10">
      <h1 className="text-xl font-bold">
        <SimpleRedirectButton label="P-ickup" route="/" />
      </h1>
      <nav className="flex space-x-4">
        <SimpleRedirectButton label="Questionnaire" route="/questionnaires" />
        <SimpleRedirectButton label="Results" route="/results" />
      </nav>

      <div className="flex items-center gap-4">
        {user ? (
          <>
            <div className="flex items-center gap-2">
              <div
                onClick={handleProfileClick}
                className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-white transition-colors hover:border-indigo-300"
              >
                <Image
                  src={avatarUrl || '/images/profileIcon.webp'}
                  alt="Profile"
                  width={40}
                  height={40}
                  className="object-cover"
                />
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 rounded-lg border border-red-200 bg-white 
                px-3 py-1.5 text-sm font-medium text-red-500 transition-colors hover:bg-red-50 active:bg-red-100"
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
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Logout
            </button>
          </>
        ) : (
          <div
            onClick={handleProfileClick}
            className="cursor-pointer overflow-hidden rounded-full border-2 border-white transition-colors hover:border-indigo-300"
          >
            <Image
              src="/images/profileIcon.webp"
              alt="Login"
              width={40}
              height={40}
              className="object-cover"
            />
          </div>
        )}
      </div>
    </header>
  )
}
