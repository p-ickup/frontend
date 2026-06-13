import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@/utils/supabase'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { getSafeAuthOrigin, getSafeReturnPath } from '@/config/routeAccess'

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

const hasProfileValue = (value: string | null | undefined) =>
  typeof value === 'string' && value.trim() !== '' && value.trim() !== 'Unknown'

const preserveProfileValue = (
  existingValue: string | null | undefined,
  fallbackValue: string | null,
) => {
  if (hasProfileValue(existingValue)) {
    return existingValue!.trim()
  }

  return fallbackValue
}

const hasCompleteProfile = (profile: {
  email?: string | null
  firstname?: string | null
  lastname?: string | null
  school?: string | null
  phonenumber?: string | null
}) =>
  hasProfileValue(profile.email) &&
  hasProfileValue(profile.firstname) &&
  hasProfileValue(profile.lastname) &&
  hasProfileValue(profile.school) &&
  hasProfileValue(profile.phonenumber)

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const requestOrigin = getSafeAuthOrigin(
    requestUrl,
    process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL,
  )
  const code = requestUrl.searchParams.get('code')
  const redirectTo =
    getSafeReturnPath(requestUrl.searchParams.get('redirectTo')) || '/'
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
    let shouldRedirectToProfile = false

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

        const { data: existingProfile, error: existingProfileError } =
          await serviceRole
            .from('Users')
            .select(
              'email, firstname, lastname, school, phonenumber, photo_url',
            )
            .eq('user_id', user.id)
            .maybeSingle()

        if (existingProfileError) {
          console.error(
            'Failed to fetch existing user profile during auth bootstrap:',
            existingProfileError,
          )
        }

        const nextProfile = {
          user_id: user.id,
          email: user.email || existingProfile?.email || null,
          firstname: preserveProfileValue(
            existingProfile?.firstname,
            firstname,
          ),
          lastname: preserveProfileValue(existingProfile?.lastname, lastname),
          school: preserveProfileValue(existingProfile?.school, school),
          photo_url: existingProfile?.photo_url || photoUrl,
        }

        const { error: upsertError } = await serviceRole
          .from('Users')
          .upsert(nextProfile, { onConflict: 'user_id' })

        if (upsertError) {
          console.error('Failed to create/update user profile:', upsertError)
        }

        shouldRedirectToProfile = !hasCompleteProfile({
          ...nextProfile,
          phonenumber: existingProfile?.phonenumber,
        })
      } catch (profileError) {
        console.error('Profile bootstrap failed after login:', profileError)
        shouldRedirectToProfile = true
      }
    }

    // Redirect user to intended page or homepage
    return NextResponse.redirect(
      `${requestOrigin}${shouldRedirectToProfile ? '/profile' : redirectTo}`,
    )
  } catch (error) {
    console.error('Unexpected Error:', error)
    return errorRedirect('Unexpected error occurred')
  }
}
