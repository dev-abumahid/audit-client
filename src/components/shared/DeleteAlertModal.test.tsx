import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import DeleteAlertModal from "./DeleteAlertModal"

// aexa-frontend#263 -- i18n isn't initialized in the test environment, so
// t() echoes the raw key back (see RiskRegisterPage.test.tsx for the same
// convention).

describe("DeleteAlertModal", () => {
  it("renders translated Cancel and Delete button text by default", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.cancel" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.delete" })
    ).toBeInTheDocument()
  })

  it("shows the translated Deleting label while loading", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} loading />)

    expect(
      screen.getByRole("button", { name: "common.deleteAlertModal.deleting" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "common.deleteAlertModal.delete" })
    ).not.toBeInTheDocument()
  })

  it("falls back to translated default title and description when none are provided", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    expect(
      screen.getByText("common.deleteAlertModal.defaultTitle")
    ).toBeInTheDocument()
    expect(
      screen.getByText("common.deleteAlertModal.defaultDescription")
    ).toBeInTheDocument()
  })

  it("renders custom title and description when provided", () => {
    render(
      <DeleteAlertModal
        open
        onConfirm={vi.fn()}
        title="Delete this site?"
        description="This removes the site permanently."
      />
    )

    expect(screen.getByText("Delete this site?")).toBeInTheDocument()
    expect(
      screen.getByText("This removes the site permanently.")
    ).toBeInTheDocument()
    expect(
      screen.queryByText("common.deleteAlertModal.defaultTitle")
    ).not.toBeInTheDocument()
  })

  // quality-bar-loop round 11 (UX finding, Alerts loop): every caller of
  // this component before AlertsPage's "Dismiss" flow genuinely deletes,
  // so the hardcoded "Delete"/"Deleting..." copy was right for them --
  // but it was a real mid-flow terminology flip for a caller whose own
  // trigger/toast/title all say "Dismiss." Optional overrides let one
  // caller supply its own verb without touching every other caller's
  // default.
  it("uses confirmLabel/loadingLabel overrides instead of the default Delete/Deleting copy when provided", () => {
    const { rerender } = render(
      <DeleteAlertModal
        open
        onConfirm={vi.fn()}
        confirmLabel="Dismiss"
        loadingLabel="Dismissing..."
      />
    )

    expect(
      screen.getByRole("button", { name: "Dismiss" })
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "common.deleteAlertModal.delete" })
    ).not.toBeInTheDocument()

    rerender(
      <DeleteAlertModal
        open
        onConfirm={vi.fn()}
        loading
        confirmLabel="Dismiss"
        loadingLabel="Dismissing..."
      />
    )

    expect(
      screen.getByRole("button", { name: "Dismissing..." })
    ).toBeInTheDocument()
  })

  // quality-bar-loop round 5 (mobile, Sites & Entities loop): both buttons
  // used their variant's default size (h-7, 28px tall), under the 44px
  // touch-target guideline -- this component is reused by every delete
  // confirmation in the app (site/risk deletion, etc.), so the fix here
  // closes the gap everywhere it's used, not just on one page.
  it("gives both Cancel and Delete a touch-friendly 44px height", () => {
    render(<DeleteAlertModal open onConfirm={vi.fn()} />)

    const cancelButton = screen.getByRole("button", {
      name: "common.deleteAlertModal.cancel",
    })
    const deleteButton = screen.getByRole("button", {
      name: "common.deleteAlertModal.delete",
    })
    expect(cancelButton).toHaveClass("h-11")
    expect(deleteButton).toHaveClass("h-11")
    // Round-1 review of PR #612: `toHaveClass("h-11")` alone doesn't prove
    // anything -- AlertDialogAction/Cancel used to forward `className` only
    // to the inner Radix primitive, never to Button's own `className` prop,
    // so Radix's Slot just concatenated both class strings (no dedup) and
    // `h-11` sat right next to the unresolved `h-7` from the size variant,
    // with the real CSS winner left to Tailwind's declaration order. This
    // exact test still passed against that broken wiring. Asserting `h-7`
    // is genuinely gone is what actually proves tailwind-merge resolved the
    // conflict -- verified via negative control (reverted only
    // alert-dialog.tsx's className wiring, confirmed this specific
    // assertion fails while the toHaveClass("h-11") ones above still pass).
    expect(cancelButton.className).not.toContain("h-7")
    expect(deleteButton.className).not.toContain("h-7")
  })

  // quality-bar-loop round 7 (accessibility): this component is always used
  // fully controlled (open/setOpen from the caller's own state, no
  // <AlertDialogTrigger>), so Radix had no trigger reference to restore
  // focus to on close -- live-verified pressing Escape left focus on
  // <body> instead of the button that opened the modal. Mirrors a real
  // caller: a button toggling `open` via its own state, matching how
  // SitesEntities.tsx actually uses this component.
  it("restores focus to the triggering element after the modal closes", async () => {
    function ControlledCaller() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Delete risk</button>
          <DeleteAlertModal open={open} setOpen={setOpen} onConfirm={vi.fn()} />
        </>
      )
    }

    render(<ControlledCaller />)
    const trigger = screen.getByRole("button", { name: "Delete risk" })
    await userEvent.click(trigger)

    expect(
      await screen.findByRole("button", {
        name: "common.deleteAlertModal.cancel",
      })
    ).toBeInTheDocument()

    await userEvent.keyboard("{Escape}")

    await waitFor(() => expect(trigger).toHaveFocus())
  })

  // quality-bar-loop round 15 (accessibility, Alerts loop): the WAI-ARIA
  // APG dialog pattern requires focus to move INTO the dialog when it
  // opens -- live-confirmed (mouse click and a genuine keyboard Enter on
  // the trigger) that focus was instead staying on the trigger button
  // behind the overlay, giving a keyboard user no indication the dialog
  // had opened until an extra Tab press.
  it("moves focus into the dialog (onto Cancel) when it opens", async () => {
    function ControlledCaller() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button onClick={() => setOpen(true)}>Delete risk</button>
          <DeleteAlertModal open={open} setOpen={setOpen} onConfirm={vi.fn()} />
        </>
      )
    }

    render(<ControlledCaller />)
    await userEvent.click(screen.getByRole("button", { name: "Delete risk" }))

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common.deleteAlertModal.cancel" })
      ).toHaveFocus()
    )
  })

  // quality-bar-loop round 8 (accessibility): the "Delete" -> "Deleting..."
  // label swap has no live region wrapping it, so a screen-reader user gets
  // no announcement that their click registered before the toast/close.
  it("announces the Deleting state via an aria-live region", () => {
    const { rerender } = render(
      <DeleteAlertModal open onConfirm={vi.fn()} />
    )

    expect(screen.queryByText(/deleting/i)).not.toBeInTheDocument()

    rerender(<DeleteAlertModal open onConfirm={vi.fn()} loading />)

    const liveRegion = screen.getByText("common.deleteAlertModal.deleting", {
      selector: '[aria-live="polite"]',
    })
    expect(liveRegion).toBeInTheDocument()
  })

  // quality-bar-loop round 8 (accessibility): disabling the Delete button
  // via the native `disabled` attribute force-blurs it the instant loading
  // starts -- live-verified this dropped focus to <body> instead of a
  // meaningful control. Moving focus to the still-enabled Cancel button
  // keeps it inside the dialog.
  it("moves focus to Cancel when the focused Delete button becomes disabled", async () => {
    const { rerender } = render(
      <DeleteAlertModal open onConfirm={vi.fn()} />
    )

    const deleteButton = screen.getByRole("button", {
      name: "common.deleteAlertModal.delete",
    })
    deleteButton.focus()
    expect(deleteButton).toHaveFocus()

    rerender(<DeleteAlertModal open onConfirm={vi.fn()} loading />)

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "common.deleteAlertModal.cancel" })
      ).toHaveFocus()
    )
  })
})
