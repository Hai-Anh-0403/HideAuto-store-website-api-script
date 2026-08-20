const BASE = '/api/v1'
const TOKEN_KEY = 'storeautohide.token'
/**
 * The admin console keeps its own token.
 *
 * Sellers and admins are two identity systems on the server, and a shared slot would mean
 * signing into the portal silently signed you out of the review queue (and vice versa).
 */
const ADMIN_TOKEN_KEY = 'storeautohide.admin_token'

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

function read(key: string): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(key)
}

function write(key: string, token: string | null): void {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(key, token)
  else localStorage.removeItem(key)
}

export function getToken(): string | null {
  return read(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  write(TOKEN_KEY, token)
}

export function getAdminToken(): string | null {
  return read(ADMIN_TOKEN_KEY)
}

export function setAdminToken(token: string | null): void {
  write(ADMIN_TOKEN_KEY, token)
}

let onUnauthorized: (() => void) | null = null
let onAdminUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler
}

/** The admin console's own 401 hook — its token lives in a different slot. */
export function setAdminUnauthorizedHandler(handler: (() => void) | null): void {
  onAdminUnauthorized = handler
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

interface ClientOptions {
  tokenKey: string
  /** Which 401 hook this client fires — the two identities sign out independently. */
  unauthorized: () => (() => void) | null
}

function makeClient({ tokenKey, unauthorized }: ClientOptions) {
  const authHeaders = (): HeadersInit => {
    const token = read(tokenKey)
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function handle<T>(res: Response): Promise<T> {
    if (res.status === 204) return undefined as T
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      if (res.status === 401 && read(tokenKey)) {
        unauthorized()?.()
      }
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

  return {
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

    /** Resolves with the response headers, so callers can read flags like X-Export-Truncated. */
    download: async (path: string, fallbackName: string): Promise<Headers> => {
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
      return res.headers
    },
  }
}

export const api = makeClient({
  tokenKey: TOKEN_KEY,
  unauthorized: () => onUnauthorized,
})

export const adminApi = makeClient({
  tokenKey: ADMIN_TOKEN_KEY,
  unauthorized: () => onAdminUnauthorized,
})
