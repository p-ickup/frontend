import {
  requireAuthenticatedRoute,
  badRequestJson,
  routeErrorJson,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { createOwnFlight } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json()
    const payload = body?.payload

    if (!payload || typeof payload !== 'object') {
      return badRequestJson('Flight payload is required.')
    }

    const result = await createOwnFlight({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      payload,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to create flight.')
  }
}
