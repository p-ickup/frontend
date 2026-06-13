'use client'

import { getSafeReturnPath } from '@/config/routeAccess'
import type { AuthProfile } from '@/types/auth'
import { createBrowserClient } from '@/utils/supabase'
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

interface AuthState {
  user: User | null
  profile: AuthProfile | null
  avatarUrl: string | null
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean
  isAdmin: boolean
  signInWithGoogle: () => Promise<AuthActionResult>
  signOut: () => Promise<AuthActionResult>
  refreshProfile: () => Promise<AuthProfile | null>
  refreshAvatarUrl: () => Promise<string | null>
  updateAvatarUrl: (newUrl: string | null) => void
  hydrateAuth: (user: User, profile: AuthProfile | null) => void
}

interface AuthActionResult {
  error: unknown | null
  success?: true
}

const AuthContext = createContext<AuthContextValue | null>(null)

const getProviderAvatarUrl = (user: User | null) => {
  if (!user) return null

  return (
    user.user_metadata?.avatar_url ||
    user.identities?.[0]?.identity_data?.avatar_url ||
    user.user_metadata?.picture ||
    null
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createBrowserClient(), [])
  const hydratedRef = useRef(false)
  const currentUserIdRef = useRef<string | null>(null)
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    avatarUrl: null,
    isLoading: true,
  })

  const fetchProfile = useCallback(
    async (user: User): Promise<AuthProfile | null> => {
      const { data, error } = await supabase
        .from('Users')
        .select('role, admin_scope, school, photo_url')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user profile:', error)
        return null
      }

      return data as AuthProfile | null
    },
    [supabase],
  )

  const applyUser = useCallback(
    async (user: User | null) => {
      currentUserIdRef.current = user?.id || null

      if (!user) {
        setAuthState({
          user: null,
          profile: null,
          avatarUrl: null,
          isLoading: false,
        })
        return
      }

      const userId = user.id
      setAuthState((current) => ({
        ...current,
        user,
        avatarUrl: current.avatarUrl || getProviderAvatarUrl(user),
      }))

      const profile = await fetchProfile(user)
      if (currentUserIdRef.current !== userId) return

      setAuthState({
        user,
        profile,
        avatarUrl: profile?.photo_url || getProviderAvatarUrl(user),
        isLoading: false,
      })
    },
    [fetchProfile],
  )

  const hydrateAuth = useCallback((user: User, profile: AuthProfile | null) => {
    hydratedRef.current = true
    currentUserIdRef.current = user.id
    setAuthState({
      user,
      profile,
      avatarUrl: profile?.photo_url || getProviderAvatarUrl(user),
      isLoading: false,
    })
  }, [])

  useEffect(() => {
    let active = true
    let subscription: { unsubscribe: () => void } | undefined

    const initialize = async () => {
      if (!hydratedRef.current) {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser()

        if (!active) return

        if (error) {
          if (error.message !== 'Auth session missing!') {
            console.error('Error fetching user:', error)
          }
          await applyUser(null)
        } else {
          await applyUser(user)
        }
      }

      if (!active) return

      const { data: listener } = supabase.auth.onAuthStateChange(
        (event: AuthChangeEvent, session: Session | null) => {
          const nextUser = session?.user || null
          const sameUser = nextUser?.id === currentUserIdRef.current

          if (event === 'INITIAL_SESSION' && sameUser) return
          if (event === 'TOKEN_REFRESHED' && sameUser) return

          void applyUser(nextUser)
        },
      )
      subscription = listener.subscription
    }

    void initialize()

    return () => {
      active = false
      subscription?.unsubscribe()
    }
  }, [applyUser, supabase])

  const signInWithGoogle = useCallback(async () => {
    const isLocalHost = ['localhost', '0.0.0.0', '127.0.0.1'].includes(
      window.location.hostname,
    )
    const callbackOrigin = window.location.origin
    const callbackUrl = isLocalHost
      ? `${callbackOrigin}/auth/callback`
      : process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL ||
        `${callbackOrigin}/auth/callback`
    const requestedReturnPath = getSafeReturnPath(
      new URLSearchParams(window.location.search).get('redirectTo'),
    )
    const callbackWithReturnPath = new URL(callbackUrl, callbackOrigin)

    if (requestedReturnPath) {
      callbackWithReturnPath.searchParams.set('redirectTo', requestedReturnPath)
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackWithReturnPath.toString() },
    })

    if (error) {
      console.error('Google login error:', error)
      return { error }
    }

    return { error: null, success: true as const }
  }, [supabase])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return { error }
    }

    await applyUser(null)
    return { error: null, success: true as const }
  }, [applyUser, supabase])

  const refreshProfile = useCallback(async () => {
    if (!authState.user) return null

    const profile = await fetchProfile(authState.user)
    setAuthState((current) => ({
      ...current,
      profile,
      avatarUrl: profile?.photo_url || getProviderAvatarUrl(current.user),
    }))
    return profile
  }, [authState.user, fetchProfile])

  const refreshAvatarUrl = useCallback(async () => {
    const profile = await refreshProfile()
    return profile?.photo_url || getProviderAvatarUrl(authState.user)
  }, [authState.user, refreshProfile])

  const updateAvatarUrl = useCallback((newUrl: string | null) => {
    setAuthState((current) => ({
      ...current,
      avatarUrl: newUrl || getProviderAvatarUrl(current.user),
      profile: current.profile
        ? { ...current.profile, photo_url: newUrl }
        : current.profile,
    }))
  }, [])

  const normalizedRole = authState.profile?.role?.toLowerCase()
  const value = useMemo<AuthContextValue>(
    () => ({
      ...authState,
      isAuthenticated: Boolean(authState.user),
      isAdmin: normalizedRole === 'admin' || normalizedRole === 'super_admin',
      signInWithGoogle,
      signOut,
      refreshProfile,
      refreshAvatarUrl,
      updateAvatarUrl,
      hydrateAuth,
    }),
    [
      authState,
      hydrateAuth,
      normalizedRole,
      refreshAvatarUrl,
      refreshProfile,
      signInWithGoogle,
      signOut,
      updateAvatarUrl,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function AuthHydrator({
  user,
  profile,
  children,
}: {
  user: User
  profile: AuthProfile | null
  children: React.ReactNode
}) {
  const { hydrateAuth } = useAuthContext()

  useLayoutEffect(() => {
    hydrateAuth(user, profile)
  }, [hydrateAuth, profile, user])

  return children
}

export function useAuthContext() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
