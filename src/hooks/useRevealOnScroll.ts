import { useEffect, useRef, useState } from "react"

// Scroll-triggered reveal: unlike the dashboard's animate-* classes (applied
// unconditionally on mount, fine near the top of a short page), a landing
// page is tall enough that most sections would finish animating before the
// user ever scrolls to them. This gates the reveal on the section actually
// entering the viewport, and fires once.
//
// Returns a tuple, not an object with a `ref` field — the React Compiler
// eslint rule (react-hooks/refs) flags any property access on an object
// whose shape includes a ref as "accessing a ref during render", even for
// unrelated fields like `isVisible`. Destructuring a tuple into plain local
// bindings at the call site avoids that false positive.
export function useRevealOnScroll<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? true
        : typeof IntersectionObserver === "undefined"
  )

  useEffect(() => {
    if (isVisible) return
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin: "0px 0px -10% 0px" }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold, isVisible])

  return [ref, isVisible] as const
}
