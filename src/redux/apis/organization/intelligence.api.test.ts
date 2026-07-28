import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { intelligenceApi } from "./intelligence.api"
import { risksApi } from "./risk.api"

// aexa-frontend#261: createRiskFromItem must invalidate RISK as well as
// INTELLIGENCE_ITEM -- the endpoint creates a Risk server-side, and both
// Risk Register's getAllRisks and the Three Lines board cache-read RISK, so
// without this the newly-promoted risk stays missing from those views until
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

describe("intelligenceApi.createRiskFromItem cache invalidation (#261)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getAllRisks query after createRiskFromItem resolves", async () => {
    mockFetch
      // Initial getAllRisks fetch.
      .mockResolvedValueOnce(
        makeResponse({
          success: true,
          data: [],
          meta: { total: 0, page: 1, limit: 10 },
        })
      )
      // createRiskFromItem's own POST request.
      .mockResolvedValueOnce(
        makeResponse({
          success: true,
          data: { id: "risk-1", name: "New Risk" },
        })
      )
      // The refetch triggered by RISK invalidation, if it happens.
      .mockResolvedValueOnce(
        makeResponse({
          success: true,
          data: [{ id: "risk-1", name: "New Risk" }],
          meta: { total: 1, page: 1, limit: 10 },
        })
      )

    const store = setupStore()

    const subscription = store.dispatch(
      risksApi.endpoints.getAllRisks.initiate({
        page: 1,
        limit: 10,
        searchTerm: "",
        siteId: "",
        category: "",
      })
    )
    await subscription

    await store.dispatch(
      intelligenceApi.endpoints.createRiskFromItem.initiate({
        itemId: "item-1",
      })
    )

    // Three calls if the refetch happened (initial GET + POST + refetch
    // GET), one fewer (2) if RISK was never invalidated. Checking the 3rd
    // call's URL too, not just the count, so a failure here points straight
    // at "no refetch of /risk" rather than requiring a trip through the
    // other assertion's arithmetic to diagnose.
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const thirdCallArg = mockFetch.mock.calls[2][0]
    const thirdCallUrl =
      thirdCallArg instanceof Request ? thirdCallArg.url : String(thirdCallArg)
    expect(thirdCallUrl).toContain("/risk?")

    subscription.unsubscribe()
  })
})
