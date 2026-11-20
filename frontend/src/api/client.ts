import type { components } from './schema'
import { ApiError, ordersBase, serviceApi } from './transport'

type Schema = components['schemas']
export type User = Schema['User']
export type Meal = Schema['Meal']
export type Order = Schema['Order']
type Registration = Schema['Register']
type OrderInput = Schema['CreateOrder']
type ProfileInput = Schema['PatchedUser']

const { read, write } = serviceApi(ordersBase)
const publicApi = serviceApi(ordersBase, { requiresSession: false })
export const menuKey = ['menu'] as const
export const deliveryWindowKey = ['delivery-window'] as const

export const api = {
  session: async () => {
    try {
      return await read<User>('/auth/me/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  register: (data: Registration) => publicApi.write<User>('/auth/register/', data),
  login: (data: Schema['Login']) => publicApi.write<User>('/auth/login/', data),
  logout: () => publicApi.write<void>('/auth/logout/'),
  saveProfile: (data: ProfileInput) => write<User>('/auth/me/', data, 'PATCH'),
  menu: () => publicApi.read<Meal[]>('/menu/'),
  deliveryWindow: () => publicApi.read<Schema['DeliveryWindow']>('/orders/delivery-window/'),
  orders: (params: URLSearchParams) => read<Schema['PaginatedOrderList']>('/orders/?' + params),
  summary: (params: URLSearchParams) => read<Schema['OrderSummary']>('/orders/summary/?' + params),
  order: (id: string) => read<Order>('/orders/' + encodeURIComponent(id) + '/'),
  submitOrder: (data: OrderInput) => write<Order>('/orders/', data),
  cancelOrder: (id: string) => write<Order>('/orders/' + encodeURIComponent(id) + '/cancel/'),
}
