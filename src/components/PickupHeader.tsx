'use client'

import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'

export default function PickupHeader() {
  const { user, avatarUrl, signInWithGoogle, signOut } = useAuth()

  return (
    <header className="flex items-center justify-between bg-gradient-to-r from-teal-500 to-yellow-100 p-2 text-white">
      <h1 className="text-xl font-bold">
        <SimpleRedirectButton label="P-ickup" route="/" />
      </h1>
      <nav className="flex space-x-4">
        <SimpleRedirectButton label="Questionnaire" route="/questionnaires" />
        <SimpleRedirectButton label="Results" route="/results" />
      </nav>

      <div className="flex items-center">
        {user ? (
          <div className="flex items-center gap-2">
            <div
              onClick={signOut}
              className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-white"
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
        ) : (
          <div
            onClick={signInWithGoogle}
            className="h-10 w-10 cursor-pointer overflow-hidden rounded-full border-2 border-white"
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
