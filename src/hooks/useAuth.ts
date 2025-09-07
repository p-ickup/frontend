import { useState, useEffect, useRef } from 'react'
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
  const customAvatarCheckedRef = useRef(false)

  const supabase = createClientComponentClient()

  // Extract avatar URL from user data (synchronous for initial auth)
  const extractAvatarUrl = (userData: User | null) => {
    if (!userData) return null

    // Use Google profile picture for initial auth state
    return (
      userData.user_metadata?.avatar_url ||
      userData.identities?.[0]?.identity_data?.avatar_url ||
      userData.user_metadata?.picture
    )
  }

  // Check for custom profile picture (async, used for refresh)
  const getCustomAvatarUrl = async (userData: User | null) => {
    if (!userData) return null

    try {
      const { data: userProfile } = await supabase
        .from('Users')
        .select('photo_url')
        .eq('user_id', userData.id)
        .single()

      if (userProfile?.photo_url) {
        return userProfile.photo_url
      }
    } catch (error) {
      // User profile doesn't exist yet or no custom photo, fall back to Google avatar
    }

    // Always return Google avatar as fallback
    return extractAvatarUrl(userData)
  }

  // Update auth state with user data
  const updateUserState = (userData: User | null) => {
    const avatarUrl = extractAvatarUrl(userData)
    setAuthState({
      user: userData,
      avatarUrl,
      isLoading: false,
    })
    // Reset custom avatar check for new user
    customAvatarCheckedRef.current = false
  }

  useEffect(() => {
    // Check current auth state on mount
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser()

      if (error) {
        // Don't log errors for missing sessions (normal during logout)
        if (error.message !== 'Auth session missing!') {
          console.error('Error fetching user:', error)
        }
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

  // Check for custom profile picture after auth state is set
  useEffect(() => {
    if (
      authState.user &&
      !authState.isLoading &&
      !customAvatarCheckedRef.current
    ) {
      const checkCustomAvatar = async () => {
        const customAvatarUrl = await getCustomAvatarUrl(authState.user)
        if (customAvatarUrl !== authState.avatarUrl) {
          setAuthState((prev) => ({ ...prev, avatarUrl: customAvatarUrl }))
        }
        customAvatarCheckedRef.current = true
      }
      checkCustomAvatar()
    }
  }, [authState.user, authState.isLoading])

  // Login with Google
  const signInWithGoogle = async () => {
    // Use the current domain for the callback URL
    const callbackUrl =
      process.env.NEXT_PUBLIC_AUTH_CALLBACK_URL ||
      `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
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

  // Refresh avatar URL (useful after profile updates)
  const refreshAvatarUrl = async () => {
    if (authState.user) {
      const newAvatarUrl = await getCustomAvatarUrl(authState.user)
      setAuthState((prev) => ({ ...prev, avatarUrl: newAvatarUrl }))
      return newAvatarUrl
    }
    return null
  }

  // Force refresh avatar URL with a specific URL
  const updateAvatarUrl = (newUrl: string | null) => {
    setAuthState((prev) => ({ ...prev, avatarUrl: newUrl }))
    customAvatarCheckedRef.current = true // Mark as checked since we're setting it manually
  }

  return {
    user: authState.user,
    avatarUrl: authState.avatarUrl,
    isLoading: authState.isLoading,
    isAuthenticated: !!authState.user,
    signInWithGoogle,
    signOut,
    refreshAvatarUrl,
    updateAvatarUrl,
  }
}
