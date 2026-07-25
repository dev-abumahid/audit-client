import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type {
  CorrelationMatrixData,
  RiskLink,
  RiskLinkType,
  RootCauseBucketingResult,
} from "@/types/organization"

// aexa-frontend#142 — correlation matrix + RiskLink CRUD + AI root-cause
// bucketing. Endpoints confirmed against the real merged aexa-server source:
// GET /risk/correlation-matrix and POST /risk/root-cause-bucketing
// (risk.correlation.route.ts, mounted under /risk in risk.route.ts), and
// GET|POST /risk-link, DELETE /risk-link/:id (risk_link.route.ts, mounted at
// /risk-link in routes.ts).
interface CreateRiskLinkArgs {
  source_ref: string
  target_ref: string
  link_type: RiskLinkType
}

const riskLinkApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // Everything the page needs in one call: this org's risks (with `ref`),
    // its RiskLink rows, and its Actions (this codebase's stand-in for
    // Fullbloom's AuditFinding). All bucketing/grid math stays client-side.
    getCorrelationMatrixData: builder.query<
      ApiResponse<CorrelationMatrixData>,
      void
    >({
      query: () => ({
        url: "/risk/correlation-matrix",
        method: "GET",
      }),
      providesTags: ["CORRELATION_MATRIX"],
    }),

    createRiskLink: builder.mutation<ApiResponse<RiskLink>, CreateRiskLinkArgs>({
      query: (data) => ({
        url: "/risk-link",
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["CORRELATION_MATRIX"],
    }),

    deleteRiskLink: builder.mutation<ApiResponse<RiskLink>, string>({
      query: (id) => ({
        url: `/risk-link/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["CORRELATION_MATRIX"],
    }),

    // AI action, unrestricted (any org member), matching #141's precedent
    // for AI-orchestration-only endpoints. No body -- aexa-server gathers
    // this org's risks/actions itself and orchestrates the call to aexa-ai.
    runRootCauseBucketing: builder.mutation<
      ApiResponse<RootCauseBucketingResult>,
      void
    >({
      query: () => ({
        url: "/risk/root-cause-bucketing",
        method: "POST",
      }),
    }),
  }),
})

export const {
  useGetCorrelationMatrixDataQuery,
  useCreateRiskLinkMutation,
  useDeleteRiskLinkMutation,
  useRunRootCauseBucketingMutation,
} = riskLinkApi
