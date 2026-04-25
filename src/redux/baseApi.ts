import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

export const baseApi = createApi({
  reducerPath: "baseApi",
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_SERVER_BASE_URL as string,
    credentials: "include",
  }),
  tagTypes: ["TEMPLATE"],
  endpoints: () => ({}),
})
