import RedirectButton from '@/components/buttons/RedirectButton'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

export default async function Index() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="flex min-h-[calc(100vh-165px)] w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-6 text-black bg-gradient-to-r from-teal-100/50 to-yellow-100/50 p-20">
        <h1 className="text-3xl font-bold">Welcome to P-ickup</h1>
        <p>No one wants to spend $100 on a single Uber ride. Short blurb about P-ickup lorem ipsum dolor sit amet</p>

        {/* Conditional Redirect Button based on auth state */}
        {user ? (
          <RedirectButton label="Click Here to Start" route="/profile" />
        ) : (
          <RedirectButton label="Login to Start" route="/login" />
        )}
      </div>
      
    </div>
  )
}
