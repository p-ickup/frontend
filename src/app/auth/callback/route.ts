import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'
import { createServiceRoleClient } from '@/lib/server/serviceRole'

const splitName = (fullName: string | null | undefined) => {
  const trimmed = (fullName || '').trim()
  if (!trimmed) {
    return {
      firstname: 'Unknown',
      lastname: null as string | null,
    }
  }

  const parts = trimmed.split(/\s+/)
  const firstname = parts[0] || 'Unknown'
  const lastname = parts.length > 1 ? parts.slice(1).join(' ') : null

  return { firstname, lastname }
}

const getRequestOrigin = (request: Request, requestUrl: URL) => {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host =
    request.headers.get('x-forwarded-host') || request.headers.get('host')

  if (host) {
    return `${forwardedProto || requestUrl.protocol.replace(':', '')}://${host}`
  }

  return requestUrl.origin
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const requestOrigin = getRequestOrigin(request, requestUrl)
  const code = requestUrl.searchParams.get('code')
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/' // Default to home
  const errorRedirect = (message: string) =>
    NextResponse.redirect(
      `${requestOrigin}/?authError=${encodeURIComponent(message)}`,
    )

  if (!code) {
    return errorRedirect('Missing auth code')
  }

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Auth Error:', error.message)
      return errorRedirect('Authentication failed')
    }

    const user = data.user
    if (user) {
      try {
        const serviceRole = createServiceRoleClient()
        const metadata = user.user_metadata || {}
        const identityData = user.identities?.[0]?.identity_data || {}
        const fallbackName =
          metadata.full_name ||
          metadata.name ||
          identityData.full_name ||
          identityData.name

        const { firstname, lastname } = splitName(fallbackName)

        const school =
          typeof metadata.school === 'string' && metadata.school.trim() !== ''
            ? metadata.school.trim()
            : 'Unknown'

        const photoUrl =
          metadata.avatar_url ||
          metadata.picture ||
          identityData.avatar_url ||
          identityData.picture ||
          null

        const { error: upsertError } = await serviceRole.from('Users').upsert(
          {
            user_id: user.id,
            email: user.email || null,
            firstname,
            lastname,
            school,
            photo_url: photoUrl,
          },
          { onConflict: 'user_id' },
        )

        if (upsertError) {
          console.error('Failed to create/update user profile:', upsertError)
        }
      } catch (profileError) {
        console.error('Profile bootstrap failed after login:', profileError)
      }
    }

    // Redirect user to intended page or homepage
    return NextResponse.redirect(`${requestOrigin}${redirectTo}`)
  } catch (error) {
    console.error('Unexpected Error:', error)
    return errorRedirect('Unexpected error occurred')
  }
}
