import { act, render, renderHook } from "@testing-library/react"
import { useSectionScroll } from "./useSectionScroll"

let observerCallback: IntersectionObserverCallback
const observeMock = vi.fn()
const disconnectMock = vi.fn()

class MockIntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    observerCallback = callback
  }
  observe = observeMock
  disconnect = disconnectMock
  unobserve = vi.fn()
}
vi.stubGlobal("IntersectionObserver", MockIntersectionObserver)

function makeEl() {
  return document.createElement("div")
}

function keys(count: number) {
  return Array.from({ length: count }, (_, i) => `key-${i}`)
}

function TestSections({ sectionKeys }: { sectionKeys: string[] }) {
  const { registerSection } = useSectionScroll(sectionKeys)
  return (
    <>
      {sectionKeys.map((key, i) => (
        <div key={key} ref={registerSection(i)} data-testid={`section-${i}`} />
      ))}
    </>
  )
}

describe("useSectionScroll (ticket #62)", () => {
  beforeEach(() => {
    observeMock.mockClear()
    disconnectMock.mockClear()
  })

  it("starts with the first section active", () => {
    const { result } = renderHook(() => useSectionScroll(keys(3)))
    expect(result.current.activeIndex).toBe(0)
  })

  it("observes every registered section element once mounted (real ref-callback timing, not manual imperative calls)", () => {
    render(<TestSections sectionKeys={keys(3)} />)
    expect(observeMock).toHaveBeenCalledTimes(3)
  })

  it("re-attaches the observer when a section is removed and a different one added at the same index (identity change with an unchanged count)", () => {
    // A bare count dependency would miss this: length stays 3 both times,
    // but slot 1 now holds a different section than before. The effect must
    // re-run and re-observe the new DOM node at that slot, not keep watching
    // the detached old one.
    const { rerender } = render(
      <TestSections sectionKeys={["a", "b", "c"]} />
    )
    expect(observeMock).toHaveBeenCalledTimes(3)
    observeMock.mockClear()
    disconnectMock.mockClear()

    rerender(<TestSections sectionKeys={["a", "replaced", "c"]} />)

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(observeMock).toHaveBeenCalledTimes(3)
  })

  it("re-attaches when the first section is removed and a new one appended (net count unchanged)", () => {
    const { rerender } = render(
      <TestSections sectionKeys={["a", "b", "c"]} />
    )
    observeMock.mockClear()
    disconnectMock.mockClear()

    // Removing "a" shifts "b"/"c" into slots 0/1 (React reuses those nodes)
    // and a genuinely new identity ("d") lands in the now-freed last slot.
    rerender(<TestSections sectionKeys={["b", "c", "d"]} />)

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(observeMock).toHaveBeenCalledTimes(3)
  })

  it("re-attaches when the last section is removed and a new one appended (the exact shape of the original round-1 bug)", () => {
    const { rerender } = render(
      <TestSections sectionKeys={["a", "b", "c"]} />
    )
    observeMock.mockClear()
    disconnectMock.mockClear()

    // handleAddSection always appends at the end, so "delete the last
    // section, then add a new one" is the realistic version of this case —
    // a brand-new identity lands at the same (last) slot, count unchanged.
    rerender(<TestSections sectionKeys={["a", "b", "d"]} />)

    expect(disconnectMock).toHaveBeenCalledTimes(1)
    expect(observeMock).toHaveBeenCalledTimes(3)
  })

  it("updates activeIndex to whichever registered section the observer reports as intersecting", () => {
    const { result } = renderHook(() => useSectionScroll(keys(2)))
    const elA = makeEl()
    const elB = makeEl()
    act(() => {
      result.current.registerSection(0)(elA)
      result.current.registerSection(1)(elB)
    })

    act(() => {
      observerCallback(
        [
          {
            isIntersecting: true,
            target: elB,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      )
    })

    expect(result.current.activeIndex).toBe(1)
  })

  it("ignores an intersection report for an element that isn't a registered section", () => {
    const { result } = renderHook(() => useSectionScroll(keys(2)))
    const unregisteredEl = makeEl()

    act(() => {
      observerCallback(
        [
          {
            isIntersecting: true,
            target: unregisteredEl,
          } as unknown as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver
      )
    })

    expect(result.current.activeIndex).toBe(0)
  })

  it("scrollToSection calls scrollIntoView on the registered element for that index", () => {
    const { result } = renderHook(() => useSectionScroll(keys(2)))
    const elA = makeEl()
    const scrollIntoViewMock = vi.fn()
    elA.scrollIntoView = scrollIntoViewMock

    act(() => {
      result.current.registerSection(0)(elA)
    })
    act(() => {
      result.current.scrollToSection(0)
    })

    expect(scrollIntoViewMock).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "start",
    })
  })

  it("scrollToSection does nothing (does not throw) for an index with no registered element", () => {
    const { result } = renderHook(() => useSectionScroll(keys(2)))
    expect(() => {
      act(() => {
        result.current.scrollToSection(5)
      })
    }).not.toThrow()
  })

  it("disconnects the observer on unmount", () => {
    const { unmount } = renderHook(() => useSectionScroll(keys(2)))
    unmount()
    expect(disconnectMock).toHaveBeenCalled()
  })

  it("does not create an observer when there are zero sections", () => {
    observeMock.mockClear()
    renderHook(() => useSectionScroll([]))
    expect(observeMock).not.toHaveBeenCalled()
  })
})
