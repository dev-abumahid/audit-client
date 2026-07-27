import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { ExternalOrgMember } from "@/types/organizationMember"

// Matches organization.route.ts's POST /organization/external-members body.
// role is intentionally omitted -- the backend hard-rejects anything but
// LIGHT_USER today (external VIEWER isn't wired up yet), so there's nothing
// for this form to offer besides the one supported role.
export interface InviteExternalMemberPayload {
  email: string
  fullName?: string
}

const externalMemberApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExternalMembers: builder.query<ApiResponse<ExternalOrgMember[]>, void>({
      query: () => ({
        url: `/organization/external-members`,
        method: "GET",
      }),
      providesTags: ["EXTERNAL_MEMBER"],
    }),
    // Admin-only server-side (requireCallerIsOrgAdmin) -- re-inviting a
    // previously-removed email reactivates the same row rather than erroring
    // (see invite_external_member_into_db's own comment), so this always
    // invalidates the list rather than trying to distinguish create-vs-reactivate
    // client-side.
    inviteExternalMember: builder.mutation<
      ApiResponse<ExternalOrgMember>,
      InviteExternalMemberPayload
    >({
      query: (data) => ({
        url: `/organization/external-members`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["EXTERNAL_MEMBER"],
    }),
  }),
})

export const { useGetExternalMembersQuery, useInviteExternalMemberMutation } =
  externalMemberApi
