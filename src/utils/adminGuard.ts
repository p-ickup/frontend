import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Server-side admin access check
 * Returns the user if they are an admin or super_admin, null otherwise
 */
export async function checkAdminAccess() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.log('[Admin Guard] Access denied: No user or auth error', {
      hasUser: !!user,
      error: authError?.message,
    })
    return null
  }

  // Fetch role from Users table
  const { data: userProfile, error: profileError } = await supabase
    .from('Users')
    .select('role, admin_scope')
    .eq('user_id', user.id)
    .single()

  if (profileError || !userProfile) {
    console.log('[Admin Guard] Access denied: Could not fetch user profile', {
      userId: user.id,
      userEmail: user.email,
      error: profileError?.message,
    })
    return null
  }

  const role = userProfile.role

  // Only allow admin or super_admin (case-insensitive check)
  const normalizedRole = role?.toLowerCase()
  if (
    !role ||
    (normalizedRole !== 'admin' && normalizedRole !== 'super_admin')
  ) {
    console.log('[Admin Guard] Access denied: Invalid role', {
      userId: user.id,
      userEmail: user.email,
      currentRole: role || 'NULL',
      userProfile: userProfile,
    })
    return null
  }

  return user
}

/**
 * API route guard for admin-only endpoints
 * Use this in API route handlers to block non-admin access
 *
 * @example
 * ```ts
 * export async function GET(request: Request) {
 *   const user = await requireAdminAccess()
 *   if (!user) {
 *     return new Response('Forbidden', { status: 403 })
 *   }
 *   // ... rest of your admin logic
 * }
 * ```
 */
export async function requireAdminAccess() {
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    console.log('[Admin Guard API] Access denied: No user or auth error', {
      hasUser: !!user,
      error: authError?.message,
    })
    return {
      error: new NextResponse('Forbidden', { status: 403 }),
      user: null,
    }
  }

  // Fetch role from Users table
  const { data: userProfile, error: profileError } = await supabase
    .from('Users')
    .select('role, admin_scope')
    .eq('user_id', user.id)
    .single()

  if (profileError || !userProfile) {
    console.log(
      '[Admin Guard API] Access denied: Could not fetch user profile',
      {
        userId: user.id,
        userEmail: user.email,
        error: profileError?.message,
      },
    )
    return {
      error: new NextResponse('Forbidden', { status: 403 }),
      user: null,
    }
  }

  const role = userProfile.role

  // Only allow admin or super_admin (case-insensitive check)
  const normalizedRole = role?.toLowerCase()
  if (
    !role ||
    (normalizedRole !== 'admin' && normalizedRole !== 'super_admin')
  ) {
    console.log('[Admin Guard API] Access denied: Invalid role', {
      userId: user.id,
      userEmail: user.email,
      currentRole: role || 'NULL',
      userProfile: userProfile,
    })
    return {
      error: new NextResponse('Forbidden', { status: 403 }),
      user: null,
    }
  }

  return {
    error: null,
    user,
  }
}

/**
 * Client-side admin check helper
 * Note: This is for UX only, not security
 */
export function isAdmin(
  user: { user_metadata?: { role?: string } } | null,
): boolean {
  if (!user) return false
  const role = user.user_metadata?.role
  return role === 'Admin' || role === 'Super Admin'
}
