import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { getAspcReadyData } from '@/lib/server/studentCommands'
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

    const result = await getAspcReadyData({
      supabase: auth.supabase,
      userId: auth.user.id,
      rideId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load ready-for-pickup data.')
  }
}
