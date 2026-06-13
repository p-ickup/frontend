import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'

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
    console.warn(
      '[Admin Guard] Access denied during auth check.',
      authError?.message,
    )
    return null
  }

  // Fetch role from Users table
  const { data: userProfile, error: profileError } = await supabase
    .from('Users')
    .select('role, admin_scope')
    .eq('user_id', user.id)
    .single()

  if (profileError || !userProfile) {
    console.warn(
      '[Admin Guard] Access denied while loading admin profile.',
      profileError?.message,
    )
    return null
  }

  const role = userProfile.role

  // Only allow admin or super_admin (case-insensitive check)
  const normalizedRole = role?.toLowerCase()
  if (
    !role ||
    (normalizedRole !== 'admin' && normalizedRole !== 'super_admin')
  ) {
    console.warn('[Admin Guard] Access denied for non-admin role.')
    return null
  }

  return user
}
