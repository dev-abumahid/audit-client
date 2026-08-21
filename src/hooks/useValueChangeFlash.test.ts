import { renderHook } from "@testing-library/react"
import { act } from "react"
import { useValueChangeFlash } from "./useValueChangeFlash"

interface Item {
  id: string
  value: number
}

describe("useValueChangeFlash", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("does not flash anything on the first render, even with real data present", () => {
    const items: Item[] = [{ id: "a", value: 10 }]
    const { result } = renderHook(() =>
      useValueChangeFlash(items, (i) => i.id, (i) => i.value)
    )

    expect(result.current.flashingKeys.size).toBe(0)
    expect(result.current.changes).toEqual([])
  })

  it("flags an item as flashing when its value changes between renders", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(items, (i: Item) => i.id, (i: Item) => i.value),
      { initialProps: { items: [{ id: "a", value: 10 }] as Item[] } }
    )

    expect(result.current.flashingKeys.size).toBe(0)

    rerender({ items: [{ id: "a", value: 15 }] })

    expect(result.current.flashingKeys.has("a")).toBe(true)
    expect(result.current.changes).toHaveLength(1)
    expect(result.current.changes[0]).toMatchObject({
      key: "a",
      previousValue: 10,
      currentValue: 15,
    })
  })

  it("does not flag an item whose value is unchanged, even when the array reference changes", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(items, (i: Item) => i.id, (i: Item) => i.value),
      { initialProps: { items: [{ id: "a", value: 10 }] as Item[] } }
    )

    // A genuinely new array reference (as a real RTK Query refetch would
    // produce) but the value itself is identical -- must not flash.
    rerender({ items: [{ id: "a", value: 10 }] })

    expect(result.current.flashingKeys.size).toBe(0)
  })

  it("does not flash a brand-new item that has no prior value to compare against", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(items, (i: Item) => i.id, (i: Item) => i.value),
      { initialProps: { items: [{ id: "a", value: 10 }] as Item[] } }
    )

    rerender({
      items: [
        { id: "a", value: 10 },
        { id: "b", value: 99 },
      ],
    })

    expect(result.current.flashingKeys.has("b")).toBe(false)
    expect(result.current.changes).toEqual([])
  })

  it("clears the flash after the configured duration", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(
          items,
          (i: Item) => i.id,
          (i: Item) => i.value,
          1000
        ),
      { initialProps: { items: [{ id: "a", value: 10 }] as Item[] } }
    )

    rerender({ items: [{ id: "a", value: 15 }] })
    expect(result.current.flashingKeys.has("a")).toBe(true)

    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current.flashingKeys.has("a")).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current.flashingKeys.has("a")).toBe(false)
  })

  it("only flashes the item(s) that actually changed, not every item in the list", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(items, (i: Item) => i.id, (i: Item) => i.value),
      {
        initialProps: {
          items: [
            { id: "a", value: 10 },
            { id: "b", value: 20 },
          ] as Item[],
        },
      }
    )

    rerender({
      items: [
        { id: "a", value: 10 },
        { id: "b", value: 25 },
      ],
    })

    expect(result.current.flashingKeys.has("a")).toBe(false)
    expect(result.current.flashingKeys.has("b")).toBe(true)
    expect(result.current.changes.map((c) => c.key)).toEqual(["b"])
  })

  it("restarts the flash timer if the same item changes again before the first flash clears", () => {
    const { result, rerender } = renderHook(
      ({ items }) =>
        useValueChangeFlash(
          items,
          (i: Item) => i.id,
          (i: Item) => i.value,
          1000
        ),
      { initialProps: { items: [{ id: "a", value: 10 }] as Item[] } }
    )

    rerender({ items: [{ id: "a", value: 15 }] })

    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(result.current.flashingKeys.has("a")).toBe(true)

    // Second change arrives before the first flash would have cleared.
    rerender({ items: [{ id: "a", value: 20 }] })

    act(() => {
      vi.advanceTimersByTime(700)
    })
    // 700 + 700 = 1400ms since the first change, which would have cleared
    // a non-restarted 1000ms timer -- still flashing proves the timer
    // restarted on the second change instead of the first one firing.
    expect(result.current.flashingKeys.has("a")).toBe(true)

    act(() => {
      vi.advanceTimersByTime(300)
    })
    expect(result.current.flashingKeys.has("a")).toBe(false)
  })
})
