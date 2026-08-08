import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { Risk } from "@/types/organization"

interface GetAllRisksArgs {
  page: number
  limit: number
  searchTerm: string
  siteId: string
  category: string
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
  }),
})

export const {
  useGetAllRisksQuery,
  useLazyGetAllRisksQuery,
  useGetSingleRiskQuery,
  useDeleteRiskMutation,
  useCreateNewRiskMutation,
  useUpdateRiskMutation,
} = risksApi

// aexa-frontend#261: exported so risk.api.test.ts can dispatch
// deleteRisk/createNewRisk/updateRisk.initiate directly against a real
// store, matching note.api.ts's #229 precedent for verifying
// cache-invalidation behavior with a real store + mocked fetch rather than
// introspecting RTK Query's internal endpoint config.
export { risksApi }
