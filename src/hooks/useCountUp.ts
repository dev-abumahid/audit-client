import { useEffect, useRef, useState } from "react"

// Animates a number from 0 to `target` once `start` becomes true, using
// requestAnimationFrame with an ease-out curve. Built for the landing page's
// stylized product-visual widgets (Phase E) -- pairs with useRevealOnScroll's
// `isVisible` as the `start` trigger, so a stat counts up the moment its
// widget scrolls into view rather than animating off-screen where no one
// sees it.
//
// Same prefers-reduced-motion discipline as useRevealOnScroll: jumps
// straight to the final value instead of animating, rather than skipping
// the hook's effect and leaving the number at 0 -- a reduced-motion user
// should still see the real number immediately, not a stuck placeholder.
export function useCountUp(target: number, start: boolean, duration = 1200) {
  const [value, setValue] = useState(0)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!start || startedRef.current) return
    startedRef.current = true

    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      // Deferred via requestAnimationFrame rather than called synchronously
      // in the effect body -- same reasoning as the animated path below,
      // and avoids the React Compiler's synchronous-setState-in-effect
      // lint rule (cascading-render risk) even though this branch only
      // ever sets state once.
      const frame = requestAnimationFrame(() => setValue(target))
      return () => cancelAnimationFrame(frame)
    }

    let frame: number
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Cubic ease-out: fast start, settles gently into the final value
      // instead of a linear count that feels mechanical.
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [start, target, duration])

  return value
}
