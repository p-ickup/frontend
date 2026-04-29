import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { getAspcDelayData } from '@/lib/server/studentCommands'
import {
  declineDelayGroups,
  joinDelayGroup,
  reportDelay,
} from '@/lib/server/aspcDelayCommands'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const rideIdParam = searchParams.get('rideId')
    const rideId =
      rideIdParam == null || rideIdParam === '' ? null : Number(rideIdParam)

    if (rideIdParam && !Number.isFinite(rideId)) {
      return badRequestJson('A valid ride ID is required.')
    }

    const result = await getAspcDelayData({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      rideId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load delay data.')
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json()
    const action = String(body?.action || '')

    if (action === 'report') {
      const result = await reportDelay({
        supabase: createServiceRoleClient(),
        rideId: String(body?.rideId || ''),
        userId: auth.user.id,
        reasonForDelay: String(body?.reasonForDelay || ''),
        newEtaDate: String(body?.newEtaDate || ''),
        newEtaTime: String(body?.newEtaTime || ''),
        newEtaTimeEarliest: body?.newEtaTimeEarliest
          ? String(body.newEtaTimeEarliest)
          : undefined,
        newEtaTimeLatest: body?.newEtaTimeLatest
          ? String(body.newEtaTimeLatest)
          : undefined,
        newFlight: body?.newFlight ?? undefined,
      })

      return NextResponse.json(result)
    }

    if (action === 'join') {
      const currentRideId = Number(body?.currentRideId)
      const selectedRideId = Number(body?.selectedRideId)
      if (!Number.isFinite(currentRideId) || !Number.isFinite(selectedRideId)) {
        return badRequestJson(
          'Valid current and selected ride IDs are required.',
        )
      }

      const result = await joinDelayGroup({
        supabase: createServiceRoleClient(),
        currentRideId,
        userId: auth.user.id,
        selectedRideId,
      })

      return NextResponse.json(result)
    }

    if (action === 'decline') {
      const currentRideId = Number(body?.currentRideId)
      if (!Number.isFinite(currentRideId)) {
        return badRequestJson('A valid current ride ID is required.')
      }

      const result = await declineDelayGroups({
        supabase: createServiceRoleClient(),
        currentRideId,
        userId: auth.user.id,
      })

      return NextResponse.json(result)
    }

    return badRequestJson('Unsupported delay action.')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to process delay request.')
  }
}
