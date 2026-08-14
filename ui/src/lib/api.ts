/** Thin fetch wrapper for the store API: bearer token in, typed JSON out.
 *
 * Requests go to `/api/v1/...`; Vite proxies that to the FastAPI dev server, so there is
 * no CORS setup and no base URL to configure in development. */

const BASE = '/api/v1'
const TOKEN_KEY = 'storeautohide.token'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Mã lỗi ổn định do API trả về — dùng để tra bản dịch (`errors.<code>`). */
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getToken(): string | null {
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

/** FastAPI errors are `{detail}` — a string, or a list of validation problems. */
function messageFrom(status: number, body: unknown): string {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    const first = detail[0] as { loc?: unknown[]; msg?: string } | undefined
    if (first?.msg) return `${first.loc?.slice(1).join('.') ?? ''} ${first.msg}`.trim()
  }
  return `Lỗi ${status}`
}

function codeFrom(body: unknown): string | undefined {
  const code = (body as { code?: unknown } | null)?.code
  return typeof code === 'string' ? code : undefined
}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, messageFrom(res.status, body), codeFrom(body))
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

  patch: <T>(path: string, body: unknown): Promise<T> =>
    request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),

  /** Multipart upload — the browser sets the boundary, so no Content-Type here. */
  upload: <T>(path: string, form: FormData): Promise<T> =>
    request<T>(path, { method: 'POST', body: form }),

  /** Fetch a file with auth and hand it to the browser as a download. */
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
    a.download = filenameFrom(res.headers.get('Content-Disposition')) ?? fallbackName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}

function filenameFrom(disposition: string | null): string | null {
  const match = disposition?.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i)
  return match ? decodeURIComponent(match[1]) : null
}
