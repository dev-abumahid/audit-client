// Shared response envelope for aexa-server's REST endpoints. Every
// controller responds through manage_response.ts's manageResponse(), which
// always sends exactly { success, message, data, meta } — see
// aexa-server/src/app/utils/manage_response.ts. Endpoint-specific types
// should wrap their payload in one of these rather than re-declaring the
// envelope shape inline.

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPage: number
}

// Single-resource responses (get-by-id, create, update, delete). Real
// `meta` on these is `{}` (see manageResponse's `payload.meta || undefined`)
// — callers of single-resource endpoints don't read it, so it's omitted
// here rather than typed as an always-empty object.
export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

// List/paginated responses (get-all).
export interface PaginatedApiResponse<T> {
  success: boolean
  message: string
  data: T[]
  meta: PaginationMeta
}
