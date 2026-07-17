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
    getPendingInvitations: builder.query({
      query: () => ({
        url: `/organization/invitations`,
        method: "GET",
      }),
      providesTags: ["ORG_INVITATION"],
    }),
    inviteMember: builder.mutation({
      // Admin-only server-side (requireCallerIsOrgAdmin) — this UI doesn't
      // pre-check the caller's role, it relies on the backend 403 and
      // surfaces that as a toast. Doesn't add an ORG_MEMBER row yet (the
      // invitee hasn't accepted), so this only invalidates the invitations
      // list, not the member list.
      query: (data: { email: string; role: string }) => ({
        url: `/organization/invite`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["ORG_INVITATION"],
    }),
  }),
})

export const {
  useGetAllOrgUsersQuery,
  useGetPendingInvitationsQuery,
  useInviteMemberMutation,
} = orgUserApi
