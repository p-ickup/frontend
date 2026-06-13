import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { markGroupReadyIfEligible } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const rideId = Number(body?.rideId)

    if (!Number.isFinite(rideId)) {
      return badRequestJson('A valid ride ID is required.')
    }

    const result = await markGroupReadyIfEligible({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      rideId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to persist ride readiness.')
  }
})
