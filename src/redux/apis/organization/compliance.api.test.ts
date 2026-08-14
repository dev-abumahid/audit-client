import { configureStore } from "@reduxjs/toolkit"
import { baseApi } from "@/redux/baseApi"
import { complianceApi } from "./compliance.api"

// Found live-verifying the compliance decomposition round: attesting an
// obligation without typing a note failed with a 400 ("expected object,
// received undefined"), because `body: note ? { note } : undefined` sent no
// body at all when note was empty -- and the backend's
// z.object({ note: ... }) schema (compliance.validation.ts) rejects a
// missing body outright even though `note` itself is optional. The fix
// always sends `{ note }`, which JSON.stringify degrades to `{}` for the
// no-note case -- a shape the same schema accepts.

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

async function bodyTextOf(callArgs: unknown[]) {
  const [input, init] = callArgs as [RequestInfo, RequestInit | undefined]
  const request = input instanceof Request ? input : new Request(input, init)
  return request.clone().text()
}

describe("complianceApi.attestCompliance request body (live-verify finding)", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("sends a JSON object body, not an empty request, when note is omitted", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: true, data: {} })
    )

    const store = setupStore()
    await store.dispatch(
      complianceApi.endpoints.attestCompliance.initiate({ id: "obl-1" })
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const bodyText = await bodyTextOf(mockFetch.mock.calls[0])
    // A genuinely bodyless request serializes to "" here, not "{}" -- this
    // is the exact distinction the backend's zod schema drew (rejecting an
    // absent body, not the absent `note` key within it).
    expect(bodyText).not.toBe("")
    expect(JSON.parse(bodyText)).toEqual({})
  })

  it("still sends the note when one is provided", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: true, data: {} })
    )

    const store = setupStore()
    await store.dispatch(
      complianceApi.endpoints.attestCompliance.initiate({
        id: "obl-1",
        note: "Confirmed with legal counsel",
      })
    )

    const bodyText = await bodyTextOf(mockFetch.mock.calls[0])
    expect(JSON.parse(bodyText)).toEqual({
      note: "Confirmed with legal counsel",
    })
  })
})

// Quality-bar-loop industry-standards gap: edit-history endpoint, mirroring
// the already-shipped attestation-history endpoint's URL shape exactly.
describe("complianceApi.getComplianceEditHistory", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("requests the /compliance/:id/edit-history endpoint with pagination params", async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ success: true, data: [], meta: { total: 0 } })
    )

    const store = setupStore()
    await store.dispatch(
      complianceApi.endpoints.getComplianceEditHistory.initiate({
        id: "obl-1",
        page: 1,
        limit: 20,
      })
    )

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [requestUrl] = mockFetch.mock.calls[0] as [RequestInfo]
    const url = requestUrl instanceof Request ? requestUrl.url : String(requestUrl)
    expect(url).toContain("/compliance/obl-1/edit-history")
    expect(url).toContain("page=1")
    expect(url).toContain("limit=20")
  })
})
