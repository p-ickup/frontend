import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import {
  fetchChangeLogEntries,
  fetchPendingChangesSnapshot,
} from '@/components/admin/groups-management/services/groupsReadService'
import { NextResponse } from 'next/server'

export const GET = withAdminRoute(async (request, auth) => {
  try {
    const url = new URL(request.url)
    if (url.searchParams.get('kind') !== 'changelog') {
      return badRequestJson('Unsupported secondary panel.')
    }
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('pageSize') || 100)
    if (!Number.isInteger(page) || page < 1 || pageSize < 1 || pageSize > 100) {
      return badRequestJson('Invalid changelog page.')
    }
    return NextResponse.json(
      await fetchChangeLogEntries(auth.supabase, { page, pageSize }),
    )
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load changelog.')
  }
})

export const POST = withAdminRoute(async (request, auth) => {
  try {
    const body = await request.json()
    if (body?.kind !== 'pending' || !Array.isArray(body.groups)) {
      return badRequestJson('Groups are required for pending changes.')
    }
    return NextResponse.json(
      await fetchPendingChangesSnapshot({
        supabase: auth.supabase,
        groups: body.groups,
      }),
    )
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load pending changes.')
  }
})
