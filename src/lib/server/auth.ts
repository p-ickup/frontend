import 'server-only'

import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

type UserProfile = {
  role?: string | null
  admin_scope?: string | null
  school?: string | null
  firstname?: string | null
  lastname?: string | null
}

export async function requireAuthenticatedRoute() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      supabase,
      user: null,
    }
  }

  return {
    error: null,
    supabase,
    user,
  }
}

export async function requireAdminRoute() {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return {
      ...auth,
      profile: null,
    }
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from('Users')
    .select('role, admin_scope, school, firstname, lastname')
    .eq('user_id', auth.user.id)
    .single()

  if (profileError || !profile) {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      supabase: auth.supabase,
      user: null,
      profile: null,
    }
  }

  const normalizedRole = profile.role?.toLowerCase()
  if (normalizedRole !== 'admin' && normalizedRole !== 'super_admin') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      supabase: auth.supabase,
      user: null,
      profile: null,
    }
  }

  return {
    error: null,
    supabase: auth.supabase,
    user: auth.user,
    profile: profile as UserProfile,
  }
}

export const forbiddenJson = (message = 'Forbidden') =>
  NextResponse.json({ error: message }, { status: 403 })

export const badRequestJson = (message: string, details?: unknown) =>
  NextResponse.json({ error: message, details }, { status: 400 })

export const internalErrorJson = (message: string, details?: unknown) =>
  NextResponse.json({ error: message, details }, { status: 500 })

export const routeErrorJson = (
  error:
    | {
        message?: string
        details?: unknown
        status?: number
      }
    | null
    | undefined,
  fallbackMessage: string,
) =>
  NextResponse.json(
    {
      error: error?.message || fallbackMessage,
      details: error?.details,
    },
    { status: error?.status || 500 },
  )
