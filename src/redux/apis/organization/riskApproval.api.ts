import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { RiskApproval, RiskApprovalState } from "@/types/organization"

// Risk maker-checker approval workflow (aexa-frontend#95). Kept in its own file
// rather than folded into risk.api.ts, but every mutation invalidates the RISK
// tag too so the register list (which now carries a per-row approvalStatus)
// re-fetches after any state transition — the approval state and the risk list
// can't drift out of sync in the UI.
const riskApprovalApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getRiskApprovalState: builder.query<ApiResponse<RiskApprovalState>, string>(
      {
        query: (riskId) => ({
          url: `/risk/${riskId}/approval`,
          method: "GET",
        }),
        providesTags: ["RISK_APPROVAL"],
      }
    ),
    submitRiskForApproval: builder.mutation<ApiResponse<RiskApproval>, string>({
      query: (riskId) => ({
        url: `/risk/${riskId}/submit-for-approval`,
        method: "POST",
      }),
      invalidatesTags: ["RISK", "RISK_APPROVAL"],
    }),
    approveRisk: builder.mutation<ApiResponse<RiskApproval>, string>({
      query: (approvalId) => ({
        url: `/risk/approvals/${approvalId}/approve`,
        method: "POST",
      }),
      invalidatesTags: ["RISK", "RISK_APPROVAL"],
    }),
    rejectRisk: builder.mutation<
      ApiResponse<RiskApproval>,
      { approvalId: string; decisionNote: string }
    >({
      query: ({ approvalId, decisionNote }) => ({
        url: `/risk/approvals/${approvalId}/reject`,
        method: "POST",
        body: { decisionNote },
      }),
      invalidatesTags: ["RISK", "RISK_APPROVAL"],
    }),
  }),
})

export const {
  useGetRiskApprovalStateQuery,
  useSubmitRiskForApprovalMutation,
  useApproveRiskMutation,
  useRejectRiskMutation,
} = riskApprovalApi
