import { createBrowserClient } from '@/utils/supabase'

export interface ProfileValidationResult {
  isValid: boolean
  missingFields: string[]
  message: string
  hasCompleteProfile: boolean
}

export const validateUserProfile =
  async (): Promise<ProfileValidationResult> => {
    const supabase = createBrowserClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return {
        isValid: false,
        missingFields: ['authentication'],
        message: 'You must be logged in to use this feature.',
        hasCompleteProfile: false,
      }
    }

    // Check if user has a profile in the Users table
    const { data: userProfile, error: profileError } = await supabase
      .from('Users')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileError || !userProfile) {
      return {
        isValid: false,
        missingFields: ['profile'],
        message: 'Please complete your profile before using this feature.',
        hasCompleteProfile: false,
      }
    }

    const missingFields: string[] = []

    // Check required profile fields
    if (!userProfile.firstname) missingFields.push('first name')
    if (!userProfile.lastname) missingFields.push('last name')
    if (!userProfile.school) missingFields.push('school')
    if (!userProfile.phonenumber) missingFields.push('phone number')

    // Check for profile picture (custom or Google)
    const hasCustomPhoto = !!userProfile.photo_url
    const hasGooglePhoto = !!(
      user.user_metadata?.avatar_url ||
      user.identities?.[0]?.identity_data?.avatar_url ||
      user.user_metadata?.picture
    )

    if (!hasCustomPhoto && !hasGooglePhoto) {
      missingFields.push('profile picture')
    }

    if (missingFields.length > 0) {
      return {
        isValid: false,
        missingFields,
        message:
          missingFields.length > 3
            ? `Please complete your profile.`
            : `Please complete your profile: ${missingFields.join(', ')}.`,
        hasCompleteProfile: false,
      }
    }

    return {
      isValid: true,
      missingFields: [],
      message: 'Profile is complete.',
      hasCompleteProfile: true,
    }
  }

// Helper function to get profile completion status
export const getProfileCompletionStatus =
  async (): Promise<ProfileValidationResult> => {
    return await validateUserProfile()
  }
