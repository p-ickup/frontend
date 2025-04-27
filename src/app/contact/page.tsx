import RedirectButton from "@/components/buttons/RedirectButton"

export default function Contact() {
    return (
        <div className="min-h-[calc(100vh-165px)] text-black p-20 flex justify-center items-center flex-col bg-gradient-to-r from-teal-200 to-yellow-100">
            <h1 className="text-5xl mb-8">Contact</h1>
            <div className="space-x-6">
                <RedirectButton label="Service Help" route="mailto:pickup.pai.47@gmail.com" color="bg-red-500" />
                <RedirectButton label="Feedback" route="/feedback" color="bg-teal-600" />
            </div>
        </div>
    )
}