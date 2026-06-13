import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import {
  getAdminCancellations,
  getAdminNoShows,
} from '@/lib/server/adminReports'
import { NextResponse } from 'next/server'

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

export const GET = withAdminRoute(async (request, auth) => {
  try {
    const url = new URL(request.url)
    const kind = url.searchParams.get('kind')
    const startDate = url.searchParams.get('start') || ''
    const endDate = url.searchParams.get('end') || ''
    if (!isDate(startDate) || !isDate(endDate) || startDate > endDate) {
      return badRequestJson('A valid report date range is required.')
    }

    if (kind === 'cancellations') {
      return NextResponse.json({
        rows: await getAdminCancellations({
          supabase: auth.supabase,
          startDate,
          endDate,
        }),
      })
    }
    if (kind === 'no-shows') {
      return NextResponse.json({
        rows: await getAdminNoShows({
          supabase: auth.supabase,
          startDate,
          endDate,
        }),
      })
    }
    return badRequestJson('Unsupported admin report.')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load admin report.')
  }
})
