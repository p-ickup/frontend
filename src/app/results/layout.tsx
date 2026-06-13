import { AuthHydrator } from '@/providers/AuthProvider'
import { getAuthenticatedPagePrincipal } from '@/lib/server/auth'
import { redirect } from 'next/navigation'

export default async function ResultsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const principal = await getAuthenticatedPagePrincipal()
  if (!principal) redirect('/?redirectTo=/results')

  return (
    <AuthHydrator user={principal.user} profile={principal.profile}>
      {children}
    </AuthHydrator>
  )
}
