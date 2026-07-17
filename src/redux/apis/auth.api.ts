import { baseApi } from "../baseApi"

const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // sign in route
    signInUser: builder.mutation({
      query: (data) => ({
        url: "/auth/sign-in",
        method: "POST",
        body: data,
      }),
    }),

    // sign up route
    signUpUser: builder.mutation({
      query: (data) => ({
        url: "/auth/sign-up",
        method: "POST",
        body: data,
      }),
    }),

    // Verify otp
    verifyOtp: builder.mutation({
      query: (data) => ({
        url: "/auth/verify-otp",
        method: "PUT",
        body: data,
      }),
    }),

    // Get me route
    getMe: builder.query({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: ["ME"],
    }),

    // change password
    changePassword: builder.mutation({
      query: (data) => ({
        url: "/auth/change-password",
        method: "PUT",
        body: data,
      }),
    }),

    // resend opt
    resendOtp: builder.mutation({
      query: (data) => ({
        url: "/auth/resend-otp",
        method: "PUT",
        body: data,
      }),
    }),
    // forget password
    forgetPassword: builder.mutation({
      query: (data) => ({
        url: "/auth/forget-password",
        method: "PUT",
        body: data,
      }),
    }),
    // reset password
    resetPassword: builder.mutation({
      query: (data) => ({
        url: "/auth/reset-password",
        method: "PUT",
        body: data,
      }),
    }),

    // which social providers have real OAuth credentials configured —
    // render only these as "Sign in with X" buttons
    getSocialProviders: builder.query<
      {
        data: {
          google: boolean
          facebook: boolean
          twitter: boolean
          github: boolean
        }
      },
      void
    >({
      query: () => ({
        url: "/auth/social-providers",
        method: "GET",
      }),
    }),
  }),
})

export const {
  useSignInUserMutation,
  useSignUpUserMutation,
  useVerifyOtpMutation,
  useGetMeQuery,
  useChangePasswordMutation,
  useResendOtpMutation,
  useForgetPasswordMutation,
  useResetPasswordMutation,
  useGetSocialProvidersQuery,
} = authApi
