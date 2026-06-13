/** @jest-environment node */

jest.mock('server-only', () => ({}))

import { performanceJson } from '@/lib/server/performanceResponse'

describe('performanceJson', () => {
  it('returns reproducible duration and payload-size telemetry', async () => {
    const response = performanceJson({ ok: true }, performance.now(), 'test')

    expect(response.headers.get('server-timing')).toMatch(/^test;dur=\d+\.\d$/)
    expect(response.headers.get('x-response-bytes')).toBe('11')
    await expect(response.json()).resolves.toEqual({ ok: true })
  })
})
