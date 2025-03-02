// First, create a separate file for your server actions
// src/app/actions.ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/utils/supabase'

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/login?message=Could not authenticate user')
  }

  return redirect('/')
}

export async function signUp(formData: FormData) {
  const origin = headers().get('origin')
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const phoneNumber = formData.get('phoneNumber') as string
  const school = formData.get('school') as string
  const cookieStore = cookies()
  const supabase = createServerClient(cookieStore)

  // Sign up the user in Supabase Auth
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error) {
    return redirect('/login?message=Could not authenticate user')
  }

  // Get the user ID from the authentication response
  const userId = data?.user?.id
  if (!userId) {
    return redirect('/login?message=User ID not found')
  }

  // Insert user data into the `users` table
  const { error: dbError } = await supabase.from('Users').insert([
    {
      id: userId,
      first_name: firstName,
      last_name: lastName,
      email,
      phone_number: phoneNumber,
      school,
    },
  ])

  if (dbError) {
    return redirect('/login?message=Error storing user data')
  }

  return redirect('/login?message=Check email to continue sign-in process')
}
