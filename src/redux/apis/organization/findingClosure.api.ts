import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { ActionClosureApproval, ActionClosureState, IAction } from "@/types/finding"

// Finding closure maker-checker workflow (aexa-server#252 / aexa-frontend#214).
// Kept in its own file rather than folded into findings.api.ts, mirroring
// riskApproval.api.ts's precedent -- every mutation invalidates FINDINGS too
// so the finding's own status (which only ever changes via an approved
// closure) can't drift out of sync with the closure badge in the UI.
const findingClosureApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getFindingClosureState: builder.query<ApiResponse<ActionClosureState>, string>({
      query: (actionId) => ({
        url: `/action/${actionId}/closure`,
        method: "GET",
      }),
      providesTags: ["ACTION_CLOSURE"],
    }),
    submitFindingForClosure: builder.mutation<
      ApiResponse<ActionClosureApproval>,
      { actionId: string; requestedStatus: IAction["status"] }
    >({
      query: ({ actionId, requestedStatus }) => ({
        url: `/action/${actionId}/closure/submit`,
        method: "POST",
        body: { requestedStatus },
      }),
      invalidatesTags: ["FINDINGS", "ACTION_CLOSURE"],
    }),
    approveFindingClosure: builder.mutation<
      ApiResponse<{ closure: ActionClosureApproval; action: IAction }>,
      string
    >({
      query: (closureId) => ({
        url: `/action/closure/${closureId}/approve`,
        method: "POST",
      }),
      invalidatesTags: ["FINDINGS", "ACTION_CLOSURE"],
    }),
    rejectFindingClosure: builder.mutation<
      ApiResponse<ActionClosureApproval>,
      { closureId: string; decisionNote: string }
    >({
      query: ({ closureId, decisionNote }) => ({
        url: `/action/closure/${closureId}/reject`,
        method: "POST",
        body: { decisionNote },
      }),
      invalidatesTags: ["FINDINGS", "ACTION_CLOSURE"],
    }),
  }),
})

export const {
  useGetFindingClosureStateQuery,
  useSubmitFindingForClosureMutation,
  useApproveFindingClosureMutation,
  useRejectFindingClosureMutation,
} = findingClosureApi
