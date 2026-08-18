const BASE = '/api/v1'
const TOKEN_KEY = 'storeautohide.token'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

function messageFrom(status: number, body: unknown): string {
  const detail = body as { detail?: unknown; message?: unknown } | null
  if (typeof detail?.message === 'string') return detail.message
  if (typeof detail?.detail === 'string') return detail.detail
  return `Error ${status}`
}

function codeFrom(body: unknown): string | undefined {
  const code = (body as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401 && getToken()) onUnauthorized?.()
    throw new ApiError(res.status, messageFrom(res.status, body), codeFrom(body))
  }
  return body as T
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers ?? {}) },
  })
  return handle<T>(res)
}

export const api = {
  get: <T>(path: string): Promise<T> => request<T>(path),

  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),

  del: (path: string): Promise<void> => request<void>(path, { method: 'DELETE' }),

  upload: <T>(path: string, form: FormData): Promise<T> =>
    request<T>(path, { method: 'POST', body: form }),

  download: async (path: string, fallbackName: string): Promise<void> => {
    const res = await fetch(BASE + path, { headers: authHeaders() })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      throw new ApiError(res.status, messageFrom(res.status, body), codeFrom(body))
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fallbackName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
