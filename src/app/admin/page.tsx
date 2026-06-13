import AdminDashboard from '@/components/admin/AdminDashboard'
import { getAdminPagePrincipal } from '@/lib/server/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const principal = await getAdminPagePrincipal()

  if (!principal) {
    redirect('/')
  }

  return <AdminDashboard user={principal.user} />
}
