import { GeistSans } from 'geist/font/sans'
import ThemeProvider from '@/providers/ThemeProvider'
import NextTopLoader from 'nextjs-toploader'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import ReactQueryProvider from '@/providers/ReactQueryProvider'
import PickupHeader from '@/components/PickupHeader'
import PickupFooter from '@/components/PickupFooter'

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : 'http://localhost:3000'

export const metadata = {
  metadataBase: new URL(defaultUrl),
  title: 'PICKUP',
  description: 'Your AI powered RideShare App',
  icons: {
    icon: [{ url: '/favicon.ico?v=2', sizes: 'any' }],
    shortcut: '/favicon.ico?v=2',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={GeistSans.className} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground">
        <NextTopLoader showSpinner={false} height={2} color="#2acf80" />
        <ThemeProvider attribute="class" enableSystem disableTransitionOnChange>
          <ReactQueryProvider>
            <div className="flex min-h-screen flex-col">
              <PickupHeader />
              <div className="flex-1">{children}</div>
              <PickupFooter />
              <Analytics />
            </div>
            <ReactQueryDevtools initialIsOpen={false} />
          </ReactQueryProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
