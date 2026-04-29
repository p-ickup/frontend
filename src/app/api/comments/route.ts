import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import {
  createRideComment,
  getRideComments,
} from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const { searchParams } = new URL(request.url)
    const rideId = Number(searchParams.get('rideId'))

    if (!Number.isFinite(rideId)) {
      return badRequestJson('A valid ride ID is required.')
    }

    const result = await getRideComments({
      supabase: auth.supabase,
      userId: auth.user.id,
      rideId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load comments.')
  }
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json()
    const rideId = Number(body?.rideId)
    const comment = String(body?.comment || '')

    if (!Number.isFinite(rideId)) {
      return badRequestJson('A valid ride ID is required.')
    }
    if (!comment.trim()) {
      return badRequestJson('Comment cannot be empty.')
    }

    const result = await createRideComment({
      supabase: auth.supabase,
      userId: auth.user.id,
      rideId,
      comment,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to create comment.')
  }
}
