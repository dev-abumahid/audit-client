import { baseApi } from "@/redux/baseApi"
import type { ApiResponse } from "@/types/api"

// docs/design-docs/site-ai-risk-register-generation.md §2/§3: backed by
// aexa-server's POST/GET /ai/risk-analysis-runs, itself orchestrating
// aexa-ai's two-phase generation (Phase 1 triage, then N parallel Phase 2
// category-generation calls). Unlike the old single-call /ai/analyze-site-risks
// flow it replaces, generated risks are persisted directly as real Risk rows
// as each category completes -- there is no separate pending-suggestion
// state to review/import; this run row is a progress/provenance record, not
// a staging area.
export type AiRiskAnalysisRunStatus = "running" | "completed" | "partial" | "failed"

export interface AiRiskAnalysisCategorySkipped {
  category: string
  reasoning: string
}

export interface AiRiskAnalysisCategoryFailed {
  category: string
  error: string
}

export interface AiRiskAnalysisRun {
  id: string
  site_id: string
  org_account_id: string
  triggered_by_account_id: string
  status: AiRiskAnalysisRunStatus
  started_at: string
  completed_at: string | null
  categories_applicable: string[] | null
  categories_skipped: AiRiskAnalysisCategorySkipped[] | null
  categories_failed: AiRiskAnalysisCategoryFailed[] | null
  createdAt: string
  updatedAt: string
}

// The GET /:id response adds a live count of risks persisted so far for
// this run -- not present on the POST response, which returns the row the
// instant it's created (before any category has had a chance to persist
// anything).
export interface AiRiskAnalysisRunDetail extends AiRiskAnalysisRun {
  risks_created: number
}

// Exported (not just its generated hooks) so aiRiskAnalysis.api.test.ts can
// dispatch endpoints.initiate() directly against a real store -- same
// convention as risk.api.ts's risksApi export.
export const aiRiskAnalysisApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    startAiRiskAnalysis: builder.mutation<
      ApiResponse<AiRiskAnalysisRun>,
      { siteId: string }
    >({
      query: (body) => ({
        url: `/ai/risk-analysis-runs`,
        method: "POST",
        body,
      }),
      invalidatesTags: ["AI_RISK_ANALYSIS_RUN"],
    }),
    getAiRiskAnalysisRunById: builder.query<
      ApiResponse<AiRiskAnalysisRunDetail>,
      string
    >({
      query: (id) => ({
        url: `/ai/risk-analysis-runs/${id}`,
        method: "GET",
      }),
      providesTags: (_result, _error, id) => [
        { type: "AI_RISK_ANALYSIS_RUN", id },
      ],
      // Each poll tick can reflect newly-persisted risks (the backend
      // writes them as each Phase 2 category completes, not buffered
      // until the whole run finishes) -- invalidate RISK so the site's
      // risk list picks them up without requiring a manual refresh, but
      // ONLY on a tick where risks_created actually changed (review
      // finding: invalidating on every tick regardless refetches every
      // RISK-tagged query app-wide every 3s for the run's whole duration,
      // even the "still running triage, nothing persisted yet" ticks).
      // getCacheEntry() reads the cache as it stood BEFORE this fetch's
      // result lands, so comparing against it after queryFulfilled is a
      // genuine before/after diff, not a comparison against itself.
      async onQueryStarted(_id, { dispatch, queryFulfilled, getCacheEntry }) {
        const previousRisksCreated = getCacheEntry().data?.data.risks_created
        try {
          const { data } = await queryFulfilled
          // undefined previousRisksCreated means this is the query's first
          // fetch (nothing cached yet to compare against) -- not itself
          // evidence anything changed, so it must NOT invalidate. Without
          // this guard, `undefined !== 0` on that very first fetch would
          // always be true, spuriously invalidating on every run's first
          // poll regardless of whether risks_created is actually 0.
          if (
            previousRisksCreated !== undefined &&
            data.data.risks_created !== previousRisksCreated
          ) {
            dispatch(baseApi.util.invalidateTags(["RISK"]))
          }
        } catch {
          // Fetch failed -- nothing new to invalidate.
        }
      },
    }),
  }),
})

export const {
  useStartAiRiskAnalysisMutation,
  useGetAiRiskAnalysisRunByIdQuery,
} = aiRiskAnalysisApi
