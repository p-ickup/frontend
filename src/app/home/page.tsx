import RedirectButton from '@/app/components/RedirectButton'

export default function Home() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-gray-100 text-black">
      <h1 className="mb-4 text-3xl font-bold">Welcome to the Home Page</h1>
      <p className="mb-6">This is the Home page.</p>

      {/* Reusable Redirect Button */}
      <RedirectButton label="Go to Questionnaire" route="/questionnaire" />
    </div>
  )
}
