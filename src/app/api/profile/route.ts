import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { saveOwnProfile } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json()
    const profile = body?.profile

    if (!profile || typeof profile !== 'object') {
      return badRequestJson('Profile payload is required.')
    }

    const result = await saveOwnProfile({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      profile: {
        email: String(profile.email || ''),
        firstname: String(profile.firstname || ''),
        lastname: String(profile.lastname || ''),
        school: String(profile.school || ''),
        phonenumber: String(profile.phonenumber || ''),
        sms_opt_in: Boolean(profile.sms_opt_in),
        photo_url: String(profile.photo_url || ''),
        instagram:
          profile.instagram == null || profile.instagram === ''
            ? null
            : String(profile.instagram),
      },
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to save profile.')
  }
}
