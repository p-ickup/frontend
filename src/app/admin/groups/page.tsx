import GroupsManagement from '@/components/admin/GroupsManagement'
import { checkAdminAccess } from '@/utils/adminGuard'
import { redirect } from 'next/navigation'

export default async function GroupsPage() {
  // Check admin access - redirects if not admin
  const user = await checkAdminAccess()

  if (!user) {
    redirect('/')
  }

  // User is authenticated and has admin privileges
  return <GroupsManagement user={user} />
}
