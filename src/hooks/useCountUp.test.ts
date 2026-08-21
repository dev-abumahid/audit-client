import { act, renderHook } from "@testing-library/react"
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

  it("only starts once -- toggling start off and back on doesn't restart the animation", () => {
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

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current).toBe(10)
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
