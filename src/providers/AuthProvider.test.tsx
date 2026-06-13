import { act, render, screen, waitFor } from '@testing-library/react'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'

const getUserMock = jest.fn()
const onAuthStateChangeMock = jest.fn()
const signInWithOAuthMock = jest.fn()
const signOutMock = jest.fn()
const fromMock = jest.fn()
const unsubscribeMock = jest.fn()

jest.mock('@/utils/supabase', () => ({
  createBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      onAuthStateChange: (...args: unknown[]) => onAuthStateChangeMock(...args),
      signInWithOAuth: (...args: unknown[]) => signInWithOAuthMock(...args),
      signOut: (...args: unknown[]) => signOutMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  }),
}))

import {
  AuthHydrator,
  AuthProvider,
  useAuthContext,
} from '@/providers/AuthProvider'

const authUser = {
  id: 'user-1',
  email: 'student@example.com',
  user_metadata: { avatar_url: 'https://example.com/google-avatar.png' },
} as User

const authProfile = {
  role: 'admin',
  admin_scope: 'Pomona',
  school: 'Pomona',
  photo_url: 'https://example.com/custom-avatar.png',
}

const profileQuery = () => {
  const builder = {
    select: jest.fn(() => builder),
    eq: jest.fn(() => builder),
    maybeSingle: jest.fn().mockResolvedValue({
      data: authProfile,
      error: null,
    }),
  }
  return builder
}

function AuthProbe({ name }: { name: string }) {
  const {
    user,
    profile,
    avatarUrl,
    isLoading,
    isAdmin,
    refreshProfile,
    updateAvatarUrl,
  } = useAuthContext()

  return (
    <div>
      <span data-testid={`${name}-user`}>{user?.id || 'none'}</span>
      <span data-testid={`${name}-school`}>{profile?.school || 'none'}</span>
      <span data-testid={`${name}-avatar`}>{avatarUrl || 'none'}</span>
      <span data-testid={`${name}-loading`}>{String(isLoading)}</span>
      <span data-testid={`${name}-admin`}>{String(isAdmin)}</span>
      <button onClick={() => updateAvatarUrl('/updated-avatar.webp')}>
        Update avatar
      </button>
      <button onClick={() => void refreshProfile()}>Refresh profile</button>
    </div>
  )
}

describe('AuthProvider', () => {
  let authChangeHandler: (
    event: AuthChangeEvent,
    session: Session | null,
  ) => void

  beforeEach(() => {
    jest.clearAllMocks()
    getUserMock.mockResolvedValue({
      data: { user: authUser },
      error: null,
    })
    fromMock.mockImplementation(() => profileQuery())
    onAuthStateChangeMock.mockImplementation((handler) => {
      authChangeHandler = handler
      return { data: { subscription: { unsubscribe: unsubscribeMock } } }
    })
    signInWithOAuthMock.mockResolvedValue({ error: null })
    signOutMock.mockResolvedValue({ error: null })
  })

  it('initializes auth and profile once for multiple consumers', async () => {
    render(
      <AuthProvider>
        <AuthProbe name="first" />
        <AuthProbe name="second" />
      </AuthProvider>,
    )

    expect(await screen.findByTestId('first-school')).toHaveTextContent(
      'Pomona',
    )
    await waitFor(() =>
      expect(screen.getByTestId('first-loading')).toHaveTextContent('false'),
    )

    expect(getUserMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('Users')
    expect(screen.getByTestId('second-user')).toHaveTextContent('user-1')
    expect(screen.getByTestId('first-admin')).toHaveTextContent('true')
  })

  it('uses a server principal without repeating client auth or profile reads', async () => {
    render(
      <AuthProvider>
        <AuthHydrator user={authUser} profile={authProfile}>
          <AuthProbe name="hydrated" />
        </AuthHydrator>
      </AuthProvider>,
    )

    expect(await screen.findByTestId('hydrated-user')).toHaveTextContent(
      'user-1',
    )
    expect(screen.getByTestId('hydrated-school')).toHaveTextContent('Pomona')
    expect(getUserMock).not.toHaveBeenCalled()
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('preserves session-change and immediate avatar-update behavior', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null }, error: null })

    render(
      <AuthProvider>
        <AuthProbe name="session" />
      </AuthProvider>,
    )

    await waitFor(() => expect(onAuthStateChangeMock).toHaveBeenCalledTimes(1))

    await act(async () => {
      authChangeHandler('SIGNED_IN', { user: authUser } as Session)
    })

    expect(await screen.findByTestId('session-user')).toHaveTextContent(
      'user-1',
    )
    expect(fromMock).toHaveBeenCalledTimes(1)

    const buttons = screen.getAllByRole('button', { name: 'Update avatar' })
    await act(async () => buttons[0].click())
    expect(screen.getByTestId('session-avatar')).toHaveTextContent(
      '/updated-avatar.webp',
    )

    await act(async () => {
      authChangeHandler('SIGNED_OUT', null)
    })
    expect(screen.getByTestId('session-user')).toHaveTextContent('none')
  })

  it('refreshes all shared profile fields after a profile update', async () => {
    const updatedProfile = {
      ...authProfile,
      school: 'Scripps',
      photo_url: '/new-profile.webp',
    }
    fromMock
      .mockImplementationOnce(() => profileQuery())
      .mockImplementationOnce(() => {
        const builder = profileQuery()
        builder.maybeSingle.mockResolvedValue({
          data: updatedProfile,
          error: null,
        })
        return builder
      })

    render(
      <AuthProvider>
        <AuthProbe name="refresh" />
      </AuthProvider>,
    )

    expect(await screen.findByTestId('refresh-school')).toHaveTextContent(
      'Pomona',
    )
    const refreshButton = screen.getByRole('button', {
      name: 'Refresh profile',
    })

    await act(async () => refreshButton.click())

    expect(screen.getByTestId('refresh-school')).toHaveTextContent('Scripps')
    expect(screen.getByTestId('refresh-avatar')).toHaveTextContent(
      '/new-profile.webp',
    )
    expect(fromMock).toHaveBeenCalledTimes(2)
  })
})
