import 'server-only'

import { createServerClient } from '@/utils/supabase'
import type { User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { AuthProfile } from '@/types/auth'

type UserProfile = AuthProfile & {
  role?: string | null
  admin_scope?: string | null
  school?: string | null
  firstname?: string | null
  lastname?: string | null
}

type ServerSupabaseClient = ReturnType<typeof createServerClient>

export type AuthenticatedApiPrincipal = {
  supabase: ServerSupabaseClient
  user: User
}

export type AdminApiPrincipal = AuthenticatedApiPrincipal & {
  profile: UserProfile
}

type ApiHandler<TPrincipal, TContext> = (
  request: Request,
  auth: TPrincipal,
  context: TContext,
) => Response | Promise<Response>

const authenticateRequest = async () => {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  return {
    supabase,
    user: error ? null : user,
  }
}

const authorizeAdmin = async () => {
  const auth = await authenticateRequest()
  if (!auth.user) {
    return {
      ...auth,
      denial: 'unauthenticated' as const,
      profile: null,
    }
  }

  const { data: profile, error: profileError } = await auth.supabase
    .from('Users')
    .select('role, admin_scope, school, firstname, lastname, photo_url')
    .eq('user_id', auth.user.id)
    .single()

  if (profileError || !profile) {
    return {
      denial: 'forbidden' as const,
      supabase: auth.supabase,
      user: null,
      profile: null,
    }
  }

  const normalizedRole = profile.role?.toLowerCase()
  if (normalizedRole !== 'admin' && normalizedRole !== 'super_admin') {
    return {
      denial: 'forbidden' as const,
      supabase: auth.supabase,
      user: null,
      profile: null,
    }
  }

  return {
    denial: null,
    supabase: auth.supabase,
    user: auth.user,
    profile: profile as UserProfile,
  }
}

async function requireAuthenticatedRoute() {
  const auth = await authenticateRequest()

  if (!auth.user) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase: auth.supabase,
      user: null,
    }
  }

  return {
    error: null,
    supabase: auth.supabase,
    user: auth.user,
  }
}

async function requireAdminRoute() {
  const auth = await authorizeAdmin()

  if (auth.denial) {
    const unauthenticated = auth.denial === 'unauthenticated'
    return {
      error: NextResponse.json(
        { error: unauthenticated ? 'Unauthorized' : 'Forbidden' },
        { status: unauthenticated ? 401 : 403 },
      ),
      supabase: auth.supabase,
      user: null,
      profile: null,
    }
  }

  return {
    error: null,
    supabase: auth.supabase,
    user: auth.user,
    profile: auth.profile,
  }
}

export async function getAuthenticatedPagePrincipal() {
  const auth = await authenticateRequest()
  if (!auth.user) return null

  const { data: profile } = await auth.supabase
    .from('Users')
    .select('role, admin_scope, school, photo_url')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  return {
    user: auth.user,
    profile: (profile as AuthProfile | null) || null,
  }
}

export async function getAdminPagePrincipal() {
  const auth = await authorizeAdmin()
  if (auth.denial) return null

  return { user: auth.user, profile: auth.profile }
}

export const withAuthenticatedRoute =
  <TContext = unknown>(
    handler: ApiHandler<AuthenticatedApiPrincipal, TContext>,
  ) =>
  async (request: Request, context: TContext) => {
    const auth = await requireAuthenticatedRoute()
    if (auth.error || !auth.user) return auth.error

    return handler(
      request,
      { supabase: auth.supabase, user: auth.user },
      context,
    )
  }

export const withAdminRoute =
  <TContext = unknown>(handler: ApiHandler<AdminApiPrincipal, TContext>) =>
  async (request: Request, context: TContext) => {
    const auth = await requireAdminRoute()
    if (auth.error || !auth.user || !auth.profile) return auth.error

    return handler(
      request,
      {
        supabase: auth.supabase,
        user: auth.user,
        profile: auth.profile,
      },
      context,
    )
  }

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
