import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { riskLinkApi } from "./riskLink.api"

// aexa-frontend#261: createActionFromBucket must invalidate
// CORRELATION_MATRIX as well as FINDINGS -- getCorrelationMatrixData's
// cached actions are what CorrelationMatrixPage.tsx renders as its findings
// view, so without this the new action stays missing from the matrix until
// a hard reload. Verified here with a real store + mocked fetch (same
// harness as note.api.test.ts's #229 precedent) rather than introspecting
// RTK Query's internal endpoint config, since invalidatesTags isn't a
// stable, directly-readable runtime property.

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

function setupStore() {
  return configureStore({
    reducer: { [baseApi.reducerPath]: baseApi.reducer },
    middleware: (getDefaultMiddlewares) =>
      getDefaultMiddlewares().concat(baseApi.middleware),
  })
}

describe("riskLinkApi.createActionFromBucket cache invalidation (#261)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after createActionFromBucket resolves", async () => {
    mockFetch
      // Initial getCorrelationMatrixData fetch.
      .mockResolvedValueOnce(
        makeResponse({
          success: true,
          data: { risks: [], riskLinks: [], actions: [] },
        })
      )
      // createActionFromBucket's own POST request.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: { id: "action-1" } })
      )
      // The refetch triggered by CORRELATION_MATRIX invalidation, if it
      // happens.
      .mockResolvedValueOnce(
        makeResponse({
          success: true,
          data: { risks: [], riskLinks: [], actions: [{ id: "action-1" }] },
        })
      )

    const store = setupStore()

    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(
      riskLinkApi.endpoints.createActionFromBucket.initiate({
        description: "desc",
        normReference: "ref",
        owner: "owner",
        priority: "immediate",
        estimatedRiskReduction: 1,
        estimatedCost: "low",
        timeline: "1w",
        riskRefs: ["risk-1"],
      })
    )

    // Three calls if the refetch happened (initial GET + POST + refetch
    // GET), one fewer (2) if CORRELATION_MATRIX was never invalidated.
    // Checking the 3rd call's URL too, not just the count, so a failure
    // here points straight at "no refetch of /risk/correlation-matrix"
    // rather than requiring a trip through the other assertion's
    // arithmetic to diagnose.
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const thirdCallArg = mockFetch.mock.calls[2][0]
    const thirdCallUrl =
      thirdCallArg instanceof Request ? thirdCallArg.url : String(thirdCallArg)
    expect(thirdCallUrl).toContain("/risk/correlation-matrix")

    subscription.unsubscribe()
  })
})
