import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'

export default function Questionnaires() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      {/* Header at the top */}
      <PickupHeader />

      {/* Reusable Redirect Button */}
      <div className="flex min-h-screen w-full items-center justify-center gap-6 bg-gray-100 text-black">
        <RedirectButton label="Update Profile" route="/profile" />
        <RedirectButton label="Add New Match" route="/matchForm" />
      </div>

      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">
          This is where we will display Recent Forms!
        </h1>
      </div>
    </div>
  )
}
