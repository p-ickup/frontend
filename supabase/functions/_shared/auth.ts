// These functions are internal: they are called by the Next.js admin API routes (which check the
// admin role first), by database triggers and by cron, all with the service role key. The anon
// key is public (it ships in the browser bundle), so it must never be enough to trigger an email.

const encoder = new TextEncoder()

function timingSafeEqual(a: string, b: string): boolean {
  const left = encoder.encode(a)
  const right = encoder.encode(b)
  if (left.length !== right.length) return false
  let diff = 0
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i]
  return diff === 0
}

/** Returns a 401 response unless the request carries the service role key, otherwise null. */
export function requireServiceRole(
  req: Request,
  headers: Record<string, string> = {},
): Response | null {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const token = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )

  if (serviceRoleKey && token && timingSafeEqual(token, serviceRoleKey)) {
    return null
  }

  return new Response(
    JSON.stringify({ success: false, error: 'Unauthorized' }),
    {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    },
  )
}
