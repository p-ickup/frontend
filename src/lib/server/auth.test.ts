/** @jest-environment node */

jest.mock('server-only', () => ({}))

const cookiesMock = jest.fn()
const getUserMock = jest.fn()
const singleMock = jest.fn()
const eqMock = jest.fn(() => ({ single: singleMock }))
const selectMock = jest.fn(() => ({ eq: eqMock }))
const fromMock = jest.fn(() => ({ select: selectMock }))
const createServerClientMock = jest.fn((_cookieStore?: unknown) => ({
  auth: {
    getUser: getUserMock,
  },
  from: fromMock,
}))

jest.mock('next/headers', () => ({
  cookies: () => cookiesMock(),
}))

jest.mock('@/utils/supabase', () => ({
  createServerClient: (...args: unknown[]) => createServerClientMock(args[0]),
}))

import {
  getAdminPagePrincipal,
  withAdminRoute,
  withAuthenticatedRoute,
} from '@/lib/server/auth'

const baseUser = {
  id: 'user-1',
  email: 'admin@example.com',
}

const queueUser = (user: typeof baseUser | null, error: unknown = null) => {
  getUserMock.mockResolvedValueOnce({
    data: { user },
    error,
  })
}

const queueProfile = (profile: unknown, error: unknown = null) => {
  singleMock.mockResolvedValueOnce({
    data: profile,
    error,
  })
}

describe('server authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    cookiesMock.mockReturnValue({
      getAll: () => [],
      set: jest.fn(),
    })
  })

  it('uses the same admin authorization for server-rendered pages', async () => {
    const profile = { role: 'admin', admin_scope: 'Pomona' }
    queueUser(baseUser)
    queueProfile(profile)

    await expect(getAdminPagePrincipal()).resolves.toEqual({
      user: baseUser,
      profile,
    })
  })

  it('returns no page principal when the role is not authorized', async () => {
    queueUser(baseUser)
    queueProfile({ role: 'student', admin_scope: null })

    await expect(getAdminPagePrincipal()).resolves.toBeNull()
  })

  it('blocks an authenticated wrapper before invoking its handler', async () => {
    queueUser(null)
    const handler = jest.fn()
    const route = withAuthenticatedRoute(handler)

    const response = await route(
      new Request('https://pickup.example/api/test'),
      {},
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('treats a failed session validation as unauthenticated', async () => {
    queueUser(baseUser, new Error('Invalid session'))
    const handler = jest.fn()
    const route = withAuthenticatedRoute(handler)

    const response = await route(
      new Request('https://pickup.example/api/test'),
      {},
    )

    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })

  it('injects an authenticated principal into a wrapped handler', async () => {
    queueUser(baseUser)
    const handler = jest.fn((_request, auth) =>
      Response.json({ userId: auth.user.id }),
    )
    const route = withAuthenticatedRoute(handler)

    const response = await route(
      new Request('https://pickup.example/api/test'),
      {},
    )

    await expect(response.json()).resolves.toEqual({ userId: baseUser.id })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('blocks an admin wrapper before invoking its handler', async () => {
    queueUser(baseUser)
    queueProfile({ role: 'student', admin_scope: null })
    const handler = jest.fn()
    const route = withAdminRoute(handler)

    const response = await route(
      new Request('https://pickup.example/api/admin'),
      {},
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Forbidden' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('returns 401 for an admin route with no validated session', async () => {
    queueUser(null, new Error('Auth session missing'))
    const handler = jest.fn()
    const route = withAdminRoute(handler)

    const response = await route(
      new Request('https://pickup.example/api/admin'),
      {},
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' })
    expect(handler).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it.each(['admin', 'super_admin'])(
    'injects the %s profile into a wrapped handler',
    async (role) => {
      const profile = { role, admin_scope: 'Pomona' }
      queueUser(baseUser)
      queueProfile(profile)
      const handler = jest.fn((_request, auth) =>
        Response.json({ role: auth.profile.role }),
      )
      const route = withAdminRoute(handler)

      const response = await route(
        new Request('https://pickup.example/api/admin'),
        {},
      )

      await expect(response.json()).resolves.toEqual({ role })
      expect(handler).toHaveBeenCalledTimes(1)
    },
  )
})
