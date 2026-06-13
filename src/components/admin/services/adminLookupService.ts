import { requestJson } from '@/utils/api'

export interface AdminLookupUser {
  user_id: string
  firstname: string
  lastname: string
  school: string
  email: string
  phonenumber: string
}

export interface AdminContact {
  user_id: string
  email: string | null
  phonenumber: string | null
}

export const fetchAdminSchools = async () =>
  requestJson<{ schools: string[] }>('/api/admin/lookup?kind=schools')

export const fetchAdminUsers = async (school: string) =>
  requestJson<{ users: AdminLookupUser[] }>(
    `/api/admin/lookup?kind=users&school=${encodeURIComponent(school)}`,
  )

export const checkAdminFlightExists = async ({
  userId,
  flightNo,
  date,
}: {
  userId: string
  flightNo: string
  date: string
}) =>
  requestJson<{ exists: boolean }>(
    `/api/admin/lookup?kind=flight-exists&userId=${encodeURIComponent(userId)}&flightNo=${encodeURIComponent(flightNo)}&date=${encodeURIComponent(date)}`,
  )

export const fetchAdminContacts = async (userIds: string[]) => {
  const params = new URLSearchParams({ kind: 'contacts' })
  Array.from(new Set(userIds)).forEach((userId) =>
    params.append('userId', userId),
  )
  return requestJson<{ contacts: AdminContact[] }>(
    `/api/admin/lookup?${params.toString()}`,
  )
}
