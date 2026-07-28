import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { inspectionApi } from "./inspection.api"
import { noteApi } from "./note.api"

// aexa-frontend#229: deleteNoteById must invalidate INSPECTION as well as
// NOTE, matching saveRawNote/extractNoteFromFile -- all three change
// inspection.note's existence/identity, and the parent inspection page's
// cached "note.id" (driving its View Note / Upload Note button label) reads
// off getSingleInspection, which provides the INSPECTION tag. Verified here
// with a real store + mocked fetch (same harness as baseApi.test.ts) rather
// than introspecting RTK Query's internal endpoint config, since
// invalidatesTags isn't a stable, directly-readable runtime property.

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

describe("noteApi.deleteNoteById cache invalidation (#229)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("refetches a subscribed getSingleInspection query after deleteNoteById resolves", async () => {
    mockFetch
      // Initial getSingleInspection fetch.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: { id: "insp-1", note: { id: "note-1" } } })
      )
      // deleteNoteById's own DELETE request.
      .mockResolvedValueOnce(makeResponse({ success: true, data: {} }))
      // The refetch triggered by INSPECTION invalidation, if it happens.
      .mockResolvedValueOnce(
        makeResponse({ success: true, data: { id: "insp-1", note: null } })
      )

    const store = setupStore()

    const subscription = store.dispatch(
      inspectionApi.endpoints.getSingleInspection.initiate("insp-1")
    )
    await subscription

    await store.dispatch(noteApi.endpoints.deleteNoteById.initiate("note-1"))

    // Three calls if the refetch happened (initial GET + DELETE + refetch
    // GET), one fewer (2) if INSPECTION was never invalidated. Checking the
    // 3rd call's URL too, not just the count, so a failure here points
    // straight at "no refetch of /inspection/:id" rather than requiring a
    // trip through the other assertion's arithmetic to diagnose.
    expect(mockFetch).toHaveBeenCalledTimes(3)
    const thirdCallArg = mockFetch.mock.calls[2][0]
    const thirdCallUrl =
      thirdCallArg instanceof Request ? thirdCallArg.url : String(thirdCallArg)
    expect(thirdCallUrl).toContain("/inspection/insp-1")

    subscription.unsubscribe()
  })
})
