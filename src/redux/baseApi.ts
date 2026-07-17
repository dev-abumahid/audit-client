import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { removeUser } from "./slices/user.slice"

// Exported so anything building a full-page-redirect URL (e.g.
// SocialLoginButtons' OAuth links, which can't go through RTK Query since
// they need a real browser navigation) reads the exact same value
// fetchBaseQuery uses below, instead of re-reading the env var independently
// and risking drift if this ever changes.
export const SERVER_BASE_URL = import.meta.env.VITE_SERVER_BASE_URL as string

const rawBaseQuery = fetchBaseQuery({
  baseUrl: SERVER_BASE_URL,
  credentials: "include",
})

// Auth endpoints (sign-in, sign-up, OTP, password reset, etc.) can return a
// 401 as a normal, recoverable outcome (e.g. wrong credentials) — callers
// handle that inline (see SignInModal.tsx). The global logout/redirect below
// is only for an authenticated session going invalid mid-use, so requests
// under /auth/* are excluded from it.
const isAuthEndpoint = (args: string | FetchArgs): boolean => {
  const url = typeof args === "string" ? args : args.url
  return url.startsWith("/auth/")
}

export const baseQueryWithLogout: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error && result.error.status === 401 && !isAuthEndpoint(args)) {
    // 1. redux state clear
    api.dispatch(removeUser())
    // 2. clear stale RTK Query cache
    api.dispatch(baseApi.util.resetApiState())
    // 3. redirect to login page
    window.location.href = "/"
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: baseQueryWithLogout,
  tagTypes: [
    "TEMPLATE",
    "SITE",
    "RISK",
    "INSPECTION",
    "RECOMMENDATION",
    "FINDINGS",
    "ORG_USER",
    "ORG_INVITATION",
    "KNOWLEDGE_BASE",
    "NOTE",
    "ME",
  ],
  endpoints: () => ({}),
})
