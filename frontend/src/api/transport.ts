import type { components } from './schema'

export const ordersBase = '/api/orders/v1'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly requiresSession = false,
  ) {
    super(message)
  }
}

function firstMessage(data: unknown): string | undefined {
  if (typeof data === 'string') return data
  if (Array.isArray(data)) return data.map(firstMessage).find(Boolean)
  if (data && typeof data === 'object') return Object.values(data).map(firstMessage).find(Boolean)
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  requiresSession = false,
): Promise<T> {
  const response = await fetch(path, {
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
      requiresSession,
    )
  }
  return data as T
}

export function serviceApi(base: string, { requiresSession = true } = {}) {
  return {
    read: <T>(path: string) => request<T>(base + path, {}, requiresSession),
    async write<T>(path: string, body?: unknown, method: 'POST' | 'PATCH' | 'PUT' = 'POST') {
      const { csrfToken } = await request<components['schemas']['CsrfResponse']>(
        ordersBase + '/auth/csrf/',
      )
      return request<T>(
        base + path,
        {
          method,
          headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
        requiresSession,
      )
    },
  }
}
