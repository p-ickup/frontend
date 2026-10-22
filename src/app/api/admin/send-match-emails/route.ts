import { internalErrorJson, withAdminRoute } from '@/lib/server/auth'
import { relayEdgeFunction } from '@/lib/server/edgeFunctions'

export const POST = withAdminRoute(async (request) => {
  try {
    const body = await request.json().catch(() => ({}))
    return await relayEdgeFunction('send-all-match-emails-batch', body)
  } catch (error: any) {
    return internalErrorJson(
      error?.message || 'Failed to send match emails.',
      error?.details,
    )
  }
})
