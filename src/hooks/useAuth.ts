import { useState, useEffect } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  avatarUrl: string | null
  isLoading: boolean
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    avatarUrl: null,
    isLoading: true,
  })

  const supabase = createClientComponentClient()

  // Extract avatar URL from user data
  const extractAvatarUrl = (userData: User | null) => {
    if (!userData) return null

    return (
      userData.user_metadata?.avatar_url ||
      userData.identities?.[0]?.identity_data?.avatar_url ||
      userData.user_metadata?.picture
    )
  }

  // Update auth state with user data
  const updateUserState = (userData: User | null) => {
    setAuthState({
      user: userData,
      avatarUrl: extractAvatarUrl(userData),
      isLoading: false,
    })
  }

  useEffect(() => {
    // Check current auth state on mount
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        console.error('Error fetching user:', error)
        setAuthState((prev) => ({ ...prev, isLoading: false }))
        return
      }

      updateUserState(data?.user)
    }

    fetchUser()

    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        updateUserState(session?.user || null)
      },
    )

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [supabase.auth])

  // Login with Google
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo:
          process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL ||
          (process.env.NODE_ENV === 'production'
            ? 'https://p-ickup.com/auth/callback'
            : `${window.location.origin}/auth/callback`),
      },
    })

    if (error) {
      console.error('Google login error:', error)
      return { error }
    }

    return { success: true }
  }

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('Logout error:', error)
      return { error }
    }

    return { success: true }
  }

  return {
    user: authState.user,
    avatarUrl: authState.avatarUrl,
    isLoading: authState.isLoading,
    isAuthenticated: !!authState.user,
    signInWithGoogle,
    signOut,
  }
}
