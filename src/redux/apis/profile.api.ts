import { baseApi } from "../baseApi"
import type { ApiResponse } from "@/types/api"

// update_profile_into_db upserts and returns the full Profile row (see
// aexa-server's profile.service.ts) -- an upsert, not a plain update,
// specifically because self-signed-up accounts (the org anchor) never get
// a Profile row created at signup, only invited members do.
interface UpdatedProfile {
  id: string
  accountId: string
  fullName: string
  profilePhoto: string | null
}

const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // PATCH /api/profile — multipart. The server does NOT read text fields
    // as regular form fields; it expects a single `data` field containing
    // JSON.stringify({ fullName }) plus an optional `file` field, then does
    // `req.body = JSON.parse(req.body.data)` before validation (see
    // aexa-server's profile.route.ts). Build the FormData that shape at the
    // call site, this endpoint just forwards whatever FormData it's given.
    updateProfile: builder.mutation<ApiResponse<UpdatedProfile>, FormData>({
      query: (formData: FormData) => ({
        url: "/profile",
        method: "PATCH",
        body: formData,
      }),
      invalidatesTags: ["ME"],
    }),
  }),
})

export const { useUpdateProfileMutation } = profileApi
