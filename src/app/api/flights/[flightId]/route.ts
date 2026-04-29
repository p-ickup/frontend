import {
  badRequestJson,
  requireAuthenticatedRoute,
  routeErrorJson,
} from '@/lib/server/auth'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { deleteOwnFlight, updateOwnFlight } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  context: { params: { flightId: string } },
) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const flightId = Number(context.params.flightId)
    const body = await request.json()
    const payload = body?.payload

    if (!Number.isFinite(flightId)) {
      return badRequestJson('A valid flight ID is required.')
    }
    if (!payload || typeof payload !== 'object') {
      return badRequestJson('Flight payload is required.')
    }

    const result = await updateOwnFlight({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      flightId,
      payload,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to update flight.')
  }
}

export async function DELETE(
  _request: Request,
  context: { params: { flightId: string } },
) {
  const auth = await requireAuthenticatedRoute()
  if (auth.error || !auth.user) {
    return auth.error
  }

  try {
    const flightId = Number(context.params.flightId)
    if (!Number.isFinite(flightId)) {
      return badRequestJson('A valid flight ID is required.')
    }

    const result = await deleteOwnFlight({
      supabase: createServiceRoleClient(),
      userId: auth.user.id,
      flightId,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to delete flight.')
  }
}
