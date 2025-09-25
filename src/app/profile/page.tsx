'use client'

import { createBrowserClient } from '@/utils/supabase'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import {
  validateImage,
  compressImage,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE,
} from '@/utils/imageUtils'
import { useAuth } from '@/hooks/useAuth'
import { FileUploadInfo } from '@/components/ui/file-upload-info'

export default function Questionnaire() {
  const supabase = createBrowserClient()
  const { updateAvatarUrl } = useAuth()

  const [firstname, setFirstName] = useState('')
  const [lastname, setLastName] = useState('')
  const [school, setSchool] = useState('')
  const [phonenumber, setPhoneNumber] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [instagram, setInstagram] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [hasGooglePhoto, setHasGooglePhoto] = useState(false)

  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setMessage('Error: You must be logged in to fetch data!')
        setLoading(false)
        return
      }

      // Check if user has a Google profile picture
      const googlePhotoUrl =
        user.user_metadata?.avatar_url ||
        user.identities?.[0]?.identity_data?.avatar_url ||
        user.user_metadata?.picture
      setHasGooglePhoto(!!googlePhotoUrl)

      const { data, error } = await supabase
        .from('Users')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        setMessage('Please enter your profile information.')
        console.error('Error fetching user data:', error)
      } else if (data) {
        setFirstName(data.firstname || '')
        setLastName(data.lastname || '')
        setSchool(data.school || '')
        setPhoneNumber(data.phonenumber || '')
        setInstagram(data.instagram || '')
        setPhotoUrl(data.photo_url || '')
        setHasProfile(true)
      }

      setLoading(false)
    }

    fetchUserData()
  }, [])

  // Delete old profile picture from storage
  const deleteOldPhoto = async (photoUrl: string) => {
    if (!photoUrl || !photoUrl.includes('supabase.co')) return

    try {
      // Extract filename from URL - handle Supabase storage URL format
      let fileName = ''

      // Handle URL format: https://.../storage/v1/object/public/profile_picture/filename
      if (photoUrl.includes('/storage/v1/object/public/profile_picture/')) {
        fileName = photoUrl.split(
          '/storage/v1/object/public/profile_picture/',
        )[1]
      } else if (photoUrl.includes('/profile_picture/')) {
        // Alternative format: https://.../profile_picture/filename
        fileName = photoUrl.split('/profile_picture/')[1]
      } else {
        // Fallback: extract last part of URL
        const urlParts = photoUrl.split('/')
        fileName = urlParts[urlParts.length - 1]
      }

      // Remove query parameters if present
      fileName = fileName.split('?')[0]

      if (fileName) {
        const { error } = await supabase.storage
          .from('profile_picture')
          .remove([fileName])

        if (error) {
          console.error('Storage deletion error:', error)
        }
      }
    } catch (error) {
      console.error('Error deleting old photo:', error)
      // Don't fail the upload if deletion fails
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const validation = validateImage(file)

      if (!validation.isValid) {
        setMessage(validation.error || 'Invalid image file')
        return
      }

      setPhoto(file)
      setMessage('') // Clear any previous error messages
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setMessage('You must be logged in to submit your profile.')
      return
    }
    // Basic US phone number regex: allows (123) 456-7890, 123-456-7890, 1234567890, etc.
    const phoneRegex = /^\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}$/

    if (!phoneRegex.test(phonenumber)) {
      setMessage('Please enter a valid phone number.')
      return
    }

    // Check if profile picture is required (only if no Google photo and no custom photo)
    if (!photo && !photoUrl && !hasGooglePhoto) {
      setMessage(
        'Profile picture is required. Please upload an image or use your Google profile picture.',
      )
      return
    }

    let updatedPhotoUrl = photoUrl

    if (photo) {
      try {
        // Always delete old photo if it exists (replace functionality)
        if (photoUrl) {
          await deleteOldPhoto(photoUrl)
        }

        // Compress and upload new photo
        const compressedPhoto = await compressImage(photo)
        const fileName = `${Date.now()}-${compressedPhoto.name}`

        const { data, error } = await supabase.storage
          .from('profile_picture')
          .upload(fileName, compressedPhoto)

        if (error) {
          setMessage('Failed to upload your photo. Please try again.')
          console.error('Storage Upload Error:', error)
          return
        }

        const { data: urlData } = supabase.storage
          .from('profile_picture')
          .getPublicUrl(fileName)
        updatedPhotoUrl = urlData.publicUrl || ''

        // Force a cache-busting parameter to ensure immediate update
        updatedPhotoUrl = `${updatedPhotoUrl}?t=${Date.now()}`
      } catch (error) {
        setMessage('Failed to process your image. Please try again.')
        console.error('Image processing error:', error)
        return
      }
    }

    const { data, error } = await supabase.from('Users').upsert(
      [
        {
          user_id: user.id,
          email: user.email, // ✅ Automatically pulled from Supabase Auth
          firstname,
          lastname,
          school,
          phonenumber,
          photo_url: updatedPhotoUrl,
          instagram: instagram || null,
        },
      ],
      { onConflict: 'user_id' },
    )

    if (error) {
      setMessage('Something went wrong. Please try again.')
    } else {
      setMessage(
        hasProfile
          ? '✅ Profile updated successfully!'
          : //  \n Any profile picture changes will appear upon refresh.
            '✅ Profile created successfully!',
      )
      setHasProfile(true)
      setPhotoUrl(updatedPhotoUrl)
      // Update the avatar URL in the header immediately
      updateAvatarUrl(updatedPhotoUrl)
      setPhoto(null) // Clear the file input
    }
  }

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div
          className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="animate-float absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      <div className="relative flex min-h-screen w-full items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          {/* Header Section */}
          <div className="mb-4 text-center md:mb-8">
            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg md:mb-6 md:h-20 md:w-20">
              <svg
                className="h-8 w-8 text-white md:h-10 md:w-10"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-gray-900 md:mb-4 md:text-4xl">
              {loading ? '' : hasProfile ? 'Update Profile' : 'Create Profile'}
            </h1>
            <p className="text-lg text-gray-600 md:text-xl">
              {loading
                ? ''
                : 'Please fill out your personal information below.'}
            </p>
          </div>

          {/* Form Container - Hidden on mobile, shown on desktop */}
          {loading ? (
            <div className="flex items-center justify-center rounded-2xl bg-white/80 p-8 shadow-xl backdrop-blur-sm">
              <div className="flex items-center space-x-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-200 border-t-teal-500"></div>
                <span className="text-lg font-medium text-gray-700">
                  Loading Profile...
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Desktop Form Container */}
              <div className="hidden rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm md:block">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        First Name
                      </span>
                      <input
                        type="text"
                        value={firstname}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="Enter your first name"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        Last Name
                      </span>
                      <input
                        type="text"
                        value={lastname}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="Enter your last name"
                        required
                      />
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                      School
                    </span>
                    <select
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      required
                    >
                      <option value="" disabled>
                        Select your school
                      </option>
                      <option value="Pomona">Pomona College</option>
                      <option value="Claremont McKenna">
                        Claremont McKenna College
                      </option>
                      <option value="Harvey Mudd">Harvey Mudd College</option>
                      <option value="Scripps">Scripps College</option>
                      <option value="Pitzer">Pitzer College</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                      Phone Number
                    </span>
                    <input
                      type="text"
                      value={phonenumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="(123) 456-7890"
                      required
                    />
                  </label>

                  {/* <label className="block">
                    <span
                      className={`mb-2 block text-sm font-semibold text-gray-700 ${
                        !hasGooglePhoto
                          ? "after:ml-1 after:text-red-500 after:content-['*']"
                          : ''
                      }`}
                    >
                      Profile Picture
                    </span>
                    <div className="space-y-3">
                      <input
                        type="file"
                        accept={ALLOWED_IMAGE_TYPES.join(',')}
                        onChange={handlePhotoChange}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        required={!hasGooglePhoto}
                      />
                      <FileUploadInfo
                        acceptedFormats={['PNG', 'JPG', 'HEIC']}
                        maxSize="5MB"
                        className="text-xs text-gray-500"
                      />
                      {(photoUrl || photo) && (
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                          <Image
                            src={photo ? URL.createObjectURL(photo) : photoUrl}
                            alt="Profile"
                            width={60}
                            height={60}
                            className="rounded-full border-2 border-white shadow-md"
                          />
                          <div className="flex flex-col">
                            {photo && (
                              <span className="text-sm font-medium text-green-600">
                                ✓ New image selected
                              </span>
                            )}
                            {photoUrl && !photo && (
                              <span className="text-sm text-gray-600">
                                Current photo will be replaced
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </label> */}

                  {/* <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-gray-700">
                      Instagram (Optional)
                    </span>
                    <input
                      type="text"
                      value={instagram}
                      onChange={(e) => setInstagram(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                      placeholder="@yourusername"
                    />
                  </label> */}

                  <div className="pt-4">
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 p-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-teal-600 hover:to-teal-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                          <span>Processing...</span>
                        </div>
                      ) : hasProfile ? (
                        'Update Profile'
                      ) : (
                        'Create Profile'
                      )}
                    </button>

                    {message && (
                      <div
                        className={`mt-4 rounded-xl p-4 text-center ${
                          message.includes('✅') ||
                          message.includes('successfully')
                            ? 'border border-green-200 bg-green-50 text-green-700'
                            : 'border border-red-200 bg-red-50 text-red-700'
                        }`}
                      >
                        <p className="font-medium">{message}</p>
                      </div>
                    )}
                  </div>
                </form>
              </div>

              {/* Mobile Form - No container, simpler */}
              <div className="block md:hidden">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        First Name
                      </span>
                      <input
                        type="text"
                        value={firstname}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="Enter your first name"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        Last Name
                      </span>
                      <input
                        type="text"
                        value={lastname}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="Enter your last name"
                        required
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        School
                      </span>
                      <select
                        value={school}
                        onChange={(e) => setSchool(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        required
                      >
                        <option value="" disabled>
                          Select your school
                        </option>
                        <option value="Pomona">Pomona College</option>
                        <option value="Claremont McKenna">
                          Claremont McKenna College
                        </option>
                        <option value="Harvey Mudd">Harvey Mudd College</option>
                        <option value="Scripps">Scripps College</option>
                        <option value="Pitzer">Pitzer College</option>
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700 after:ml-1 after:text-red-500 after:content-['*']">
                        Phone Number
                      </span>
                      <input
                        type="text"
                        value={phonenumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="(123) 456-7890"
                        required
                      />
                    </label>

                    {/* <label className="block">
                      <span
                        className={`mb-2 block text-sm font-semibold text-gray-700 ${
                          !hasGooglePhoto
                            ? "after:ml-1 after:text-red-500 after:content-['*']"
                            : ''
                        }`}
                      >
                        Profile Picture
                      </span>
                      <div className="space-y-3">
                        <input
                          type="file"
                          accept={ALLOWED_IMAGE_TYPES.join(',')}
                          onChange={handlePhotoChange}
                          className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          required={!hasGooglePhoto}
                        />
                        <FileUploadInfo
                          acceptedFormats={['PNG', 'JPG', 'HEIC']}
                          maxSize="5MB"
                          className="text-xs text-gray-500"
                        />
                        {(photoUrl || photo) && (
                          <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                            <Image
                              src={
                                photo ? URL.createObjectURL(photo) : photoUrl
                              }
                              alt="Profile"
                              width={60}
                              height={60}
                              className="rounded-full border-2 border-white shadow-md"
                            />
                            <div className="flex flex-col">
                              {photo && (
                                <span className="text-sm font-medium text-green-600">
                                  ✓ New image selected
                                </span>
                              )}
                              {photoUrl && !photo && (
                                <span className="text-sm text-gray-600">
                                  Current photo will be replaced
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </label> */}

                    {/* <label className="block">
                      <span className="mb-2 block text-sm font-semibold text-gray-700">
                        Instagram (Optional)
                      </span>
                      <input
                        type="text"
                        value={instagram}
                        onChange={(e) => setInstagram(e.target.value)}
                        className="w-full rounded-xl border border-gray-300 bg-white/50 p-3 text-gray-900 placeholder-gray-500 transition-all duration-200 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                        placeholder="@yourusername"
                      />
                    </label> */}

                    <div className="pt-4">
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-gradient-to-r from-teal-500 to-teal-600 p-4 text-lg font-semibold text-white shadow-lg transition-all duration-200 hover:scale-[1.02] hover:from-teal-600 hover:to-teal-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50"
                      >
                        {loading ? (
                          <div className="flex items-center justify-center space-x-2">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span>Processing...</span>
                          </div>
                        ) : hasProfile ? (
                          'Update Profile'
                        ) : (
                          'Create Profile'
                        )}
                      </button>

                      {message && (
                        <div
                          className={`mt-4 rounded-xl p-4 text-center ${
                            message.includes('✅') ||
                            message.includes('successfully')
                              ? 'border border-green-200 bg-green-50 text-green-700'
                              : 'border border-red-200 bg-red-50 text-red-700'
                          }`}
                        >
                          <p className="font-medium">{message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
