import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { reportReadyStatus } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const POST = withAuthenticatedRoute(async (request, auth) => {
  try {
    const body = await request.json()
    const rideId = Number(body?.rideId)
    const everyoneReady = Boolean(body?.everyoneReady)
    const missingUserIds = Array.isArray(body?.missingUserIds)
      ? body.missingUserIds.map(String)
      : []

    if (!Number.isFinite(rideId)) {
      return badRequestJson('A valid ride ID is required.')
    }

    const result = await reportReadyStatus({
      supabase: auth.supabase,
      rideId,
      everyoneReady,
      missingUserIds,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to submit ready status.')
  }
})
