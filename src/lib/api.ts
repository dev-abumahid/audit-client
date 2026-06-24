const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: 'include', // sends the httpOnly access_token cookie
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })

  if (res.status === 401) {
    // Let AuthContext handle the redirect — just throw so callers know
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(res.status, body.message ?? `HTTP ${res.status}`)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  const json = await res.json()
  // Server wraps everything in { success, message, data }
  return (json.data ?? json) as T
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export { ApiError }
