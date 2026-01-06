import AdminDashboard from '@/components/admin/AdminDashboard'
import { checkAdminAccess } from '@/utils/adminGuard'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  // Check admin access - redirects if not admin
  // Logging happens in checkAdminAccess function
  const user = await checkAdminAccess()

  if (!user) {
    redirect('/')
  }

  // User is authenticated and has admin privileges
  return <AdminDashboard user={user} />
}
