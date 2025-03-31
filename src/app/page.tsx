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
    <div className="flex min-h-screen w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-6 text-black">
        <h1 className="text-3xl font-bold">Welcome to P-ickup</h1>
        <p>About P-ickup</p>

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
