import { useEffect, useRef } from "react"

/**
 * quality-bar-loop (Inspections, round 58, code-quality finding): this
 * exact `beforeunload` handler was independently hand-rolled twice, in
 * CreateNewInspection.tsx and UpdateInspection.tsx (round 56, PR #734) --
 * same handler shape, same DOM API, differing only in their own
 * `shouldWarn` condition. Extracted per this codebase's own established
 * threshold for "near-identical, worth extracting" (see MediaThumbnail,
 * round 45), reintroduced in the very round that should have been most
 * alert to it (the still-open `onCloseAutoFocus` duplication, round 49).
 *
 * `shouldWarn` is called at unload time (not captured once), so callers
 * can pass a function that reads live, mutable state (a ref) without
 * needing to re-register the listener on every change.
 *
 * Round 58 review finding (PR #736, MEDIUM): both call sites pass an
 * inline arrow (a fresh identity every render), which -- with `shouldWarn`
 * in the effect's own dependency array -- meant the listener was actually
 * being removed and re-added on every render (e.g. every keystroke), not
 * once per mount as the original inline effects did. `shouldWarn` is
 * stashed in a ref and read from a stable callback instead, so the effect
 * registers exactly once regardless of how often the caller's closure
 * identity changes.
 */
export function useBeforeUnloadGuard(shouldWarn: () => boolean) {
  const shouldWarnRef = useRef(shouldWarn)
  useEffect(() => {
    shouldWarnRef.current = shouldWarn
  }, [shouldWarn])

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!shouldWarnRef.current()) return
      e.preventDefault()
      // Chrome (and the spec) ignore any custom string and show their own
      // generic message; older browsers can use this returnValue.
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])
}
