import { renderHook } from "@testing-library/react"
import { useBeforeUnloadGuard } from "./useBeforeUnloadGuard"

function dispatchBeforeUnload() {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe("useBeforeUnloadGuard", () => {
  it("calls preventDefault when shouldWarn returns true", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(() => true))

    const event = dispatchBeforeUnload()

    expect(event.defaultPrevented).toBe(true)
    unmount()
  })

  it("does nothing when shouldWarn returns false", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(() => false))

    const event = dispatchBeforeUnload()

    expect(event.defaultPrevented).toBe(false)
    unmount()
  })

  // The hook's own doc comment calls this out as the reason `shouldWarn` is
  // a function rather than a captured boolean: callers pass a closure that
  // reads a live ref, so the answer can change across renders without the
  // listener needing to be torn down and re-registered.
  it("reads shouldWarn live at unload time, not a value captured at mount", () => {
    let shouldWarn = false
    const { rerender, unmount } = renderHook(() =>
      useBeforeUnloadGuard(() => shouldWarn)
    )

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    shouldWarn = true
    rerender()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
    unmount()
  })

  it("removes the listener on unmount", () => {
    const { unmount } = renderHook(() => useBeforeUnloadGuard(() => true))

    unmount()

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
  })
})
