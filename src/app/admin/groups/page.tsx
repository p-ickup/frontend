import GroupsManagement from '@/components/admin/GroupsManagement'
import { getAdminPagePrincipal } from '@/lib/server/auth'
import { redirect } from 'next/navigation'

export default async function GroupsPage() {
  const principal = await getAdminPagePrincipal()

  if (!principal) {
    redirect('/')
  }

  return <GroupsManagement user={principal.user} />
}
