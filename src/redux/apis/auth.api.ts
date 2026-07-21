import { baseApi } from "../baseApi"
import type { ApiResponse } from "@/types/api"
import type { MeAccount, SignInResult, SignUpResult } from "@/types/auth"

export interface SignInPayload {
  email: string
  password: string
}

export interface SignUpPayload {
  organizationName: string
  email: string
  password: string
}

interface VerifyOtpPayload {
  email: string
  otp: string
}

interface ChangePasswordPayload {
  oldPassword: string
  newPassword: string
}

interface ResendOtpPayload {
  email: string
}

export interface ForgetPasswordPayload {
  email: string
}

interface ResetPasswordPayload {
  token: string
  newPass: string
}

const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // sign in route
    signInUser: builder.mutation<ApiResponse<SignInResult>, SignInPayload>({
      query: (data) => ({
        url: "/auth/sign-in",
        method: "POST",
        body: data,
      }),
    }),

    // sign up route
    signUpUser: builder.mutation<ApiResponse<SignUpResult>, SignUpPayload>({
      query: (data) => ({
        url: "/auth/sign-up",
        method: "POST",
        body: data,
      }),
    }),

    // Verify otp. Backend returns an empty string, which manageResponse's
    // falsy-coalesce sends over the wire as `data: null`.
    verifyOtp: builder.mutation<ApiResponse<null>, VerifyOtpPayload>({
      query: (data) => ({
        url: "/auth/verify-otp",
        method: "PUT",
        body: data,
      }),
    }),

    // Get me route. get_user_account_from_db does a plain findUnique with
    // no not-found throw (unlike every other single-resource GET in this
    // codebase), so `data` can genuinely be null if the account backing a
    // still-valid JWT no longer exists -- e.g. deleted between token issue
    // and this request. Typed accordingly rather than assuming it's always
    // present.
    getMe: builder.query<ApiResponse<MeAccount | null>, void>({
      query: () => ({
        url: "/auth/me",
        method: "GET",
      }),
      providesTags: ["ME"],
    }),

    // change password -- also returns `data: null` on the wire (see verifyOtp).
    changePassword: builder.mutation<ApiResponse<null>, ChangePasswordPayload>({
      query: (data) => ({
        url: "/auth/change-password",
        method: "PUT",
        body: data,
      }),
    }),

    // resend otp -- service has no return statement (`undefined`), which
    // also collapses to `data: null` on the wire.
    resendOtp: builder.mutation<ApiResponse<null>, ResendOtpPayload>({
      query: (data) => ({
        url: "/auth/resend-otp",
        method: "PUT",
        body: data,
      }),
    }),
    // forget password -- same no-return-statement / `data: null` pattern.
    forgetPassword: builder.mutation<ApiResponse<null>, ForgetPasswordPayload>({
      query: (data) => ({
        url: "/auth/forget-password",
        method: "PUT",
        body: data,
      }),
    }),
    // reset password -- field is `newPass`, not `newPassword` (matches
    // account.controller.ts's reset_password_using_token body read exactly).
    // Also returns `data: null` on the wire.
    resetPassword: builder.mutation<ApiResponse<null>, ResetPasswordPayload>({
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
