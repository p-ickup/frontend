import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { sendMatchRequest } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const body = await request.json()
    const receiverId = String(body?.receiverId || '')
    const senderFlightId = Number(body?.senderFlightId)
    const receiverFlightId = Number(body?.receiverFlightId)

    if (!receiverId) {
      return badRequestJson('A valid receiver ID is required.')
    }
    if (
      !Number.isFinite(senderFlightId) ||
      !Number.isFinite(receiverFlightId)
    ) {
      return badRequestJson(
        'Valid sender and receiver flight IDs are required.',
      )
    }

    const result = await sendMatchRequest({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      receiverId,
      senderFlightId,
      receiverFlightId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to send match request.')
  }
}
