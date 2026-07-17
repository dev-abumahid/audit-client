import { baseApi } from "../baseApi"

const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // PATCH /api/profile — multipart. The server does NOT read text fields
    // as regular form fields; it expects a single `data` field containing
    // JSON.stringify({ fullName }) plus an optional `file` field, then does
    // `req.body = JSON.parse(req.body.data)` before validation (see
    // aexa-server's profile.route.ts). Build the FormData that shape at the
    // call site, this endpoint just forwards whatever FormData it's given.
    updateProfile: builder.mutation({
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
