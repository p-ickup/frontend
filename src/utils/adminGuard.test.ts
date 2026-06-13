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
  createServerClient: (...args: any[]) => createServerClientMock(args[0]),
}))

import { checkAdminAccess } from '@/utils/adminGuard'

const baseUser = {
  id: 'user-1',
  email: 'admin@example.com',
}

const queueProfile = (profile: any, error: any = null) => {
  singleMock.mockResolvedValueOnce({
    data: profile,
    error,
  })
}

describe('adminGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    cookiesMock.mockReturnValue({
      getAll: () => [],
      set: jest.fn(),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('checkAdminAccess returns the user for an admin role', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: baseUser },
      error: null,
    })
    queueProfile({ role: 'admin', admin_scope: 'Pomona' })

    await expect(checkAdminAccess()).resolves.toEqual(baseUser)
    expect(createServerClientMock).toHaveBeenCalled()
    expect(fromMock).toHaveBeenCalledWith('Users')
  })

  it('checkAdminAccess rejects non-admin roles', async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: baseUser },
      error: null,
    })
    queueProfile({ role: 'student', admin_scope: null })

    await expect(checkAdminAccess()).resolves.toBeNull()
  })
})
