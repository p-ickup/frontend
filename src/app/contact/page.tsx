import RedirectButton from '@/components/buttons/RedirectButton'

export default function Contact() {
  return (
    <div className="flex min-h-[calc(100vh-165px)] flex-col items-center justify-center bg-gradient-to-r from-teal-200 to-yellow-100 p-20 text-black">
      <h1 className="mb-8 text-5xl">Contact</h1>
      <div className="space-x-6">
        <RedirectButton
          label="Service Help"
          route="mailto:pickup.pai.47@gmail.com"
          color="bg-red-500"
        />
        <RedirectButton
          label="Feedback"
          route="/feedback"
          color="bg-teal-600"
        />
      </div>
    </div>
  )
}
