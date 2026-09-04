/**
 * Defaults to the existing same-origin API. Set `NEXT_PUBLIC_API_BASE_URL` to
 * `http://localhost:3002/api/v1` only when evaluating the isolated MongoDB API.
 */
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api/v1').replace(/\/$/, '')
const TOKEN_KEY = 'storeautohide.token'

/**
 * Public media URL for a storage ref (exe/icon under `STORAGE_DIR`).
 * Same rule as server `mediaUrl` — GET needs no auth (`docs/MINI_APP_DOWNLOAD.md`).
 */
export function mediaUrl(ref: string): string {
  return `${BASE}/media/${ref.split('/').map(encodeURIComponent).join('/')}`
}

/**
 * Download a public media file via fetch → blob → `<a download>`.
 *
 * Direct navigation / `<a href=/api/v1/media/…>` is often blocked by Chrome for
 * `.exe` (Safe Browsing + “insecure download”). A same-origin `blob:` URL with an
 * explicit filename is treated as a user-initiated save and is not.
 */
export async function downloadMedia(
  ref: string,
  filename: string,
): Promise<void> {
  const res = await fetch(mediaUrl(ref))
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      messageFrom(res.status, body),
      codeFrom(body),
    )
  }
  const blob = await res.blob()
  const forced = new Blob([blob], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(forced)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    // Defer revoke so the browser has started the download.
    setTimeout(() => URL.revokeObjectURL(url), 2_000)
  }
}
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

    /**
     * Same as `upload`, but reports `xhr.upload` progress. Path is under `/api/v1`
     * (e.g. `/apps/upload` → `POST /api/v1/apps/upload`).
     */
    uploadWithProgress: <T>(
      path: string,
      form: FormData,
      onProgress?: (pct: number) => void,
    ): Promise<T> =>
      new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', BASE + path)
        const token = read(tokenKey)
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }
        xhr.onload = () => {
          if (xhr.status === 204) {
            resolve(undefined as T)
            return
          }
          const body = (() => {
            try {
              return JSON.parse(xhr.responseText) as unknown
            } catch {
              return null
            }
          })()
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(body as T)
            return
          }
          if (xhr.status === 401 && read(tokenKey)) {
            unauthorized()?.()
          }
          reject(new ApiError(xhr.status, messageFrom(xhr.status, body), codeFrom(body)))
        }
        xhr.onerror = () => reject(new ApiError(0, 'Network error'))
        xhr.send(form)
      }),

    /** Resolves with the response headers, so callers can read flags like X-Export-Truncated. */
    download: async (path: string, fallbackName: string): Promise<Headers> => {
      const res = await fetch(BASE + path, { headers: authHeaders() })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new ApiError(res.status, messageFrom(res.status, body), codeFrom(body))
      }
      // Force a generic binary blob. Keeping the server MIME (or letting Chrome sniff
      // an .exe) triggers Safe Browsing “download blocked”; octet-stream + explicit
      // `download` filename is what Chrome treats as a normal save.
      const raw = await res.blob()
      const blob = new Blob([raw], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      try {
        const a = document.createElement('a')
        a.href = url
        a.download = fallbackName
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        a.remove()
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 2_000)
      }
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
