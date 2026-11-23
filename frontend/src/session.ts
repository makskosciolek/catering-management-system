import { useQuery } from '@tanstack/react-query'
import { api, type User } from './api/client'

export const sessionKey = ['session'] as const
export const ordersKey = ['private', 'orders'] as const
export const orderDetailKey = (userId: string | undefined, id: string) =>
  [...ordersKey, 'detail', userId, id] as const
export const useSession = () =>
  useQuery({ queryKey: sessionKey, queryFn: api.session, staleTime: 30_000 })

export function isManagement(user: User | null | undefined) {
  return user?.role === 'manager' || user?.role === 'admin'
}

export function canViewOrders(user: User | null | undefined) {
  return isManagement(user) || user?.role === 'customer'
}

export function canViewWarehouse(user: User | null | undefined) {
  return isManagement(user) || user?.role === 'warehouse'
}

export function homeFor(user: User | null | undefined) {
  if (user?.role === 'warehouse') return '/warehouse'
  return isManagement(user) ? '/orders' : '/menu'
}

export const roleLabel: Record<User['role'], string> = {
  customer: 'Klient',
  warehouse: 'Magazynier',
  kitchen: 'Kuchnia',
  driver: 'Kierowca',
  manager: 'Menedżer',
  admin: 'Administrator',
}
