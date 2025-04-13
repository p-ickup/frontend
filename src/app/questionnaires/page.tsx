'use client'

import { useEffect, useState } from 'react'
import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'
import { createBrowserClient } from '@/utils/supabase'
import { useRouter } from 'next/router'
import Image from 'next/image'

interface MatchForm {
  flight_id: string
  flight_no: string
  date: string
}

export default function Questionnaires() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      {/* Reusable Redirect Button */}
      <div className="flex min-h-screen w-full items-center justify-center gap-6 bg-gray-100 text-black">
        <RedirectButton label="Update Profile" route="/profile" />
        <RedirectButton label="Add New Match" route="/matchForm" />
      {/* Header at the top */}
      <PickupHeader />

      {/* Buttons Section */}
      <div className="mt-6 flex flex-col items-center gap-4">
        <div className="flex gap-4">
          <RedirectButton label="Update Profile" route="/profile" />
          <RedirectButton label="Add New Match" route="/matchForm" />
        </div>
      </div>

      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">
          This is where we will display Recent Forms!
        </h1>
      {/* Recent Match Forms */}
      <div className="mt-6 flex w-full flex-col items-center px-4">
        <h1 className="text-2xl font-bold">Recent Match Forms</h1>

        {message && <p className="mb-4 text-red-500">{message}</p>}

        {matchForms.length > 0 ? (
          <ul className="w-96 rounded-lg bg-white p-4 shadow-md">
            {matchForms.map((form) => (
              <li key={form.flight_id} className="relative mb-4 border-b pb-2">
                <p>
                  <strong>Flight Number:</strong> {form.flight_no}
                </p>
                <p>
                  <strong>Date: </strong>
                  <span className="text-lg">
                    {new Date(form.date).toLocaleDateString('en-US')}
                  </span>
                </p>
                {/* Button container aligned to the bottom-right */}
                <div className="mt-[-20px] flex items-center justify-end gap-x-4">
                  <RedirectButton
                    label="Edit"
                    route={`/editForm/${form.flight_id}`}
                    color="bg-yellow-400"
                    size="px-4 py-2 text-lg"
                  />
                  <button
                    onClick={() => handleDelete(form.flight_id)}
                    className="flex items-center justify-center rounded-lg p-2 hover:bg-red-600"
                  >
                    <Image
                      src="/images/trashIcon.webp"
                      alt="Cancel Pending Match Form"
                      width={30}
                      height={30}
                      className="object-contain"
                    />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p>No match forms found.</p>
        )}
      </div>
      <PickupFooter />
    </div>
  )
}
