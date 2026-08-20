import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { RiskFieldSuggestionResult } from "@/types/ai"
import type { Risk, LineOfDefense } from "@/types/organization"
import type { LineReview } from "./governance.api"

interface SuggestRiskFieldsArgs {
  name: string
  category: string
  site_id: string
  // Omitted = suggest every AI-suggestable field (bulk pre-fill). A
  // single-element array is the per-field "suggest just this one" path.
  fields?: string[]
}

interface GetAllRisksArgs {
  page: number
  limit: number
  searchTerm: string
  siteId: string
  category: string
}

// aexa-server#347: org-wide EBITDA-at-risk distribution backing the
// dashboard's "Distribution EBITDA at Risk" chart -- see
// GET /risk/ebitda-at-risk-summary (risk.service.ts's
// get_ebitda_at_risk_summary / ebitda_summary.ts's computeEbitdaSummary).
export interface EbitdaAtRiskSummary {
  data: { name: string; value: number }[]
  p5: number
  p50: number
  totalEstimatedEbitda: number
  risksWithData: number
  risksTotal: number
}

const risksApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAllRisks: builder.query<PaginatedApiResponse<Risk>, GetAllRisksArgs>({
      query: ({ page, limit, searchTerm, siteId, category }) => ({
        url: `/risk?${buildQueryString({ page, limit, searchTerm, siteId, category })}`,
        method: "GET",
      }),
      providesTags: ["RISK"],
    }),
    // aexa-frontend#529: powers the new per-risk detail page. Note the
    // single-risk response does NOT carry `approval`/`approvalStatus` --
    // those are attached only by getAllRisks's list serializer server-side
    // (see types/organization.d.ts's Risk.approval comment) -- callers that
    // need approval state fetch it separately via
    // useGetRiskApprovalStateQuery, same as this endpoint's own consumer.
    getSingleRisk: builder.query<ApiResponse<Risk>, string>({
      query: (id) => ({
        url: `/risk/${id}`,
        method: "GET",
      }),
      providesTags: ["RISK"],
    }),
    // aexa-server#347: powers Overview.tsx's "Distribution EBITDA at Risk"
    // chart, replacing that page's previous hardcoded static placeholder
    // array. providesTags: ["RISK"] so any risk create/update/delete (all of
    // which already invalidate "RISK") refetches this too, keeping the
    // chart in sync with the register without a dedicated tag.
    getEbitdaAtRiskSummary: builder.query<ApiResponse<EbitdaAtRiskSummary>, void>({
      query: () => ({
        url: `/risk/ebitda-at-risk-summary`,
        method: "GET",
      }),
      providesTags: ["RISK"],
    }),
    // aexa-frontend#261: also invalidates CORRELATION_MATRIX -- deleting a
    // Risk removes it (and any RiskLink/Action rows keyed on its `ref`) from
    // getCorrelationMatrixData's cached result too. Without this, a deleted
    // risk persists as a phantom row on CorrelationMatrixPage.tsx until a
    // hard reload.
    deleteRisk: builder.mutation<ApiResponse<Risk>, string>({
      query: (id) => ({
        url: `/risk/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["RISK", "CORRELATION_MATRIX"],
    }),
    // aexa-frontend#261: also invalidates CORRELATION_MATRIX -- a newly
    // created Risk can immediately be linked/bucketed on the correlation
    // matrix, so that page's cached data must refetch to pick it up.
    createNewRisk: builder.mutation<ApiResponse<Risk>, Partial<Risk>>({
      query: (data) => ({
        url: `/risk`,
        method: "POST",
        body: data,
      }),
      invalidatesTags: ["RISK", "CORRELATION_MATRIX"],
    }),
    // aexa-frontend#261: also invalidates CORRELATION_MATRIX -- edits to a
    // risk's fields (e.g. category, title) are reflected in the matrix's
    // risk axis, which otherwise stays stale until a hard reload.
    updateRisk: builder.mutation<
      ApiResponse<Risk>,
      { data: Partial<Risk>; id: string }
    >({
      query: ({ data, id }) => ({
        url: `/risk/${id}`,
        method: "PATCH",
        body: data,
      }),
      invalidatesTags: ["RISK", "CORRELATION_MATRIX"],
    }),
    // #97: records that `line` independently reviewed this risk -- distinct
    // from updateRisk's line_of_defense, which reassigns OWNERSHIP (see
    // governance.api.ts's LineReview doc comment). Only invalidates
    // GOVERNANCE, not RISK -- a review doesn't change any Risk field, so
    // refetching the risk register/list pages would be wasted work; the
    // Three Lines board is the only view that needs to know.
    recordRiskLineReview: builder.mutation<
      ApiResponse<LineReview[]>,
      { id: string; line: LineOfDefense; notes?: string }
    >({
      query: ({ id, line, notes }) => ({
        url: `/risk/${id}/line-reviews`,
        method: "POST",
        body: { line, notes },
      }),
      invalidatesTags: ["GOVERNANCE"],
    }),
    // RiskFormModal's AI pre-fill -- non-persisting suggestion: no
    // invalidatesTags, since this doesn't change any stored Risk data,
    // just returns values for the caller to review/apply client-side.
    suggestRiskFields: builder.mutation<
      ApiResponse<RiskFieldSuggestionResult>,
      SuggestRiskFieldsArgs
    >({
      query: (data) => ({
        url: `/risk/suggest-fields`,
        method: "POST",
        body: data,
      }),
    }),
  }),
})

export const {
  useGetAllRisksQuery,
  useLazyGetAllRisksQuery,
  useGetSingleRiskQuery,
  useGetEbitdaAtRiskSummaryQuery,
  useDeleteRiskMutation,
  useCreateNewRiskMutation,
  useUpdateRiskMutation,
  useSuggestRiskFieldsMutation,
  useRecordRiskLineReviewMutation,
} = risksApi

// aexa-frontend#261: exported so risk.api.test.ts can dispatch
// deleteRisk/createNewRisk/updateRisk.initiate directly against a real
// store, matching note.api.ts's #229 precedent for verifying
// cache-invalidation behavior with a real store + mocked fetch rather than
// introspecting RTK Query's internal endpoint config.
export { risksApi }
