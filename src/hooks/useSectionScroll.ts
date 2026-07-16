import { useCallback, useEffect, useRef, useState } from "react"

// Tracks which of a dynamic list of DOM sections is currently scrolled into
// view, and provides a jump-to-section scroller — the pattern already used
// inline in InspectionReport.tsx's report sidebar.
//
// `sectionKeys` must be a stable identifier per section (e.g. each section's
// own id), not just a count. A bare count would miss the case where a
// section is removed and a new one added at the same index in the same
// render — the length doesn't change, so an effect keyed only on count
// wouldn't re-run, leaving the observer watching the now-detached old DOM
// node instead of the new section that took its place. Keying on the
// section identities themselves re-attaches whenever the actual set of
// sections changes, not just its size.
export function useSectionScroll(sectionKeys: string[]) {
  const [activeIndex, setActiveIndex] = useState(0)
  const sectionRefs = useRef<(HTMLElement | null)[]>([])
  const sectionKeysSignature = sectionKeys.join("|")

  useEffect(() => {
    if (sectionKeys.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = sectionRefs.current.indexOf(
              entry.target as HTMLElement
            )
            if (idx !== -1) setActiveIndex(idx)
          }
        })
      },
      { threshold: 0.4, rootMargin: "-80px 0px -20% 0px" }
    )

    sectionRefs.current.forEach((el) => el && observer.observe(el))

    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionKeysSignature])

  const registerSection = useCallback(
    (index: number) => (el: HTMLElement | null) => {
      sectionRefs.current[index] = el
    },
    []
  )

  const scrollToSection = useCallback((index: number) => {
    sectionRefs.current[index]?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    })
  }, [])

  return { activeIndex, registerSection, scrollToSection }
}
