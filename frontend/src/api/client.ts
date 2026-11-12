import type { components } from './schema'

type Schema = components['schemas']
export type User = Schema['User']
export type Meal = Schema['Meal']
export type Order = Schema['Order']
type Registration = Schema['Register']
type OrderInput = Schema['CreateOrder']
type ProfileInput = Schema['PatchedUser']

const base = '/api/orders/v1'

class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

function firstMessage(data: unknown): string | undefined {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(firstMessage).find(Boolean)
  if (data && typeof data === 'object') return Object.values(data).map(firstMessage).find(Boolean)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(base + path, {
    credentials: 'same-origin',
    cache: 'no-store',
    ...options,
  }).catch(() => {
    throw new ApiError(0, 'Nie udało się połączyć z aplikacją. Spróbuj ponownie.')
  })
  if (response.status === 204) return undefined as T
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok || data === null) {
    const message =
      response.status >= 500
        ? 'Aplikacja jest chwilowo niedostępna. Spróbuj ponownie.'
        : (firstMessage(data) ?? 'Nie udało się wykonać operacji.')
    throw new ApiError(
      response.status,
      message.startsWith('CSRF') ? 'Sesja formularza wygasła. Spróbuj ponownie.' : message,
    )
  }
  return data as T
}

async function change<T>(path: string, body?: unknown, method: 'POST' | 'PATCH' = 'POST') {
  const { csrfToken } = await request<Schema['CsrfResponse']>('/auth/csrf/')
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

export const api = {
  session: async () => {
    try {
      return await request<User>('/auth/me/')
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  register: (data: Registration) => change<User>('/auth/register/', data),
  login: (data: Schema['Login']) => change<User>('/auth/login/', data),
  logout: () => change<void>('/auth/logout/'),
  saveProfile: (data: ProfileInput) => change<User>('/auth/me/', data, 'PATCH'),
  menu: () => request<Meal[]>('/menu/'),
  orders: (params: URLSearchParams) => request<Schema['PaginatedOrderList']>('/orders/?' + params),
  summary: (params: URLSearchParams) =>
    request<Schema['OrderSummary']>('/orders/summary/?' + params),
  order: (id: string) => request<Order>('/orders/' + encodeURIComponent(id) + '/'),
  submitOrder: (data: OrderInput) => change<Order>('/orders/', data),
}
