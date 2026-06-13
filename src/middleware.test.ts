/** @jest-environment node */

const createMiddlewareClientMock = jest.fn()

jest.mock('@/utils/supabase', () => ({
  createMiddlewareClient: (...args: unknown[]) =>
    createMiddlewareClientMock(...args),
}))

import { middleware } from '@/middleware'
import { NextRequest, NextResponse } from 'next/server'

const createAuthContext = (user: { id: string } | null) => {
  let response = NextResponse.next()

  const getUser = jest.fn().mockImplementation(async () => {
    response = NextResponse.next()
    response.cookies.set('refreshed-session', 'yes', { httpOnly: true })

    return {
      data: { user },
      error: user ? null : new Error('Auth session missing'),
    }
  })

  createMiddlewareClientMock.mockReturnValue({
    supabase: { auth: { getUser } },
    getResponse: () => response,
  })

  return { getUser }
}

describe('middleware authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('does not perform Supabase session work for public routes', async () => {
    const response = await middleware(
      new NextRequest('https://pickup.example/about'),
    )

    expect(response.status).toBe(200)
    expect(createMiddlewareClientMock).not.toHaveBeenCalled()
  })

  it('allows authenticated users to access protected routes', async () => {
    const { getUser } = createAuthContext({ id: 'user-1' })

    const response = await middleware(
      new NextRequest('https://pickup.example/results'),
    )

    expect(response.status).toBe(200)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(response.cookies.get('refreshed-session')?.value).toBe('yes')
  })

  it('redirects unauthenticated users and preserves the requested path', async () => {
    createAuthContext(null)

    const response = await middleware(
      new NextRequest('https://pickup.example/aspc-ready?ride_id=42'),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe(
      'https://pickup.example/?redirectTo=%2Faspc-ready%3Fride_id%3D42',
    )
    expect(response.cookies.get('refreshed-session')?.value).toBe('yes')
  })

  it.each([
    '/profile',
    '/editForm/42',
    '/results',
    '/aspc-delay/42',
    '/admin',
    '/admin/groups',
  ])('rejects a missing session on protected route %s', async (pathname) => {
    const { getUser } = createAuthContext(null)

    const response = await middleware(
      new NextRequest(`https://pickup.example${pathname}`),
    )

    expect(response.status).toBe(307)
    expect(getUser).toHaveBeenCalledTimes(1)
    expect(response.headers.get('location')).toBe(
      `https://pickup.example/?redirectTo=${encodeURIComponent(pathname)}`,
    )
  })

  it('copies cookies from the response replaced during session refresh', async () => {
    createAuthContext(null)

    const response = await middleware(
      new NextRequest('https://pickup.example/profile'),
    )

    expect(response.status).toBe(307)
    expect(response.cookies.get('refreshed-session')).toMatchObject({
      value: 'yes',
      httpOnly: true,
    })
  })

  it('requires authentication for admin pages without replacing role checks', async () => {
    createAuthContext({ id: 'student-1' })

    const response = await middleware(
      new NextRequest('https://pickup.example/admin/groups'),
    )

    expect(response.status).toBe(200)
  })
})
