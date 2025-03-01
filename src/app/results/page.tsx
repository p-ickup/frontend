import PickupHeader from '@/components/PickupHeader'
import RedirectButton from '@/components/RedirectButton'

export default function Results() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-gray-100 text-black">
      {/* Header at the top */}
      <PickupHeader />
      
      <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
        <h1 className="mb-4 text-3xl font-bold">Results Page</h1>
        <p className="mb-6">Here are your match results</p>

        {/* Button to navigate to Questionnaire */}
        <RedirectButton label="Back" route="/home" />
      </div>
    </div>
  )
}
