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
    // Rotates the invite token server-side, so the old link stops working —
    // same admin-only, no-client-side-role-check pattern as inviteMember.
    resendInvitation: builder.mutation({
      query: (id: string) => ({
        url: `/organization/invite/${id}/resend`,
        method: "POST",
      }),
      invalidatesTags: ["ORG_INVITATION"],
    }),
    // Admin-only (requireCallerIsOrgAdmin server-side). Only status/expiresAt
    // can be set this way; this UI only ever sends status (suspend/reactivate).
    updateOrgMember: builder.mutation({
      query: ({
        id,
        body,
      }: {
        id: string
        body: { status?: "ACTIVE" | "SUSPENDED" }
      }) => ({
        url: `/organization/members/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["ORG_USER"],
    }),
  }),
})

export const {
  useGetAllOrgUsersQuery,
  useGetPendingInvitationsQuery,
  useInviteMemberMutation,
  useResendInvitationMutation,
  useUpdateOrgMemberMutation,
} = orgUserApi
