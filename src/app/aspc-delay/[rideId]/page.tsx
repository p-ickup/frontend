'use client'

import { useParams } from 'next/navigation'
import RedirectButton from '@/components/buttons/RedirectButton'

export default function AspcDelayPage() {
  const params = useParams()
  const rideId = params.rideId as string

  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
      <div className="relative mx-auto max-w-2xl px-4 py-6 sm:py-12">
        <div className="rounded-2xl bg-white/80 p-4 shadow-xl backdrop-blur-sm sm:p-8">
          <h1 className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">
            Report a delay
          </h1>

          {/* Empty form placeholder */}
          <div className="mb-6 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center">
            <p className="text-sm text-gray-500">Form coming soon</p>
          </div>

          <div className="mt-8">
            <RedirectButton label="Back to Results" route="/results" />
          </div>
        </div>
      </div>
    </div>
  )
}
