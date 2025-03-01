import RedirectButton from '@/app/components/RedirectButton'

export default function Questionnaire() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
      <h1 className="mb-4 text-3xl font-bold">Questionnaire</h1>
      <p className="mb-6">This is the questionnaire page.</p>

      {/* Button to navigate to Questionnaire */}
      <RedirectButton label="Back" route="/home" />
    </div>
  )
}
