import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type {
  CommitRequest,
  CommitResult,
  CompanyProfile,
  GenerateRequest,
  GenerateResponse,
} from "@/types/onboarding"

// Admin-only onboarding + org-creation endpoints (#96). identify and generate
// never persist anything — only commit (and the manual createOrganization
// fallback) write. None of these live under /auth, so a 401 flows through the
// global logout handler as normal.
const onboardingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Stage 1 — grounded company lookup. No persistence.
    identifyCompany: builder.mutation<
      ApiResponse<CompanyProfile>,
      { company_name: string }
    >({
      query: (body) => ({
        url: `/onboarding/identify`,
        method: "POST",
        body,
      }),
    }),

    // Stage 3 — fan out to risk analysis + KRI baseline. No persistence.
    generateOnboardingBaseline: builder.mutation<
      ApiResponse<GenerateResponse>,
      GenerateRequest
    >({
      query: (body) => ({
        url: `/onboarding/generate`,
        method: "POST",
        body,
      }),
    }),

    // Stage 4 — the only persisting call: creates the whole org tree in one
    // transaction on the server.
    commitOnboarding: builder.mutation<
      ApiResponse<CommitResult>,
      CommitRequest
    >({
      query: (body) => ({
        url: `/onboarding/commit`,
        method: "POST",
        body,
      }),
    }),

    // Manual (non-AI) org creation fallback — the plain "create an org
    // without the wizard" path.
    createOrganization: builder.mutation<
      ApiResponse<CommitResult>,
      {
        organizationName: string
        email: string
        password: string
        sector?: string | null
        country?: string | null
      }
    >({
      query: (body) => ({
        url: `/organization`,
        method: "POST",
        body,
      }),
    }),
  }),
})

export const {
  useIdentifyCompanyMutation,
  useGenerateOnboardingBaselineMutation,
  useCommitOnboardingMutation,
  useCreateOrganizationMutation,
} = onboardingApi
