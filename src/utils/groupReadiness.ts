/**
 * Shared logic for determining if a ride group is "ready" for pickup.
 * A group is ready when every member is accounted for: either they confirmed
 * they're at the pickup location, or someone reported them as missing.
 */
export function isGroupReady(
  matches: {
    user_id: string
    ready_for_pickup_at: string | null
    reported_missing_user_ids: string[] | null
  }[],
): boolean {
  if (matches.length === 0) return false
  const accountedFor = new Set<string>()
  for (const m of matches) {
    if (m.ready_for_pickup_at) accountedFor.add(m.user_id)
    for (const id of m.reported_missing_user_ids || []) {
      accountedFor.add(id)
    }
  }
  return matches.every((m) => accountedFor.has(m.user_id))
}
