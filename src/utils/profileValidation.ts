import { createBrowserClient } from '@/utils/supabase'
import type { User } from '@supabase/supabase-js'
import { toProfileCompletenessDto } from '@/contracts/readModels'

export interface ProfileValidationResult {
  isValid: boolean
  missingFields: string[]
  message: string
  hasCompleteProfile: boolean
}

const hasRequiredProfileValue = (value: unknown) =>
  typeof value === 'string' && value.trim() !== '' && value.trim() !== 'Unknown'

export const validateUserProfile = async (
  user: User | null,
): Promise<ProfileValidationResult> => {
  const supabase = createBrowserClient()

  if (!user) {
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
    .select('firstname, lastname, school, email, phonenumber')
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

  const profile = toProfileCompletenessDto(userProfile)
  const missingFields: string[] = []

  // Check required profile fields
  if (!hasRequiredProfileValue(profile.firstname))
    missingFields.push('first name')
  if (!hasRequiredProfileValue(profile.lastname))
    missingFields.push('last name')
  if (!hasRequiredProfileValue(profile.school)) missingFields.push('school')
  if (!hasRequiredProfileValue(profile.email)) missingFields.push('email')
  if (!hasRequiredProfileValue(profile.phonenumber))
    missingFields.push('phone number')

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
