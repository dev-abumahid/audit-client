import { useEffect, useRef } from "react"

// Kept in a ref, not a `useCallback` requirement on every call site: the
// effect below must only run on the isOpen true/false transition, not on
// every parent re-render. An inline `() => setShowForm(false)` (the natural
// way to call this hook) gets a new function identity every render, so if
// the effect depended on `onClose` directly, a controlled input inside the
// modal (e.g. the "New KRI" name field) would tear the effect down and set
// up again after every keystroke -- and setup re-focuses the first
// focusable element in the modal, yanking focus off the field the user is
// actively typing into. Found while writing this fix's own tests (a
// multi-character userEvent.type() into the name field stopped after the
// first character).

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Round 9 audit (aexa-frontend#471) -- KriDashboardPage's three modals were
// plain divs with no role="dialog", no focus trap, and no Escape handling.
// Shared here instead of duplicated per-modal since all three need the exact
// same behavior: trap Tab/Shift+Tab focus inside the modal while it's open,
// close on Escape, and hand focus back to whatever opened the modal once it
// closes (standard WAI-ARIA dialog pattern -- see
// https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
//
// Not a full replacement for the shadcn/radix Dialog component
// (src/components/ui/dialog.tsx), which already handles this via Radix --
// that would mean re-styling all three modals to fit DialogContent's own
// layout, a larger change than this a11y fix calls for. This hook gives the
// existing custom markup the same guarantees with none of the restyling
// risk.
export function useModalA11y(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  // Assigning a ref during render is disallowed (React Compiler flags it) --
  // keep it current via its own effect instead, separate from the
  // isOpen-gated effect below so it still updates every render regardless
  // of isOpen.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    triggerRef.current = document.activeElement as HTMLElement | null

    const container = containerRef.current
    const focusable = container
      ? Array.from(
          container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
        )
      : []
    focusable[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== "Tab" || !container) return

      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      )
      if (nodes.length === 0) return

      const first = nodes[0]
      const last = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      // Return focus to whatever triggered the modal -- without this, focus
      // silently falls back to <body> once the modal unmounts, which is
      // disorienting for keyboard/screen-reader users.
      triggerRef.current?.focus()
    }
  }, [isOpen])

  return containerRef
}
