import { useQuery } from '@tanstack/react-query'
import { api, type User } from './api/client'

export const sessionKey = ['session'] as const
export const useSession = () =>
  useQuery({ queryKey: sessionKey, queryFn: api.session, staleTime: 30_000 })

export function isManagement(user: User | null | undefined) {
  return user?.role === 'manager' || user?.role === 'admin'
}

export const roleLabel: Record<User['role'], string> = {
  customer: 'Klient',
  warehouse: 'Magazynier',
  kitchen: 'Kuchnia',
  driver: 'Kierowca',
  manager: 'Menedżer',
  admin: 'Administrator',
}
