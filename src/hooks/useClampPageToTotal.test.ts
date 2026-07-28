import { renderHook } from "@testing-library/react"
import { useClampPageToTotal } from "./useClampPageToTotal"

describe("useClampPageToTotal", () => {
  it("clamps page down to totalPages when page is out of range", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 3, totalPages: 2 } }
    )

    expect(setPage).toHaveBeenCalledWith(2)
  })

  it("clamps down to 1 when totalPages shrinks all the way to 1", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 5, totalPages: 1 } }
    )

    expect(setPage).toHaveBeenCalledWith(1)
  })

  it("does nothing when page is already within range", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 2, totalPages: 3 } }
    )

    expect(setPage).not.toHaveBeenCalled()
  })

  it("does nothing when page equals totalPages exactly", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 3, totalPages: 3 } }
    )

    expect(setPage).not.toHaveBeenCalled()
  })

  // Guards the "totalPages momentarily 0/undefined while loading" case
  // called out in the hook's own comment -- several call sites derive
  // totalPages from data that is still undefined mid-fetch, and a naive
  // page > totalPages check would misfire and yank the user back to page 1.
  it("does not clamp when totalPages is 0 (e.g. a loading state)", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 3, totalPages: 0 } }
    )

    expect(setPage).not.toHaveBeenCalled()
  })

  it("does not clamp when totalPages is NaN", () => {
    const setPage = vi.fn()
    renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 3, totalPages: NaN } }
    )

    expect(setPage).not.toHaveBeenCalled()
  })

  it("re-clamps again if totalPages shrinks further on a later render, without looping", () => {
    const setPage = vi.fn()
    const { rerender } = renderHook(
      ({ page, totalPages }) => useClampPageToTotal(page, totalPages, setPage),
      { initialProps: { page: 5, totalPages: 5 } }
    )
    expect(setPage).not.toHaveBeenCalled()

    // totalPages shrinks to 3 while page is still 5 (as if two more deletes
    // landed before the previous clamp's re-render committed).
    rerender({ page: 5, totalPages: 3 })
    expect(setPage).toHaveBeenCalledTimes(1)
    expect(setPage).toHaveBeenLastCalledWith(3)

    // Once page actually becomes 3 (simulating the real setPage taking
    // effect), the effect must settle and not fire again.
    setPage.mockClear()
    rerender({ page: 3, totalPages: 3 })
    expect(setPage).not.toHaveBeenCalled()
  })
})
