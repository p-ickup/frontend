'use client'

import { createBrowserClient } from '@/utils/supabase'
import { useState } from 'react'

export default function Questionnaire() {
  const supabase = createBrowserClient()

  const [firstname, setFirstName] = useState('')
  const [lastname, setLastName] = useState('')
  const [school, setSchool] = useState('')
  const [email, setEmail] = useState('')
  const [phonenumber, setPhoneNumber] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [instagram, setInstagram] = useState('')
  const [feedback, setFeedback] = useState('')
  const [message, setMessage] = useState('')

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhoto(e.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!firstname || !lastname || !school || !email || !phonenumber) {
      setMessage('Missing information!')
      return
    }
    let photoUrl = ''
    // ✅ Upload image to Supabase Storage if a file was selected
    if (photo) {
      const fileName = `${Date.now()}-${photo.name}`
      const { data, error } = await supabase.storage
        .from('questionnaire-uploads')
        .upload(fileName, photo)

      if (error) {
        setMessage(`Error uploading image: ${error.message}`)
        return
      }

      // ✅ Get the public URL of the uploaded image
      photoUrl = supabase.storage
        .from('questionnaire-uploads')
        .getPublicUrl(fileName).data.publicUrl
    }

    const { data, error } = await supabase
      .from('questionnaire')
      .insert([
        {
          firstname,
          lastname,
          school,
          email,
          phonenumber,
          photo_url: photoUrl,
          instagram,
          feedback,
        },
      ])

    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('✅ Data submitted successfully!')
      setFirstName('')
      setLastName('')
      setSchool('')
      setEmail('')
      setPhoneNumber('')
      setPhoto(null)
      setInstagram('')
      setFeedback('')
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
      <h1 className="mb-4 text-3xl font-bold">Questionnaire</h1>
      <p className="mb-6">Fill out the form below to submit your feedback.</p>

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

        <label className="mb-2 block">
          Email:
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border bg-white p-2 text-black"
            required
          />
        </label>

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
        </label>

        <label className="mb-2 block">
          Instagram (optional):
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            className="mt-1 w-full rounded border bg-white p-2 text-black"
            required
          />
        </label>

        <label className="mb-4 block">
          Feedback (optional):
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="mt-1 w-full rounded border bg-white p-2 text-black"
          />
        </label>

        <button
          type="submit"
          className="w-full rounded bg-blue-600 p-2 text-white hover:bg-blue-700"
        >
          Submit
        </button>

        {message && <p className="mt-4 text-center">{message}</p>}
      </form>
    </div>
  )
}
