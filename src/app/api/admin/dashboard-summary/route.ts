import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import { getAdminDashboardSummary } from '@/lib/server/adminDashboard'
import { performanceJson } from '@/lib/server/performanceResponse'

const isDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return (
    !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  )
}

export const GET = withAdminRoute(async (request, auth) => {
  const startedAt = performance.now()
  try {
    const url = new URL(request.url)
    const unmatchedStartDate = url.searchParams.get('unmatchedStart') || ''
    const unmatchedEndDate = url.searchParams.get('unmatchedEnd') || ''

    if (
      !isDate(unmatchedStartDate) ||
      !isDate(unmatchedEndDate) ||
      unmatchedStartDate >= unmatchedEndDate
    ) {
      return badRequestJson('A valid unmatched-flight date range is required.')
    }

    const summary = await getAdminDashboardSummary({
      supabase: auth.supabase,
      profile: auth.profile,
      unmatchedStartDate,
      unmatchedEndDate,
    })

    return performanceJson(summary, startedAt, 'admin_dashboard')
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load the admin dashboard summary.')
  }
})
