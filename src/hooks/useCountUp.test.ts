import { act, renderHook } from "@testing-library/react"
import { StrictMode } from "react"
import { useCountUp } from "./useCountUp"

describe("useCountUp", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "performance"] })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stays at 0 until start becomes true", () => {
    const { result } = renderHook(
      ({ start }) => useCountUp(7, start),
      { initialProps: { start: false } }
    )
    expect(result.current).toBe(0)

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    // Still 0 -- start was never true, so the animation never began.
    expect(result.current).toBe(0)
  })

  it("counts up to the target value once start is true", () => {
    const { result, rerender } = renderHook(
      ({ start }) => useCountUp(42, start, 1000),
      { initialProps: { start: false } }
    )

    rerender({ start: true })

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(42)
  })

  it("restarts the animation from 0 if start toggles false then true again", () => {
    const { result, rerender } = renderHook(
      ({ start }) => useCountUp(10, start, 500),
      { initialProps: { start: true } }
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(10)

    rerender({ start: false })
    rerender({ start: true })

    // One frame into the restarted animation, well short of a fresh
    // animation reaching 10 -- proves the effect actually re-ran instead
    // of being blocked by a stale "already started" guard.
    act(() => {
      vi.advanceTimersByTime(16)
    })
    expect(result.current).toBeLessThan(10)

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(10)
  })

  // Sanity check for the real-world trigger: React 18 StrictMode
  // double-invokes this effect in dev (mount -> cleanup -> mount). The test
  // above (verified via negative control against the removed ref guard) is
  // what actually proves the fix -- fake timers don't reproduce
  // StrictMode's specific cancel-then-rerun timing closely enough for this
  // wrapper alone to fail on the old code, so this just confirms the hook
  // still behaves correctly when mounted under StrictMode.
  it("reaches the target value when mounted under React StrictMode", () => {
    const { result } = renderHook(() => useCountUp(92, true, 1200), {
      wrapper: StrictMode,
    })

    act(() => {
      vi.advanceTimersByTime(1200)
    })
    expect(result.current).toBe(92)
  })

  it("jumps straight to the target value under prefers-reduced-motion, no animation", () => {
    const matchMediaMock = vi.fn().mockReturnValue({ matches: true })
    vi.stubGlobal("matchMedia", matchMediaMock)

    const { result, rerender } = renderHook(
      ({ start }) => useCountUp(99, start, 1000),
      { initialProps: { start: false } }
    )
    expect(result.current).toBe(0)

    rerender({ start: true })
    act(() => {
      vi.advanceTimersByTime(16)
    })
    // Reduced motion still defers through one requestAnimationFrame (to
    // avoid a synchronous setState-in-effect), it just sets the final
    // value immediately on that first frame instead of animating toward it.
    expect(result.current).toBe(99)

    vi.unstubAllGlobals()
  })
})
