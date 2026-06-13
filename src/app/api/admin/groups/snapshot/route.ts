import {
  badRequestJson,
  routeErrorJson,
  withAdminRoute,
} from '@/lib/server/auth'
import {
  fetchGroupsManagementSnapshot,
  fetchLastAlgorithmRunWindow,
  getDefaultDateWindow,
} from '@/components/admin/groups-management/services/groupsReadService'
import { toAdminGroupsSnapshotResponseDto } from '@/contracts/readModels'
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
    const defaults = getDefaultDateWindow()
    const dateRangeStart =
      url.searchParams.get('dateStart') || defaults.dateRangeStart
    const dateRangeEnd =
      url.searchParams.get('dateEnd') || defaults.dateRangeEnd
    const page = Number(url.searchParams.get('page') || 1)
    const pageSize = Number(url.searchParams.get('pageSize') || 200)

    if (
      !isDate(dateRangeStart) ||
      !isDate(dateRangeEnd) ||
      dateRangeStart > dateRangeEnd
    ) {
      return badRequestJson('A valid group date range is required.')
    }
    const windowDays =
      (new Date(`${dateRangeEnd}T00:00:00Z`).getTime() -
        new Date(`${dateRangeStart}T00:00:00Z`).getTime()) /
      86_400_000
    if (windowDays > 366) {
      return badRequestJson('The group date range cannot exceed 366 days.')
    }
    if (!Number.isInteger(page) || page < 1) {
      return badRequestJson('Page must be a positive integer.')
    }
    if (!Number.isInteger(pageSize) || pageSize < 25 || pageSize > 200) {
      return badRequestJson('Page size must be between 25 and 200.')
    }

    const [snapshot, algorithmWindow] = await Promise.all([
      fetchGroupsManagementSnapshot({
        supabase: auth.supabase,
        adminScope: auth.profile.admin_scope || null,
        dateRangeStart,
        dateRangeEnd,
        page,
        pageSize,
      }),
      fetchLastAlgorithmRunWindow(auth.supabase),
    ])

    return performanceJson(
      toAdminGroupsSnapshotResponseDto({
        ...snapshot,
        dateRangeStart,
        dateRangeEnd,
        lastAlgorithmRunDate: algorithmWindow?.lastAlgorithmRunDate || '',
      }),
      startedAt,
      'admin_groups',
    )
  } catch (error: any) {
    return routeErrorJson(error, 'Failed to load groups management data.')
  }
})
