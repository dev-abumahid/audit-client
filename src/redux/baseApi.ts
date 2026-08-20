import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { removeExternalUser } from "./slices/externalUser.slice"
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
//
// /external-auth/* gets the same exclusion (aexa-frontend#216) -- a wrong/
// expired OTP during external-member login is a normal 401 the login page
// handles inline, not an internal session going invalid. This external flow
// has no internal `user` session to log out of at all, so falling through to
// the global handler would just redirect an unauthenticated visitor to "/"
// on every wrong code, which isn't even the right page for them to land on.
const isAuthEndpoint = (args: string | FetchArgs): boolean => {
  const url = typeof args === "string" ? args : args.url
  return url.startsWith("/auth/") || url.startsWith("/external-auth/")
}

export const baseQueryWithLogout: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error && result.error.status === 401 && !isAuthEndpoint(args)) {
    // 1. redux state clear -- both sessions. Today only one of these is ever
    // actually populated for a given browser (removeExternalUser is a
    // harmless no-op against an internal session and vice versa), but
    // clearing only `user` here left stale externalUser PII sitting in
    // localStorage indefinitely once any authenticated /external/* endpoint
    // starts returning real 401s (found in review, aexa-frontend#216 --
    // there's no such endpoint yet, but ExternalProtectedRoute would
    // otherwise optimistically render the portal on a stale session next
    // visit, then redirect-loop on the first real API call).
    api.dispatch(removeUser())
    api.dispatch(removeExternalUser())
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
    "RISK_APPROVAL",
    "INSPECTION",
    "RECOMMENDATION",
    "FINDINGS",
    "ORG_USER",
    "ORG_INVITATION",
    "KNOWLEDGE_BASE",
    "NOTE",
    "ME",
    "KRI",
    "ALERT",
    "AUDIT",
    "COMPLIANCE",
    "REPORT",
    "ORGANIZATION",
    "GOVERNANCE",
    "INTELLIGENCE_ITEM",
    "INTELLIGENCE_RUN",
    "CORRELATION_MATRIX",
    "EXTERNAL_MEMBER",
    "ACTION_CLOSURE",
    "AI_RISK_ANALYSIS_RUN",
  ],
  endpoints: () => ({}),
})
