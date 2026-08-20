import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { risksApi } from "./risk.api"
import { aiRiskAnalysisApi } from "./aiRiskAnalysis.api"

// Review finding on PR #982: getAiRiskAnalysisRunById's onQueryStarted used
// to invalidate RISK unconditionally on every successful poll tick, not
// just ticks where risks_created actually changed -- refetching every
// RISK-tagged query app-wide every 3s for a run's whole duration, even
// while Phase 1 triage is still running and nothing has been persisted
// yet. Verified here with a real store + mocked fetch (same harness as
// risk.api.test.ts's #261 precedent), asserting on actual refetch
// behavior rather than introspecting onQueryStarted's internals.

const mockFetch = vi.fn()
vi.stubGlobal("fetch", mockFetch)

function makeResponse(body: unknown, status = 200) {
  const response = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: new Headers({ "content-type": "application/json" }),
    clone() {
      return response
    },
  }
  return response
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    site_id: "site-1",
    org_account_id: "org-1",
    triggered_by_account_id: "acct-1",
    status: "running",
    started_at: "2026-08-20T10:00:00.000Z",
    completed_at: null,
    categories_applicable: null,
    categories_skipped: null,
    categories_failed: null,
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
    risks_created: 0,
    ...overrides,
  }
}

function setupStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddlewares) =>
      getDefaultMiddlewares().concat(baseApi.middleware),
  })
}

const RISK_LIST_ARGS = {
  page: 1,
  limit: 10,
  searchTerm: "",
  siteId: "",
  category: "",
}

describe("aiRiskAnalysisApi.getAiRiskAnalysisRunById -- conditional RISK invalidation", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("does NOT refetch the risk list when risks_created is unchanged between polls", async () => {
    mockFetch
      // Initial getAllRisks fetch.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: [], meta: {} })
      )
      // First run fetch: risks_created 0.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: makeRun({ risks_created: 0 }) })
      )
      // Second run fetch: risks_created still 0.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: makeRun({ risks_created: 0 }) })
      )

    const store = setupStore()
    const riskSubscription = store.dispatch(
      risksApi.endpoints.getAllRisks.initiate(RISK_LIST_ARGS)
    )
    await riskSubscription

    await store.dispatch(
      aiRiskAnalysisApi.endpoints.getAiRiskAnalysisRunById.initiate("run-1", {
        forceRefetch: true,
      })
    )
    await store.dispatch(
      aiRiskAnalysisApi.endpoints.getAiRiskAnalysisRunById.initiate("run-1", {
        forceRefetch: true,
      })
    )

    // getAllRisks (1) + 2 run polls (2) = 3 total -- no 4th refetch of
    // the risk list, since risks_created never changed between polls.
    expect(mockFetch).toHaveBeenCalledTimes(3)
    riskSubscription.unsubscribe()
  })

  it("refetches the risk list once risks_created increases between polls", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: [], meta: {} })
      )
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: makeRun({ risks_created: 0 }) })
      )
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: makeRun({ risks_created: 4 }) })
      )
      // The refetch of getAllRisks triggered by the RISK invalidation.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: [], meta: {} })
      )

    const store = setupStore()
    const riskSubscription = store.dispatch(
      risksApi.endpoints.getAllRisks.initiate(RISK_LIST_ARGS)
    )
    await riskSubscription

    await store.dispatch(
      aiRiskAnalysisApi.endpoints.getAiRiskAnalysisRunById.initiate("run-1", {
        forceRefetch: true,
      })
    )
    await store.dispatch(
      aiRiskAnalysisApi.endpoints.getAiRiskAnalysisRunById.initiate("run-1", {
        forceRefetch: true,
      })
    )

    expect(mockFetch).toHaveBeenCalledTimes(4)
    const fourthCallArg = mockFetch.mock.calls[3][0]
    const fourthCallUrl =
      fourthCallArg instanceof Request
        ? fourthCallArg.url
        : String(fourthCallArg)
    expect(fourthCallUrl).toContain("/risk?")
    riskSubscription.unsubscribe()
  })
})
