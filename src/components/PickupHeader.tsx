'use client'

import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import SimpleRedirectButton from './buttons/SimpleRedirectButton'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export default function PickupHeader() {
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // Check auth state
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data?.user)
    }

    fetchUser()

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user || null)
      },
    )

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  // Login function
  const handleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
    })
    if (error) console.error('Login error:', error)
  }

  // Logout function
  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return (
    <header className="flex items-center justify-between bg-gradient-to-r from-teal-500 to-yellow-100 p-2 text-white">
      <h1 className="text-xl font-bold">
        <SimpleRedirectButton label="P-ickup" route="/" />
      </h1>
      <nav className="flex space-x-4">
        <SimpleRedirectButton label="Questionnaire" route="/questionnaires" />
        <SimpleRedirectButton label="Results" route="/results" />
        <SimpleRedirectButton label="Unmatched" route="/unmatched" />
      </nav>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="flex items-center space-x-4">
            <span className="text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="rounded-md border border-white bg-white px-4 py-2 text-sm font-medium text-teal-500 hover:bg-teal-50"
            >
              Logout
            </button>
          </div>
        ) : (
          // If the user is not logged in, show the login image and handle login
          <div onClick={handleLogin} className="cursor-pointer">
            <Image
              src="/images/profileIcon.webp" // Path to your PNG file
              alt="Login Image"
              width={100} // Resize as needed
              height={100} // Resize as needed
              className="object-contain" // Maintains aspect ratio
            />
          </div>
        )}
      </div>
    </header>
  )
}
