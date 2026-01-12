'use client'

// <<<<<<< unmatchedpage-yunju&josh
import { createClient } from '@supabase/supabase-js'
import Image from 'next/image'
import { useEffect, useState } from 'react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
// where old main starts
import SimpleRedirectButton from '@/components/buttons/SimpleRedirectButton'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
// >>>>>>> main

export default function PickupHeader() {
  const { user, avatarUrl, signOut, signInWithGoogle } = useAuth()
  const router = useRouter()
  const [avatarKey, setAvatarKey] = useState(0)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Fetch admin status from Users table
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false)
        return
      }

      try {
        const { data: userProfile } = await supabase
          .from('Users')
          .select('role')
          .eq('user_id', user.id)
          .single()

        if (userProfile?.role) {
          const normalizedRole = userProfile.role.toLowerCase()
          setIsAdmin(
            normalizedRole === 'admin' || normalizedRole === 'super_admin',
          )
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      }
    }

    checkAdminStatus()
  }, [user])

  // Force re-render when avatarUrl changes
  useEffect(() => {
    setAvatarKey((prev) => prev + 1)
  }, [avatarUrl])

  const handleProfileClick = () => {
    if (user) {
      router.push('/profile')
    } else {
      signInWithGoogle()
    }
  }

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      router.refresh()
    }
  }

  return (
    <>
      <header className="flex min-h-[80px] items-center justify-between bg-gradient-to-r from-teal-500 to-yellow-100 p-4 text-white shadow-lg sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div
            onClick={() => router.push('/')}
            className="h-25 w-25 border-1 cursor-pointer overflow-hidden rounded-full hover:border-yellow-200"
          >
            <Image
              src="/favicon.ico"
              alt="P-ickup logo"
              width={65}
              height={65}
              className="object-cover"
            />
          </div>
          {/* Dashboard button - always rendered to prevent layout shift, hidden on mobile */}
          <div
            className={`hidden rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm transition-opacity duration-200 md:block ${
              isAdmin
                ? 'pointer-events-auto opacity-100'
                : 'pointer-events-none opacity-0'
            }`}
          >
            <SimpleRedirectButton label="Dashboard" route="/admin" />
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden space-x-1 md:flex lg:space-x-3">
          <div className="rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm">
            <SimpleRedirectButton label="Forms" route="/questionnaires" />
          </div>
          <div className="rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm">
            <SimpleRedirectButton label="Results" route="/results" />
          </div>
          <div className="rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm">
            <SimpleRedirectButton label="Unmatched" route="/unmatched" />
          </div>
          <div className="rounded-lg bg-white/10 px-1 py-1 backdrop-blur-sm">
            <SimpleRedirectButton label="Feedback" route="/feedback" />
          </div>
        </nav>

        {/* Mobile Navigation - Hamburger Menu */}
        <div className="md:hidden">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-8 w-8 flex-col items-center justify-center space-y-1"
          >
            <span
              className={`block h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-1.5 rotate-45' : ''}`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}
            ></span>
            <span
              className={`block h-0.5 w-6 bg-white transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-1.5 -rotate-45' : ''}`}
            ></span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="flex items-center gap-3">
                <div
                  onClick={handleProfileClick}
                  className="h-12 w-12 cursor-pointer overflow-hidden rounded-full border-2 border-white shadow-md transition-all duration-300 hover:scale-105 hover:border-indigo-300"
                >
                  <Image
                    key={avatarKey}
                    src={avatarUrl || '/images/profileIcon.webp'}
                    alt="Profile"
                    width={50}
                    height={50}
                    className="object-cover"
                  />
                </div>
              </div>
              <button
                onClick={handleSignOut}
                className="hidden items-center gap-2 rounded-lg border border-red-200 bg-white/90 px-4 py-2
                text-sm font-medium text-red-500 shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-red-50 active:bg-red-100 sm:flex"
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
              {/* Mobile logout - just icon */}
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center rounded-lg border border-red-200 bg-white/90 p-2 text-red-500
                shadow-md backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:bg-red-50 active:bg-red-100 sm:hidden"
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
              </button>
            </>
          ) : (
            <div
              onClick={handleProfileClick}
              className="cursor-pointer transition-all duration-300 hover:scale-105"
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

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="border-t border-white/20 bg-gradient-to-r from-teal-500 to-yellow-100 md:hidden">
          <div className="space-y-3 px-4 py-4">
            <button
              onClick={() => {
                router.push('/questionnaires')
                setIsMobileMenuOpen(false)
              }}
              className="block w-full py-2 text-left text-white transition-colors hover:text-yellow-200"
            >
              📋 Questionnaire
            </button>
            <button
              onClick={() => {
                router.push('/results')
                setIsMobileMenuOpen(false)
              }}
              className="block w-full py-2 text-left text-white transition-colors hover:text-yellow-200"
            >
              🎯 Results
            </button>
            <button
              onClick={() => {
                router.push('/unmatched')
                setIsMobileMenuOpen(false)
              }}
              className="block w-full py-2 text-left text-white transition-colors hover:text-yellow-200"
            >
              👥 Unmatched
            </button>
            <button
              onClick={() => {
                router.push('/feedback')
                setIsMobileMenuOpen(false)
              }}
              className="block w-full py-2 text-left text-white transition-colors hover:text-yellow-200"
            >
              💬 Feedback
            </button>
            {isAdmin && (
              <button
                onClick={() => {
                  router.push('/admin')
                  setIsMobileMenuOpen(false)
                }}
                className="block w-full py-2 text-left text-white transition-colors hover:text-yellow-200"
              >
                🔐 Dashboard
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
