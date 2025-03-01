import RedirectButton from '@/components/RedirectButton'
import PickupHeader from '@/components/PickupHeader'

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      {/* Header at the top */}
      <PickupHeader />

      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Welcome to the Home Page</h1>
        <p className="mb-6">About P-ickup</p>

        {/* Reusable Redirect Button */}
        <RedirectButton label="Click Here to Start" route="/questionnaire" />
      </div>
    </div>
  )
}
