import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"
import type { IAction } from "@/types/finding"
import type {
  CorrelationMatrixData,
  RiskLink,
  RiskLinkType,
  RootCauseBucketingResult,
  RootCauseGroupedAction,
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

    // aexa-frontend#191 -- "Send to Finding": turns one AI root-cause
    // bucket's groupedAction (plus that bucket's riskRefs, one level up on
    // the bucket, not on groupedAction itself) into a real Action row.
    // Confirmed against the real merged aexa-server source
    // (risk.correlation.service.ts's create_action_from_bucket /
    // CreateActionFromBucketInput, risk.correlation.validation.ts,
    // risk.route.ts's POST /risk/root-cause-bucketing/create-action).
    // ADMIN/LEAD_AUDITOR-only server-side (assertCanWriteOrgResource) --
    // the page hides the button for other roles via useMyOrgRole, same
    // convention as the "Add Link" control above.
    //
    // Invalidates FINDINGS (not CORRELATION_MATRIX): the new Action isn't
    // one this page's own GET /risk/correlation-matrix query needs to
    // refetch to keep working (the AI bucket that produced it is ephemeral
    // client state, not refetched data), but the Findings page's
    // useGetAllFindingsQuery (findings.api.ts) tags its list with FINDINGS
    // exactly like createNewFinding there -- invalidating the same tag here
    // means a user who navigates to Findings after sending a bucket sees
    // the new action without a manual refresh.
    createActionFromBucket: builder.mutation<
      ApiResponse<IAction>,
      RootCauseGroupedAction & { riskRefs: string[] }
    >({
      query: (body) => ({
        url: "/risk/root-cause-bucketing/create-action",
        method: "POST",
        body,
      }),
      invalidatesTags: ["FINDINGS"],
    }),
  }),
})

export const {
  useGetCorrelationMatrixDataQuery,
  useCreateRiskLinkMutation,
  useDeleteRiskLinkMutation,
  useRunRootCauseBucketingMutation,
  useCreateActionFromBucketMutation,
} = riskLinkApi
