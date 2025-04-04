'use client'

import { createBrowserClient } from '@/utils/supabase'
import { useEffect, useState } from 'react'
import Image from 'next/image'

export default function Questionnaire() {
  const supabase = createBrowserClient()

  const [firstname, setFirstName] = useState('')
  const [lastname, setLastName] = useState('')
  const [school, setSchool] = useState('')
  // const [email, setEmail] = useState('')
  const [phonenumber, setPhoneNumber] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoUrl, setPhotoUrl] = useState('') // Store existing photo URL
  const [instagram, setInstagram] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false) // Check if profile exists in table

  // Fetch user data on mount
  useEffect(() => {
    const fetchUserData = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError || !user) {
        setMessage(
          'You must be logged in to view this page. Please sign in first.',
        )
        setLoading(false)
        return
      }

      console.log('Fetching data for user:', user.id)

      // Get user profile from Supabase
      const { data, error } = await supabase
        .from('Users')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error) {
        console.error('Error fetching user data:', error)
        setMessage(`Please enter your profile information.`)
      } else if (data) {
        console.log('User profile data:', data)

        // Pre-fill form fields
        setFirstName(data.firstname || '')
        setLastName(data.lastname || '')
        setSchool(data.school || '')
        // setEmail(data.email || '')
        setPhoneNumber(data.phonenumber || '')
        setInstagram(data.instagram || '') // Instagram optional
        setPhotoUrl(data.photo_url || '') // Store existing photo URL
        setHasProfile(true)
      }

      setLoading(false)
    }

    fetchUserData()
  }, [])

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhoto(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      setMessage(
        'You must be logged in to submit your profile. Please sign in first.',
      )
      return
    }

    let updatedPhotoUrl = photoUrl // Default to existing photo

    if (photo) {
      const fileName = `${Date.now()}-${photo.name}`
      const { data, error } = await supabase.storage
        .from('profile_picture')
        .upload(fileName, photo)

      if (error) {
        console.error('Storage Upload Error:', error)
        setMessage(
          `We couldn't upload your photo. Please ensure it's a valid image file before trying again.`,
        )
        return
      }

      const { data: urlData } = supabase.storage
        .from('profile_picture')
        .getPublicUrl(fileName)
      updatedPhotoUrl = urlData.publicUrl || ''
    }

    console.log('Submitting Data:', {
      user_id: user.id,
      firstname,
      lastname,
      school,
      phonenumber,
      photo_url: updatedPhotoUrl,
      instagram: instagram || null, // If empty insert null since insta is optional
    })

    const { data, error } = await supabase.from('Users').upsert(
      [
        {
          user_id: user.id,
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
      setMessage(
        `Something went wrong while saving your profile. Please check your details and try again.`,
      )
    } else {
      setMessage(
        hasProfile
          ? 'Profile updated successfully!'
          : 'Profile created successfully!',
      )
      setHasProfile(true)
      setPhotoUrl(updatedPhotoUrl) // Ensure UI updates with new photo
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">
          {hasProfile ? 'Update Profile' : 'Create Profile'}
        </h1>
        <p className="mb-6">
          Please fill out your personal information and preferences below.
        </p>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="w-96 rounded-lg bg-white p-6 shadow-md"
          >
            <label className="mb-2 block">
              First Name:
              <input
                type="text"
                value={firstname}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
                required
              />
            </label>

            <label className="mb-2 block">
              Last Name:
              <input
                type="text"
                value={lastname}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
              />
            </label>

            <label className="mb-2 block">
              School:
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
                required
              >
                <option value="" disabled>
                  Select your school
                </option>
                <option value="Pomona">Pomona</option>
                <option value="Claremont McKenna">Claremont McKenna</option>
                <option value="Harvey Mudd">Harvey Mudd</option>
                <option value="Scripps">Scripps</option>
                <option value="Pitzer">Pitzer</option>
              </select>
            </label>

            {/* <label className="mb-2 block">
              Email:
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
                required
              />
            </label> */}

            <label className="mb-2 block">
              Phone Number:
              <input
                type="text"
                value={phonenumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
                required
              />
            </label>

            <label className="mb-2 block">
              Upload Photo (optional):
              <input
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
              />
              {photoUrl && (
                <Image
                  src={photoUrl}
                  alt="Profile"
                  width={20}
                  height={20}
                  className="mt-2 rounded-full"
                />
              )}
            </label>

            <label className="mb-2 block">
              Instagram (optional):
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                className="mt-1 w-full rounded border bg-white p-2 text-black"
              />
            </label>

            <button
              type="submit"
              className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
            >
              {hasProfile ? 'Update Profile' : 'Create Profile'}
            </button>

            {message && <p className="mt-4 text-center">{message}</p>}
          </form>
        )}
      </div>
    </div>
  )
}
