'use client'

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function Login({
  searchParams,
}: {
  searchParams: { message: string }
}) {
  const supabase = createClientComponentClient()
  const router = useRouter()
  const { user, signInWithGoogle } = useAuth()
  if (user) router.push('/')

  return (
    <div className="mx-96 mt-5 flex flex-col justify-center  gap-2 px-8">
      <Link href="/" className=" flex gap-4 py-2 text-sm">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        Go Back
      </Link>

      {/* Sign-In Form for Email/Password */}
      <form
        className="flex w-full flex-col gap-2 animate-in"
        action="/api/auth/signin"
        method="POST"
      >
        <label htmlFor="email">Email</label>
        <input
          name="email"
          type="email"
          placeholder="you@example.com"
          required
          className="mb-2 border px-4 py-2"
        />

        <label htmlFor="password">Password</label>
        <input
          name="password"
          type="password"
          placeholder="••••••••"
          required
          className="mb-2 border px-4 py-2"
        />

        <button
          type="submit"
          className="mb-2 rounded-md bg-green-700 px-4 py-2 text-white"
        >
          Sign In/Register
        </button>
      </form>

      {/* Google Sign-In Button */}
      <button
        type="button"
        onClick={signInWithGoogle}
        className="flex items-center justify-center rounded-md border bg-white px-4 py-2 text-black"
      >
        <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48">
          <path
            fill="#4285F4"
            d="M24 9.5c3.41 0 6.44 1.19 8.86 3.12l6.58-6.59C34.89 2.23 29.76 0 24 0 14.54 0 6.6 5.86 3.06 14.31l7.91 6.14C13.01 13.73 18.1 9.5 24 9.5z"
          ></path>
          <path
            fill="#34A853"
            d="M46.5 24.42c0-1.55-.14-3.06-.4-4.42H24v8.34h12.91c-.58 3.16-2.18 5.79-4.53 7.57l7.32 5.66c4.27-3.94 6.8-9.73 6.8-16.15z"
          ></path>
          <path
            fill="#FBBC05"
            d="M10.86 28.49C9.92 26.08 9.5 23.61 9.5 21s.42-5.08 1.36-7.49L3 7.37C.97 11.33 0 16 0 21s.97 9.67 3 13.63l7.86-6.14z"
          ></path>
          <path
            fill="#EA4335"
            d="M24 48c6.48 0 11.91-2.14 15.88-5.81l-7.32-5.66c-2.03 1.38-4.61 2.24-7.56 2.24-5.89 0-10.88-4.23-12.7-9.92l-7.91 6.14C6.6 42.14 14.54 48 24 48z"
          ></path>
        </svg>
        Sign in with Google
      </button>

      {/* Display Messages */}
      {/* {searchParams?.message && (
        <p className="mt-4 p-4 text-center">{searchParams.message}</p>
      )} */}
    </div>
  )
}
