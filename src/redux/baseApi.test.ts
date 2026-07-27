import { configureStore } from "@reduxjs/toolkit"
import { baseApi, baseQueryWithLogout } from "./baseApi"
import { externalUserReducer, removeExternalUser } from "./slices/externalUser.slice"
import { removeUser, userReducer } from "./slices/user.slice"

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
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
      user: userReducer,
      externalUser: externalUserReducer,
    },
    middleware: (getDefaultMiddlewares) =>
      getDefaultMiddlewares().concat(baseApi.middleware),
  })
}

describe("baseQueryWithLogout", () => {
  const originalLocation = window.location

  beforeEach(() => {
    mockFetch.mockReset()
    // jsdom throws on real navigation via window.location.href assignment,
    // so stub it with a writable mock object per test.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: { ...originalLocation, href: "" },
    })
  })

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    })
  })

  it("dispatches removeUser, resets the api cache, and redirects to / on a 401", async () => {
    mockFetch.mockResolvedValue(makeResponse({ message: "Unauthorized" }, 401))

    const store = setupStore()
    const dispatchSpy = vi.spyOn(store, "dispatch")

    const result = await baseQueryWithLogout(
      "/protected",
      {
        signal: new AbortController().signal,
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: "probe",
        type: "query",
      } as never,
      {}
    )

    expect(result.error).toMatchObject({ status: 401 })
    expect(dispatchSpy).toHaveBeenCalledWith(removeUser())
    // aexa-frontend#216 -- found in review: a global 401 must also clear the
    // external session, otherwise a stale externalUser (with PII) lingers in
    // persisted localStorage indefinitely once any /external/* endpoint
    // starts returning real 401s.
    expect(dispatchSpy).toHaveBeenCalledWith(removeExternalUser())
    expect(dispatchSpy).toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(window.location.href).toBe("/")

    // removeUser dispatch must precede the redirect
    const removeUserCallIndex = dispatchSpy.mock.calls.findIndex(
      ([action]) => (action as { type: string }).type === removeUser().type
    )
    const resetApiStateCallIndex = dispatchSpy.mock.calls.findIndex(
      ([action]) =>
        (action as { type: string }).type === baseApi.util.resetApiState().type
    )
    expect(removeUserCallIndex).toBeGreaterThanOrEqual(0)
    expect(resetApiStateCallIndex).toBeGreaterThan(removeUserCallIndex)
  })

  it("does not dispatch removeUser, reset the cache, or redirect on a non-401 error", async () => {
    mockFetch.mockResolvedValue(makeResponse({ message: "Server error" }, 500))

    const store = setupStore()
    const dispatchSpy = vi.spyOn(store, "dispatch")

    const result = await baseQueryWithLogout(
      "/protected",
      {
        signal: new AbortController().signal,
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: "probe",
        type: "query",
      } as never,
      {}
    )

    expect(result.error).toMatchObject({ status: 500 })
    expect(dispatchSpy).not.toHaveBeenCalledWith(removeUser())
    expect(dispatchSpy).not.toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(window.location.href).toBe("")
  })

  it("does not dispatch removeUser, reset the cache, or redirect on a 401 from an auth endpoint", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ message: "Invalid credentials" }, 401)
    )

    const store = setupStore()
    const dispatchSpy = vi.spyOn(store, "dispatch")

    const result = await baseQueryWithLogout(
      { url: "/auth/sign-in", method: "POST", body: {} },
      {
        signal: new AbortController().signal,
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: "signInUser",
        type: "mutation",
      } as never,
      {}
    )

    expect(result.error).toMatchObject({ status: 401 })
    expect(dispatchSpy).not.toHaveBeenCalledWith(removeUser())
    expect(dispatchSpy).not.toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(window.location.href).toBe("")
  })

  // aexa-frontend#216
  it("does not dispatch removeUser, reset the cache, or redirect on a 401 from an external-auth endpoint", async () => {
    mockFetch.mockResolvedValue(
      makeResponse({ message: "Invalid code, or your access is not active." }, 401)
    )

    const store = setupStore()
    const dispatchSpy = vi.spyOn(store, "dispatch")

    const result = await baseQueryWithLogout(
      { url: "/external-auth/verify-code", method: "POST", body: {} },
      {
        signal: new AbortController().signal,
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: "verifyExternalCode",
        type: "mutation",
      } as never,
      {}
    )

    expect(result.error).toMatchObject({ status: 401 })
    expect(dispatchSpy).not.toHaveBeenCalledWith(removeUser())
    expect(dispatchSpy).not.toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(window.location.href).toBe("")
  })

  it("does not dispatch removeUser, reset the cache, or redirect on a successful response", async () => {
    mockFetch.mockResolvedValue(makeResponse({ data: "ok" }, 200))

    const store = setupStore()
    const dispatchSpy = vi.spyOn(store, "dispatch")

    const result = await baseQueryWithLogout(
      "/protected",
      {
        signal: new AbortController().signal,
        dispatch: store.dispatch,
        getState: store.getState,
        extra: undefined,
        endpoint: "probe",
        type: "query",
      } as never,
      {}
    )

    expect(result.error).toBeUndefined()
    expect(dispatchSpy).not.toHaveBeenCalledWith(removeUser())
    expect(dispatchSpy).not.toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(window.location.href).toBe("")
  })
})
