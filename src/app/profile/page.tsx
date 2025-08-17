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
          ? 'Profile updated! \n Any profile picture changes will appear upon refresh.'
          : 'Profile created!',
      )
      setHasProfile(true)
      setPhotoUrl(updatedPhotoUrl)
      // Update the avatar URL in the header immediately
      updateAvatarUrl(updatedPhotoUrl)
      setPhoto(null) // Clear the file input
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <div className="flex min-h-screen w-full flex-col items-center justify-center">
        <h1 className="mb-4 text-3xl font-bold">
          {loading ? '' : hasProfile ? 'Update Profile' : 'Create Profile'}
        </h1>
        <p className="mb-6">
          {loading ? '' : 'Please fill out your personal information below.'}
        </p>

        {loading ? (
          <div className="flex items-center justify-center bg-blue-50 p-4">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <span className="ml-2 text-teal-600">Loading Profile...</span>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="w-96 rounded-lg bg-white p-6 shadow-md"
          >
            <label className="mb-2 block">
              <span className="font-bold after:ml-1 after:text-red-600 after:content-['*']">
                First Name
              </span>
              <input
                type="text"
                value={firstname}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded border p-2"
                required
              />
            </label>

            <label className="mb-2 block">
              <span className="font-bold after:ml-1 after:text-red-600 after:content-['*']">
                Last Name
              </span>
              <input
                type="text"
                value={lastname}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded border p-2"
                required
              />
            </label>

            <label className="mb-2 block">
              <span className="font-bold after:ml-1 after:text-red-600 after:content-['*']">
                School
              </span>
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="mt-1 w-full rounded border p-2"
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

            <label className="mb-2 block">
              <span className="font-bold after:ml-1 after:text-red-600 after:content-['*']">
                Phone Number
              </span>
              <input
                type="text"
                value={phonenumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 w-full rounded border p-2"
                required
              />
            </label>

            <label className="mb-2 block">
              <span
                className={`font-bold after:ml-1 after:text-red-600 ${
                  !hasGooglePhoto ? "after:content-['*']" : ''
                }`}
              >
                Profile Picture
              </span>
              <input
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
                onChange={handlePhotoChange}
                className="mt-1 w-full rounded border p-2"
                required={!hasGooglePhoto}
              />
              <FileUploadInfo
                acceptedFormats={['PNG', 'JPG', 'HEIC']}
                maxSize="5MB"
                className="mt-1"
              />
              {(photoUrl || photo) && (
                <div className="mt-2 flex items-center gap-2">
                  <img
                    src={photo ? URL.createObjectURL(photo) : photoUrl}
                    alt="Profile"
                    width={50}
                    height={50}
                    className="rounded-full"
                  />
                  <div className="flex flex-col gap-1">
                    {photo && (
                      <span className="text-xs text-green-600">
                        ✓ New image selected
                      </span>
                    )}
                    {photoUrl && !photo && (
                      <span className="text-xs text-gray-600">
                        Current photo will be replaced
                      </span>
                    )}
                  </div>
                </div>
              )}
            </label>

            <label className="mb-2 block font-bold">
              Instagram
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="mt-1 w-full rounded border p-2"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded bg-teal-500 p-2 text-white hover:bg-teal-600"
            >
              {loading
                ? 'Loading...'
                : hasProfile
                  ? 'Update Profile'
                  : 'Create Profile'}
            </button>

            {message && <p className="mt-4 text-center">{message}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
