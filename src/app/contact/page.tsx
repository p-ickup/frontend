import RedirectButton from '@/components/buttons/RedirectButton'

export default function Contact() {
  return (
    <div className="from-slate-50 relative min-h-screen overflow-hidden bg-gradient-to-br via-blue-50 to-indigo-100">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(14,165,233,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(14,165,233,0.03)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="animate-float absolute left-1/4 top-20 h-16 w-16 rotate-12 rounded-2xl bg-gradient-to-br from-teal-400/20 to-teal-600/20"></div>
        <div
          className="animate-float absolute right-1/3 top-40 h-12 w-12 rounded-full bg-gradient-to-br from-blue-400/20 to-blue-600/20"
          style={{ animationDelay: '1s' }}
        ></div>
        <div
          className="animate-float absolute bottom-40 left-1/3 h-20 w-20 rotate-45 rounded-3xl bg-gradient-to-br from-indigo-400/20 to-indigo-600/20"
          style={{ animationDelay: '2s' }}
        ></div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col items-center justify-center p-6">
        <div className="mx-auto max-w-2xl text-center">
          {/* Header Section */}
          <div className="mb-12">
            <div className="mb-8 inline-flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-teal-500 to-yellow-100 shadow-lg">
              <svg
                className="h-10 w-10 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="mb-6 text-5xl font-bold text-gray-900">
              Contact Us
            </h1>
            <p className="text-xl text-gray-600">
              We&apos;re here to help! Get in touch with our team for support or
              feedback.
            </p>
          </div>

          {/* Contact Options */}
          <div className="rounded-3xl bg-white/80 p-8 shadow-2xl backdrop-blur-sm">
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="mb-4 text-2xl font-semibold text-gray-800">
                  How can we help you?
                </h2>
                <p className="text-gray-600">
                  Choose the option that best fits your needs
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <RedirectButton
                  label="Service Help"
                  route="mailto:pickup.pai.47@gmail.com"
                  color="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  size="px-8 py-4 text-lg font-semibold"
                />
                <RedirectButton
                  label="Share Feedback"
                  route="/feedback"
                  color="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700"
                  size="px-8 py-4 text-lg font-semibold"
                />
              </div>

              <div className="mt-8 rounded-2xl bg-gray-50 p-6">
                <h3 className="mb-3 text-lg font-semibold text-gray-800">
                  Email Support
                </h3>
                <p className="mb-2 text-gray-600">
                  For technical issues or general questions:
                </p>
                <a
                  href="mailto:pickup.pai.47@gmail.com"
                  className="font-medium text-teal-600 hover:text-teal-700"
                >
                  pickup.pai.47@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
