import { internalErrorJson, requireAdminRoute } from '@/lib/server/auth'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const auth = await requireAdminRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json().catch(() => ({}))
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase configuration')
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/send-all-match-emails-batch`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    )

    const result = await response.json().catch(() => ({}))

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || `HTTP ${response.status}` },
        { status: response.status },
      )
    }

    return NextResponse.json(result)
  } catch (error: any) {
    return internalErrorJson(
      error?.message || 'Failed to send match emails.',
      error?.details,
    )
  }
}
