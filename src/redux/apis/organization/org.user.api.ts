import { baseApi } from "@/redux/baseApi"

const orgUserApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllOrgUsers: builder.query({
      query: (body) => ({
        url: `/org-user`,
        method: "GET",
        body,
      }),
      providesTags: ["ORG_USER"],
    }),
  }),
})

export const { useGetAllOrgUsersQuery } = orgUserApi
