import { requireAuthenticatedRoute, routeErrorJson } from '@/lib/server/auth'
import { getResultsMatches } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const result = await getResultsMatches({
      supabase: auth.supabase,
      userId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load results.')
  }
}
