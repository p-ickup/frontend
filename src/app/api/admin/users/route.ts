import { requireAdminAccess } from '@/utils/adminGuard'
import { createServerClient } from '@/utils/supabase'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

/**
 * Example admin-only API endpoint
 * This demonstrates how to protect API routes with admin access control
 */
export async function GET() {
  // Check admin access - returns 403 if not admin
  const { error, user } = await requireAdminAccess()

  if (error) {
    return error
  }

  if (!user) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const cookieStore = cookies()
    const supabase = createServerClient(cookieStore)

    // Fetch users - RLS will automatically filter based on admin scope
    const { data, error: fetchError } = await supabase
      .from('Users')
      .select(
        'user_id, firstname, lastname, school, role, admin_scope, created_at',
      )
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching users:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch users', details: fetchError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ users: data || [] })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}
