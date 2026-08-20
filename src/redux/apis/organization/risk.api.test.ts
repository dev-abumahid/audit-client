import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { riskLinkApi } from "./riskLink.api"
import { risksApi } from "./risk.api"

// aexa-frontend#261: createNewRisk/updateRisk/deleteRisk must all invalidate
// CORRELATION_MATRIX in addition to RISK -- a changed or deleted risk
// otherwise persists as a phantom (or stale) row on
// getCorrelationMatrixData's cached result, which CorrelationMatrixPage.tsx
// renders, until a hard reload. Verified here with a real store + mocked
// fetch (same harness as note.api.test.ts's #229 precedent) rather than
// introspecting RTK Query's internal endpoint config, since invalidatesTags
// isn't a stable, directly-readable runtime property.

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

function stubThreeCalls() {
  mockFetch
    // Initial getCorrelationMatrixData fetch.
    .mockResolvedValueOnce(
      makeResponse({
        success: true,
        data: { risks: [], riskLinks: [], actions: [] },
      })
    )
    // The mutation's own request.
    .mockResolvedValueOnce(makeResponse({ success: true, data: {} }))
    // The refetch triggered by CORRELATION_MATRIX invalidation, if it
    // happens.
    .mockResolvedValueOnce(
      makeResponse({
        success: true,
        data: { risks: [], riskLinks: [], actions: [] },
      })
    )
}

// Three calls if the refetch happened (initial GET + mutation request +
// refetch GET), one fewer (2) if CORRELATION_MATRIX was never invalidated.
// Checking the 3rd call's URL too, not just the count, so a failure here
// points straight at "no refetch of /risk/correlation-matrix" rather than
// requiring a trip through the other assertion's arithmetic to diagnose.
function assertRefetchedCorrelationMatrix() {
  expect(mockFetch).toHaveBeenCalledTimes(3)
  const thirdCallArg = mockFetch.mock.calls[2][0]
  const thirdCallUrl =
    thirdCallArg instanceof Request ? thirdCallArg.url : String(thirdCallArg)
  expect(thirdCallUrl).toContain("/risk/correlation-matrix")
}

describe("risksApi.createNewRisk cache invalidation of CORRELATION_MATRIX (#261)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after createNewRisk resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(
      risksApi.endpoints.createNewRisk.initiate({ name: "New Risk" })
    )

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})

describe("risksApi.updateRisk cache invalidation of CORRELATION_MATRIX (#261)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after updateRisk resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(
      risksApi.endpoints.updateRisk.initiate({
        id: "risk-1",
        data: { name: "Updated" },
      })
    )

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})

describe("risksApi.deleteRisk cache invalidation of CORRELATION_MATRIX (#261)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after deleteRisk resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(risksApi.endpoints.deleteRisk.initiate("risk-1"))

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})

// docs/design-docs/ai-risk-review-approval-workflow.md -- a risk moving
// PENDING_REVIEW -> APPROVED can immediately appear on the correlation
// matrix/graph, which (per the design review) needs the same
// CORRELATION_MATRIX invalidation as delete/create/update above. Same real
// store + mocked fetch harness -- this is the actual behavior the design
// review flagged as the single most likely place for a real bug, so it's
// worth proving with a real subscribed query, not just asserting the
// invalidatesTags array exists.
describe("risksApi.approveRisk cache invalidation of CORRELATION_MATRIX", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after approveRisk resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(risksApi.endpoints.approveRisk.initiate("risk-1"))

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})

describe("risksApi.dismissRisk cache invalidation of CORRELATION_MATRIX", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after dismissRisk resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(risksApi.endpoints.dismissRisk.initiate("risk-1"))

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})

describe("risksApi.bulkApproveRisks / bulkDismissRisks cache invalidation of CORRELATION_MATRIX", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getCorrelationMatrixData query after bulkApproveRisks resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(
      risksApi.endpoints.bulkApproveRisks.initiate(["risk-1", "risk-2"])
    )

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })

  it("refetches a subscribed getCorrelationMatrixData query after bulkDismissRisks resolves", async () => {
    stubThreeCalls()
    const store = setupStore()
    const subscription = store.dispatch(
      riskLinkApi.endpoints.getCorrelationMatrixData.initiate()
    )
    await subscription

    await store.dispatch(
      risksApi.endpoints.bulkDismissRisks.initiate(["risk-1", "risk-2"])
    )

    assertRefetchedCorrelationMatrix()
    subscription.unsubscribe()
  })
})
