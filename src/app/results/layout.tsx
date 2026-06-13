import { AuthHydrator } from '@/providers/AuthProvider'
import { ResultsInitialDataProvider } from '@/providers/InitialPageDataProvider'
import { toResultsResponseDto } from '@/contracts/readModels'
import { getAuthenticatedPagePrincipal } from '@/lib/server/auth'
import { getResultsMatches } from '@/lib/server/studentCommands'
import { redirect } from 'next/navigation'

export default async function ResultsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const principal = await getAuthenticatedPagePrincipal()
  if (!principal) redirect('/?redirectTo=/results')

  const initialData = toResultsResponseDto(
    await getResultsMatches({
      supabase: principal.supabase,
      userId: principal.user.id,
    }),
  )

  return (
    <AuthHydrator user={principal.user} profile={principal.profile}>
      <ResultsInitialDataProvider data={initialData}>
        {children}
      </ResultsInitialDataProvider>
    </AuthHydrator>
  )
}
