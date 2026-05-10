import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

import type {
  BaseQueryFn,
  FetchArgs,
  FetchBaseQueryError,
} from "@reduxjs/toolkit/query"
import { removeUser } from "./slices/user.slice"

const rawBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_SERVER_BASE_URL as string,
  credentials: "include",
})

export const baseQueryWithLogout: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await rawBaseQuery(args, api, extraOptions)

  if (result.error && result.error.status === 401) {
    // 1. redux state clear
    api.dispatch(removeUser())
    // 2. redirect to login page
    // window.location.href = "/"
  }

  return result
}

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: baseQueryWithLogout,
  tagTypes: ["TEMPLATE", "SITE", "RISK"],
  endpoints: () => ({}),
})
