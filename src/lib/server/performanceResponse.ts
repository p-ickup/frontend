import 'server-only'

import { NextResponse } from 'next/server'

export const performanceJson = (
  payload: unknown,
  startedAt: number,
  metric = 'app',
) => {
  const body = JSON.stringify(payload)
  const durationMs = Math.max(0, performance.now() - startedAt)

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'application/json',
      'Server-Timing': `${metric};dur=${durationMs.toFixed(1)}`,
      'X-Response-Bytes': String(new TextEncoder().encode(body).byteLength),
    },
  })
}
