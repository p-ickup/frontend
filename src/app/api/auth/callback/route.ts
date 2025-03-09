// import { NextResponse } from 'next/server'
// import { cookies } from 'next/headers'
// import { createServerClient } from '@/utils/supabase'

// export async function GET(request: Request) {
//   // The `/auth/callback` route is required for the server-side auth flow implemented
//   // by the Auth Helpers package. It exchanges an auth code for the user's session.
//   // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-sign-in-with-code-exchange
//   const requestUrl = new URL(request.url)
//   const code = requestUrl.searchParams.get('code')

//   if (code) {
//     const cookieStore = cookies()
//     const supabase = createServerClient(cookieStore)
//     await supabase.auth.exchangeCodeForSession(code)
//   }

//   // URL to redirect to after sign in process completes
//   return NextResponse.redirect(requestUrl.origin)
// }

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/' // Default to home

  if (!code) {
    return NextResponse.redirect(
      `${requestUrl.origin}/login?message=Missing auth code`,
    )
  }

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth Error:', error.message)
      return NextResponse.redirect(
        `${requestUrl.origin}/login?message=Authentication failed`,
      )
    }

    // Redirect user to intended page or homepage
    return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`)
  } catch (error) {
    console.error('Unexpected Error:', error)
    return NextResponse.redirect(
      `${requestUrl.origin}/login?message=Unexpected error occurred`,
    )
  }
}
