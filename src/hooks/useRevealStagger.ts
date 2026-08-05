import { useEffect, useState } from "react"

// Once the last staggered card has finished its entrance transition, callers
// should drop the per-index transitionDelay entirely -- otherwise it lingers
// as an inline style forever (inline style always wins over a class-based
// hover:duration-* rule) and silently delays every later hover interaction
// on cards after the first by index * staggerMs.
export function useRevealStagger(
  revealVisible: boolean,
  cardCount: number,
  staggerMs = 80,
  durationMs = 700
) {
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!revealVisible) return
    const id = setTimeout(
      () => setSettled(true),
      durationMs + (cardCount - 1) * staggerMs + 50
    )
    return () => clearTimeout(id)
  }, [revealVisible, cardCount, staggerMs, durationMs])

  return settled
}
