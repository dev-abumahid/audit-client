import { useEffect, useRef, useState } from "react"

// Phase C (theme-improvement-initiative): generic "did this item's value
// just change" tracker, built for KriDashboardPage's live-update flash but
// deliberately not KRI-specific -- same shape applies to any list of items
// keyed by id with a numeric/comparable value (KRI readings, alert counts,
// risk scores), so a second consumer doesn't have to reinvent this.
//
// `items` should be a referentially-stable array (only a new reference when
// real new data arrived, e.g. RTK Query's own memoized `data` field) --
// this hook treats a new array reference as "check for changes," not "user
// re-rendered for an unrelated reason." Every hook consuming this in this
// codebase gets that stability for free from the existing `useMemo(() =>
// response?.data ?? [], [response])` pattern already used everywhere data
// is unwrapped from an RTK Query response.
export interface ValueChange<T> {
  key: string
  item: T
  previousValue: unknown
  currentValue: unknown
}

export function useValueChangeFlash<T>(
  items: T[],
  getKey: (item: T) => string,
  getValue: (item: T) => unknown,
  flashDurationMs = 1400
) {
  // null (not an empty Map) specifically means "no baseline established
  // yet" -- distinguishes "first real data just arrived, nothing to
  // compare against" from "data arrived and is genuinely unchanged from an
  // empty prior state," so the very first render with real data never
  // flashes everything as if it just changed.
  const previousValuesRef = useRef<Map<string, unknown> | null>(null)
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const [flashingKeys, setFlashingKeys] = useState<Set<string>>(new Set())
  const [changes, setChanges] = useState<ValueChange<T>[]>([])

  useEffect(() => {
    const currentValues = new Map(
      items.map((item) => [getKey(item), getValue(item)])
    )

    if (previousValuesRef.current === null) {
      previousValuesRef.current = currentValues
      return
    }

    const prev = previousValuesRef.current
    const newlyChanged: ValueChange<T>[] = []

    for (const item of items) {
      const key = getKey(item)
      const value = getValue(item)
      // prev.has(key) excludes a brand-new item (nothing to compare
      // against, not a "change") from ever flashing on the render it
      // first appears.
      if (prev.has(key) && prev.get(key) !== value) {
        newlyChanged.push({
          key,
          item,
          previousValue: prev.get(key),
          currentValue: value,
        })
      }
    }

    previousValuesRef.current = currentValues

    if (newlyChanged.length === 0) return

    setChanges(newlyChanged)
    setFlashingKeys((existing) => {
      const next = new Set(existing)
      newlyChanged.forEach((c) => next.add(c.key))
      return next
    })

    newlyChanged.forEach(({ key }) => {
      const existingTimer = timersRef.current.get(key)
      if (existingTimer) clearTimeout(existingTimer)
      const timer = setTimeout(() => {
        setFlashingKeys((existing) => {
          const next = new Set(existing)
          next.delete(key)
          return next
        })
        timersRef.current.delete(key)
      }, flashDurationMs)
      timersRef.current.set(key, timer)
    })
    // items is the only real dependency -- getKey/getValue are expected to
    // be stable inline functions (or memoized by the caller), same
    // assumption every other hook in this codebase makes about its own
    // selector callbacks; re-running this effect on their identity instead
    // of items' would defeat the "only check on real new data" contract.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  // Clears any still-pending flash timers on unmount so a state update
  // never fires after the component owning this hook is gone.
  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  }, [])

  return { flashingKeys, changes }
}
