import { AuthHydrator } from '@/providers/AuthProvider'
import { UnmatchedInitialDataProvider } from '@/providers/InitialPageDataProvider'
import { toUnmatchedOptionsResponseDto } from '@/contracts/readModels'
import { getAuthenticatedPagePrincipal } from '@/lib/server/auth'
import { getUnmatchedOptions } from '@/lib/server/studentCommands'
import { createServiceRoleClient } from '@/lib/server/serviceRole'
import { redirect } from 'next/navigation'

export default async function UnmatchedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const principal = await getAuthenticatedPagePrincipal()
  if (!principal) redirect('/?redirectTo=/unmatched')

  const initialData = toUnmatchedOptionsResponseDto(
    await getUnmatchedOptions({
      supabase: createServiceRoleClient(),
      userId: principal.user.id,
    }),
  )

  return (
    <AuthHydrator user={principal.user} profile={principal.profile}>
      <UnmatchedInitialDataProvider data={initialData}>
        {children}
      </UnmatchedInitialDataProvider>
    </AuthHydrator>
  )
}
