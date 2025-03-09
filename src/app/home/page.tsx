import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'

import AuthButton from '@/components/AuthButton'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

export default function Home() {
  const cookieStore = cookies()

  const canInitSupabaseClient = () => {
    try {
      createServerClient(cookieStore)
      return true
    } catch (e) {
      return false
    }
  }

  const isSupabaseConnected = canInitSupabaseClient()

  return (
    <div className="flex w-full flex-1 flex-col items-center gap-20">
      <nav className="flex h-16 w-full justify-center border-b border-b-foreground/10">
        <div className="flex w-full max-w-4xl items-center justify-between p-3 text-sm">
          {isSupabaseConnected && <AuthButton />}
        </div>
      </nav>

      <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
        {/* Header at the top */}
        <PickupHeader />

        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
          <h1 className="mb-4 text-3xl font-bold">Welcome to the Home Page</h1>
          <p className="mb-6">About P-ickup</p>

          {/* Reusable Redirect Button */}
          <RedirectButton label="Click Here to Start" route="/profile" />
        </div>
      </div>
    </div>
  )
}
