import { render, screen, fireEvent } from "@testing-library/react"
import { useState } from "react"
import { useModalA11y } from "./useModalA11y"

function TestHarness() {
  const [isOpen, setIsOpen] = useState(false)
  const close = () => setIsOpen(false)
  const containerRef = useModalA11y(isOpen, close)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>New Audit Mission</button>
      {isOpen && (
        <div ref={containerRef} role="dialog">
          <input placeholder="title" />
          <button onClick={close}>Save</button>
        </div>
      )}
    </>
  )
}

describe("useModalA11y (quality-bar-loop audit round 1 -- focus-restore regression)", () => {
  it("returns focus to the trigger element after the modal closes via Escape", () => {
    render(<TestHarness />)

    const trigger = screen.getByRole("button", { name: "New Audit Mission" })
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    fireEvent.click(trigger)
    expect(screen.getByRole("dialog")).toBeInTheDocument()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })

  it("returns focus to the trigger element after the modal closes via a button inside it", () => {
    render(<TestHarness />)

    const trigger = screen.getByRole("button", { name: "New Audit Mission" })
    trigger.focus()
    fireEvent.click(trigger)

    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(trigger)
  })
})

// quality-bar-loop round (Compliance accessibility, fresh-panel finding):
// `:not([tabindex="-1"])` was only attached to the standalone `[tabindex]`
// clause in FOCUSABLE_SELECTOR -- a comma-separated selector list treats
// each clause independently, so a `<button tabIndex={-1}>` (a roving-
// tabindex pattern's inactive items, e.g. AttestHistoryModal.tsx's tabs)
// still matched the earlier `button:not([disabled])` clause and was
// wrongly counted as the trap's last element. Live-reproduced in a real
// browser: real Tab navigation skips tabindex="-1" entirely, so the trap
// escaped into the background page after only 2 presses.
function RovingTabindexHarness() {
  const [isOpen, setIsOpen] = useState(true)
  const close = () => setIsOpen(false)
  const containerRef = useModalA11y(isOpen, close)

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Open History</button>
      {isOpen && (
        <div ref={containerRef} role="dialog">
          <button>Close</button>
          {/* Mirrors AttestHistoryModal.tsx's tab pattern: only the
              active tab is in the natural tab order. */}
          <button tabIndex={0}>Attestations</button>
          <button tabIndex={-1}>Edit History</button>
        </div>
      )}
    </>
  )
}

describe("useModalA11y -- tabindex=-1 elements (e.g. inactive roving-tabindex tabs)", () => {
  it("excludes tabindex=-1 buttons from the trap, so Shift+Tab from the first element wraps to the last REAL focusable element", () => {
    render(<RovingTabindexHarness />)

    const closeButton = screen.getByRole("button", { name: "Close" })
    const attestationsTab = screen.getByRole("button", {
      name: "Attestations",
    })
    closeButton.focus()

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })

    // With the bug: "Edit History" (tabIndex=-1) is wrongly treated as the
    // trap's last element, so Shift+Tab from Close wraps to it instead --
    // an element real Tab navigation could never actually reach.
    expect(document.activeElement).toBe(attestationsTab)
  })
})
