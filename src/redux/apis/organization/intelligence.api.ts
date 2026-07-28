import { buildQueryString } from "@/redux/apis/buildQueryString"
import { baseApi } from "@/redux/baseApi"
import type { ApiResponse, PaginatedApiResponse } from "@/types/api"
import type { IntelligenceItem, IntelligenceRun } from "@/types/organization"

// aexa-frontend#141 stage 3: RTK Query slice for the real Threat
// Intelligence backend (aexa-server PR #230 / aexa-ai PR #122). Mirrors
// risk.api.ts / sites.api.ts's shape -- one `injectEndpoints` block per
// feature area, ApiResponse for single-resource results, PaginatedApiResponse
// for the two GET list endpoints.

interface GetIntelligenceItemsArgs {
  analyzed?: boolean
  // aexa-frontend#253: server-side search/severity filtering, matching
  // aexa-server#293/PR #295's new GET /intelligence/items query params --
  // searchTerm does a case-insensitive substring match OR'd across
  // title/description, severity is an exact match. Both are optional and
  // additive to the org-scoped where clause on the backend.
  searchTerm?: string
  severity?: string
  page: number
  limit: number
}

interface GetIntelligenceRunsArgs {
  run_type?: "PREDICT" | "MITIGATIONS" | "RCSA" | "RESILIENCE_SCAN"
  page: number
  limit: number
}

// POST /intelligence/scrape's real response shape (see
// intelligence.service.ts's scrape_sources_into_db) -- not just the created
// items, but the source-collection stats the page's action bar displays.
export interface ScrapeResult {
  items: IntelligenceItem[]
  sourcesTotal: number
  sourcesSucceeded: number
  itemsScraped: number
  itemsNew: number
}

// POST /intelligence/analyze's real response shape (analyze_items_into_db).
export interface AnalyzeResult {
  items: IntelligenceItem[]
  count: number
}

const intelligenceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    scrapeIntelligence: builder.mutation<ApiResponse<ScrapeResult>, void>({
      query: () => ({
        url: "/intelligence/scrape",
        method: "POST",
      }),
      invalidatesTags: ["INTELLIGENCE_ITEM"],
    }),
    analyzeIntelligence: builder.mutation<
      ApiResponse<AnalyzeResult>,
      { itemIds?: string[] } | void
    >({
      query: (body) => ({
        url: "/intelligence/analyze",
        method: "POST",
        body: body ?? {},
      }),
      invalidatesTags: ["INTELLIGENCE_ITEM"],
    }),
    predictTrends: builder.mutation<ApiResponse<IntelligenceRun>, void>({
      query: () => ({
        url: "/intelligence/predict",
        method: "POST",
      }),
      invalidatesTags: ["INTELLIGENCE_RUN"],
    }),
    generateMitigations: builder.mutation<ApiResponse<IntelligenceRun>, void>({
      query: () => ({
        url: "/intelligence/mitigations",
        method: "POST",
      }),
      invalidatesTags: ["INTELLIGENCE_RUN"],
    }),
    generateRcsa: builder.mutation<ApiResponse<IntelligenceRun>, void>({
      query: () => ({
        url: "/intelligence/rcsa",
        method: "POST",
      }),
      invalidatesTags: ["INTELLIGENCE_RUN"],
    }),
    resilienceScan: builder.mutation<ApiResponse<IntelligenceRun>, void>({
      query: () => ({
        url: "/intelligence/resilience-scan",
        method: "POST",
      }),
      invalidatesTags: ["INTELLIGENCE_RUN"],
    }),
    getIntelligenceItems: builder.query<
      PaginatedApiResponse<IntelligenceItem>,
      GetIntelligenceItemsArgs
    >({
      query: ({ analyzed, searchTerm, severity, page, limit }) => ({
        url: `/intelligence/items?${buildQueryString({
          analyzed: analyzed === undefined ? undefined : String(analyzed),
          searchTerm: searchTerm || undefined,
          severity: severity || undefined,
          page,
          limit,
        })}`,
        method: "GET",
      }),
      providesTags: ["INTELLIGENCE_ITEM"],
    }),
    getIntelligenceRuns: builder.query<
      PaginatedApiResponse<IntelligenceRun>,
      GetIntelligenceRunsArgs
    >({
      query: ({ run_type, page, limit }) => ({
        url: `/intelligence/runs?${buildQueryString({ run_type, page, limit })}`,
        method: "GET",
      }),
      providesTags: ["INTELLIGENCE_RUN"],
    }),
    createRiskFromItem: builder.mutation<
      // ApiResponse<Risk> would introduce a Risk import purely for the return
      // type; the page only needs to know the promotion succeeded (it reads
      // created_risk_id off the refetched IntelligenceItem afterward), so the
      // created Risk's id/name are typed narrowly here instead.
      ApiResponse<{ id: string; name: string }>,
      { itemId: string; siteId?: string }
    >({
      query: ({ itemId, siteId }) => ({
        url: `/intelligence/items/${itemId}/create-risk`,
        method: "POST",
        body: siteId ? { siteId } : {},
      }),
      // aexa-frontend#261: also invalidates RISK -- this endpoint creates a
      // Risk server-side (see the returned { id, name }), so Risk Register's
      // getAllRisks and Three Lines board both cache-read RISK and must
      // refetch to show the newly-promoted risk without a manual reload.
      invalidatesTags: ["INTELLIGENCE_ITEM", "RISK"],
    }),
  }),
})

export const {
  useScrapeIntelligenceMutation,
  useAnalyzeIntelligenceMutation,
  usePredictTrendsMutation,
  useGenerateMitigationsMutation,
  useGenerateRcsaMutation,
  useResilienceScanMutation,
  useGetIntelligenceItemsQuery,
  useGetIntelligenceRunsQuery,
  useCreateRiskFromItemMutation,
} = intelligenceApi

// aexa-frontend#261: exported so intelligence.api.test.ts can dispatch
// createRiskFromItem.initiate directly against a real store, matching
// note.api.ts's #229 precedent for verifying cache-invalidation behavior
// with a real store + mocked fetch rather than introspecting RTK Query's
// internal endpoint config.
export { intelligenceApi }
