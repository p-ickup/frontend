import {
  badRequestJson,
  routeErrorJson,
  withAuthenticatedRoute,
} from '@/lib/server/auth'
import { deleteOwnFlight, updateOwnFlight } from '@/lib/server/studentCommands'
import { NextResponse } from 'next/server'

export const PATCH = withAuthenticatedRoute(
  async (request, auth, context: { params: { flightId: string } }) => {
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
        supabase: auth.supabase,
        userId: auth.user.id,
        flightId,
        payload,
      })

      return NextResponse.json(result)
    } catch (error: any) {
      return routeErrorJson(error, 'Failed to update flight.')
    }
  },
)

export const DELETE = withAuthenticatedRoute(
  async (_request, auth, context: { params: { flightId: string } }) => {
    try {
      const flightId = Number(context.params.flightId)
      if (!Number.isFinite(flightId)) {
        return badRequestJson('A valid flight ID is required.')
      }

      const result = await deleteOwnFlight({
        supabase: auth.supabase,
        userId: auth.user.id,
        flightId,
      })

      return NextResponse.json(result)
    } catch (error: any) {
      return routeErrorJson(error, 'Failed to delete flight.')
    }
  },
)
