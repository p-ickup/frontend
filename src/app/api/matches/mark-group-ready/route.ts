import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { markGroupsReadyIfEligible } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const rideIds: number[] = Array.isArray(body?.rideIds)
      ? Array.from(
          new Set<number>(
            body.rideIds.map((rideId: unknown) => Number(rideId)),
          ),
        )
      : []

    if (
      rideIds.length === 0 ||
      rideIds.length > 100 ||
      rideIds.some((rideId) => !Number.isInteger(rideId) || rideId <= 0)
    ) {
      return badRequestJson('One to 100 valid ride IDs are required.')
    }

    const result = await markGroupsReadyIfEligible({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      rideIds,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to persist ride readiness.')
  }
})
