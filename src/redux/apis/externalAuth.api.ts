import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"

// Matches external-auth.validation.ts's request_code/verify_code schemas
// exactly. organizationId is Organization.id (the value embedded in the
// /external-login/:organizationId route this whole flow is reached through),
// not the anchor-Account-id `organizationId` internal auth sometimes means --
// see ExternalOrgMember's own type comment for the full distinction.
export interface RequestExternalCodePayload {
  organizationId: string
  email: string
}

export interface VerifyExternalCodePayload extends RequestExternalCodePayload {
  code: string
}

// verify-code's success response. The backend also sets an httpOnly
// `external_access_token` cookie in the same response (12h) -- accessToken
// is returned in the body too, but this frontend relies on the cookie
// (fetchBaseQuery's credentials: "include") rather than storing/attaching
// the token itself, same convention as the internal sign-in flow.
export interface VerifyExternalCodeResult {
  accessToken: string
  externalOrgMemberId: string
  email: string
  fullName: string | null
}

const externalAuthApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Always resolves 200 regardless of whether the email is a real/active
    // member (anti-enumeration) -- callers show a generic "check your email"
    // message, never branch on this response's content.
    requestExternalCode: builder.mutation<
      ApiResponse<Record<string, never>>,
      RequestExternalCodePayload
    >({
      query: (data) => ({
        url: `/external-auth/request-code`,
        method: "POST",
        body: data,
      }),
    }),
    // Every failure mode (wrong code, expired, locked out, unknown member)
    // returns the same generic 401 -- deliberately not distinguished here,
    // matching the backend's own anti-enumeration design.
    verifyExternalCode: builder.mutation<
      ApiResponse<VerifyExternalCodeResult>,
      VerifyExternalCodePayload
    >({
      query: (data) => ({
        url: `/external-auth/verify-code`,
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const {
  useRequestExternalCodeMutation,
  useVerifyExternalCodeMutation,
} = externalAuthApi
