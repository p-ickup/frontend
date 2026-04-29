import { getUnmatchedOptions } from '@/lib/server/studentCommands'
import { requireAuthenticatedRoute, routeErrorJson } from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { NextResponse } from 'next/server'

export async function GET() {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const result = await getUnmatchedOptions({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load unmatched options.')
  }
}
