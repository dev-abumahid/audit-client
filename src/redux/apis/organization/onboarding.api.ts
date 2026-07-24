import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type {
  CommitRequest,
  CommitResult,
  CompanyProfile,
  GenerateRequest,
  GenerateResponse,
} from "@/types/onboarding"

// One row of the admin Organizations list — the real, flattened shape
// returned by aexa-server's GET /organization (Account role ORGANIZATION +
// its OrganizationProfile). There is no subscription concept in the schema,
// so the admin table derives its status badge from isAccountVerified and
// shows real sector/country rather than a fabricated plan name (#162).
export interface AdminOrganizationListItem {
  id: string
  email: string
  organizationName: string
  sector: string | null
  country: string | null
  organizationLogo: string | null
  isAccountVerified: boolean
  createdAt: string
}

interface GetAdminOrganizationsArgs {
  page: number
  limit: number
  searchTerm: string
}

// Admin-only onboarding + org-creation endpoints (#96). identify and generate
// never persist anything — only commit (and the manual createOrganization
// fallback) write. None of these live under /auth, so a 401 flows through the
// global logout handler as normal.
const onboardingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Admin dashboard's Organizations list — real, paginated, searchable
    // (#162). Provides the ORGANIZATION tag so creating an org (via the wizard
    // commit or the manual fallback below) re-fetches the list, which is the
    // whole point: a freshly-created org must appear here immediately.
    getAdminOrganizations: builder.query<
      PaginatedApiResponse<AdminOrganizationListItem>,
      GetAdminOrganizationsArgs
    >({
      query: ({ page, limit, searchTerm }) => ({
        url: `/organization?${buildQueryString({ page, limit, searchTerm })}`,
        method: "GET",
      }),
      providesTags: ["ORGANIZATION"],
    }),

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
      // A committed org must show up in the admin Organizations list.
      invalidatesTags: ["ORGANIZATION"],
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
      // Same as commit: a manually-created org must show up in the list.
      invalidatesTags: ["ORGANIZATION"],
    }),
  }),
})

export const {
  useGetAdminOrganizationsQuery,
  useIdentifyCompanyMutation,
  useGenerateOnboardingBaselineMutation,
  useCommitOnboardingMutation,
  useCreateOrganizationMutation,
} = onboardingApi
