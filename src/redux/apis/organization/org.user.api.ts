import { baseApi } from "@/redux/baseApi"

const orgUserApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllOrgUsers: builder.query({
      // Real route is /organization/members (see aexa-server's
      // organization.route.ts) — /org-user was never actually built (#40).
      // GET requests don't carry a body; the previous `body` param here was
      // always silently dropped.
      query: () => ({
        url: `/organization/members`,
        method: "GET",
      }),
      providesTags: ["ORG_USER"],
    }),
  }),
})

export const { useGetAllOrgUsersQuery } = orgUserApi
